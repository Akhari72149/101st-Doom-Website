"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { discordAnnouncementChannels } from "@/data/discordAnnouncementChannels";
import {
  attendanceAssignableRoles,
  attendancePingRoles,
} from "@/data/discordAttendanceRoles";
import { supabase } from "@/lib/supabase";

type AttendanceOption = {
  id?: string;
  emoji: string;
  label: string;
  assign_role_id?: string | null;
  sort_order?: number;
};

type AttendanceEvent = {
  id: string;
  title: string;
  description: string | null;
  channel_id: string;
  channel_name: string | null;
  event_starts_at: string;
  duration_minutes: number;
  scheduled_send_at: string;
  repeat_scheduled_send_at: string | null;
  repeat_enabled: boolean;
  repeat_type: string;
  footer_text: string | null;
  status: string;
  discord_message_id: string | null;
  ping_role_id: string | null;
  reminder_enabled: boolean;
  reminder_scheduled_at: string | null;
  reminder_sent_at: string | null;
  reminder_message: string | null;
  reminder_role_id: string | null;
  options: AttendanceOption[];
};

type AttendanceEmojiOption = {
  id?: string;
  label: string;
  value: string;
  preview: string;
  imageUrl?: string;
  source: "base" | "server";
};

const defaultOptions: AttendanceOption[] = [
  { emoji: "☸️", label: "Platoon" },
  { emoji: "1️⃣", label: "1-1" },
  { emoji: "2️⃣", label: "1-2" },
  { emoji: "🛡️", label: "Hammer 4" },
  { emoji: "🚪", label: "Ride Along" },
  { emoji: "❌", label: "Not Attending" },
];

const allowedAttendanceAdminRoles = ["admin", "nco", "akhari"];
const weekDays = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "0", label: "Sunday" },
] as const;

function toDatetimeLocalValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function padTimePart(value: number) {
  return String(value).padStart(2, "0");
}

function toTimeInputValue(date: Date) {
  return `${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}`;
}

function getWeekdayValue(date: Date) {
  return String(date.getDay());
}

function getWeekdayLabel(value: string) {
  return weekDays.find((day) => day.value === value)?.label || "Weekly";
}

function formatWeeklySend(value: string | null | undefined) {
  const date = value ? new Date(value) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return "Weekly send not scheduled";
  }

  return `Every ${getWeekdayLabel(getWeekdayValue(date))} at ${toTimeInputValue(date)}`;
}

function getNextWeeklyDate(dayValue: string, timeValue: string) {
  const targetDay = Number(dayValue);
  const [hours = 0, minutes = 0] = timeValue.split(":").map(Number);
  const now = new Date();

  if (
    !Number.isInteger(targetDay) ||
    targetDay < 0 ||
    targetDay > 6 ||
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes)
  ) {
    return null;
  }

  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);

  const dayOffset = (targetDay - now.getDay() + 7) % 7;
  next.setDate(now.getDate() + dayOffset);

  if (next <= now) {
    next.setDate(next.getDate() + 7);
  }

  return next;
}

function toStoredDatetimeLocalValue(value: string | null | undefined, fallback: Date) {
  const parsed = value ? new Date(value) : fallback;

  if (Number.isNaN(parsed.getTime())) {
    return toDatetimeLocalValue(fallback);
  }

  return toDatetimeLocalValue(parsed);
}

function cloneDefaultOptions() {
  return defaultOptions.map((option) => ({ ...option }));
}

function cleanOptionsForForm(options: AttendanceOption[] | null | undefined) {
  if (!Array.isArray(options) || options.length === 0) {
    return cloneDefaultOptions();
  }

  return [...options]
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    .map((option) => ({
      id: option.id,
      emoji: option.emoji,
      label: option.label,
      assign_role_id: option.assign_role_id || "",
      sort_order: option.sort_order,
    }));
}

function EmojiPreview({
  emoji,
  className = "h-6 w-6",
}: {
  emoji: Pick<AttendanceEmojiOption, "imageUrl" | "label" | "preview">;
  className?: string;
}) {
  if (emoji.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={emoji.imageUrl}
        alt={emoji.label}
        className={`${className} object-contain`}
        loading="lazy"
      />
    );
  }

  return <span className={`${className} grid place-items-center text-lg`}>{emoji.preview}</span>;
}

export default function DiscordAttendancePage() {
  const router = useRouter();
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [channelId, setChannelId] = useState<string>(discordAnnouncementChannels[0]?.id || "");
  const [eventStartsAt, setEventStartsAt] = useState(() =>
    toDatetimeLocalValue(addHours(new Date(), 24)),
  );
  const [repeatSendDay, setRepeatSendDay] = useState(() =>
    getWeekdayValue(addHours(new Date(), 23)),
  );
  const [repeatSendTime, setRepeatSendTime] = useState(() =>
    toTimeInputValue(addHours(new Date(), 23)),
  );
  const [durationMinutes, setDurationMinutes] = useState("120");
  const [repeatEnabled, setRepeatEnabled] = useState(true);
  const [footerText, setFooterText] = useState("Role on Start");
  const [pingRoleId, setPingRoleId] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderScheduledAt, setReminderScheduledAt] = useState(() =>
    toDatetimeLocalValue(addHours(new Date(), 22)),
  );
  const [reminderMessage, setReminderMessage] = useState(
    "Mainop attendance reminder. Please react if you have not already.",
  );
  const [reminderRoleId, setReminderRoleId] = useState("");
  const [options, setOptions] = useState<AttendanceOption[]>(() => cloneDefaultOptions());
  const [emojiOptions, setEmojiOptions] = useState<AttendanceEmojiOption[]>([]);
  const [loadingEmojis, setLoadingEmojis] = useState(true);
  const [openEmojiPickerIndex, setOpenEmojiPickerIndex] = useState<number | null>(null);

  const selectedChannel = useMemo(
    () => discordAnnouncementChannels.find((channel) => channel.id === channelId) || null,
    [channelId],
  );

  const isEditing = editingEventId !== null;

  const baseEmojiOptions = useMemo(
    () => emojiOptions.filter((emoji) => emoji.source === "base"),
    [emojiOptions],
  );

  const serverEmojiOptions = useMemo(
    () => emojiOptions.filter((emoji) => emoji.source === "server"),
    [emojiOptions],
  );

  const activeEmojiOption =
    openEmojiPickerIndex === null ? null : options[openEmojiPickerIndex] || null;

  const activeSelectedEmoji = activeEmojiOption
    ? emojiOptions.find((emoji) => emoji.value === activeEmojiOption.emoji) || {
        label: activeEmojiOption.emoji || "Current",
        preview: activeEmojiOption.emoji || "?",
        value: activeEmojiOption.emoji,
        source: "base" as const,
      }
    : null;

  async function loadEvents() {
    setLoading(true);

    const { data, error } = await supabase
      .from("discord_attendance_events")
      .select(`
        id,
        title,
        description,
        channel_id,
        channel_name,
        event_starts_at,
        duration_minutes,
        scheduled_send_at,
        repeat_scheduled_send_at,
        repeat_enabled,
        repeat_type,
        footer_text,
        status,
        discord_message_id,
        ping_role_id,
        reminder_enabled,
        reminder_scheduled_at,
        reminder_sent_at,
        reminder_message,
        reminder_role_id,
        options:discord_attendance_options (
          id,
          emoji,
          label,
          assign_role_id,
          sort_order
        )
      `)
      .order("scheduled_send_at", { ascending: true })
      .limit(40);

    if (error) {
      setStatusMessage(error.message);
      setEvents([]);
    } else {
      const mappedEvents = ((data || []) as AttendanceEvent[]).map((event) => ({
        ...event,
        options: cleanOptionsForForm(event.options),
      }));

      setEvents(mappedEvents);
    }

    setLoading(false);
  }

  async function loadEmojiOptions() {
    setLoadingEmojis(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        setEmojiOptions([]);
        setLoadingEmojis(false);
        return;
      }

      const response = await fetch("/api/discord-attendance/emojis", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();
      setEmojiOptions(Array.isArray(result.emojis) ? result.emojis : []);
    } catch {
      setEmojiOptions([]);
    }

    setLoadingEmojis(false);
  }

  useEffect(() => {
    const checkAccess = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: roleData, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) {
        router.replace("/");
        return;
      }

      const roles = (roleData || []).map((row) => String(row.role).toLowerCase());
      const allowed = roles.some((role) => allowedAttendanceAdminRoles.includes(role));

      if (!allowed) {
        router.replace("/");
        return;
      }

      setLoadingAuth(false);
      await Promise.all([loadEvents(), loadEmojiOptions()]);
    };

    void checkAccess();
  }, [router]);

  function resetForm() {
    setEditingEventId(null);
    setTitle("");
    setDescription("");
    setChannelId(discordAnnouncementChannels[0]?.id || "");
    setEventStartsAt(toDatetimeLocalValue(addHours(new Date(), 24)));
    setRepeatSendDay(getWeekdayValue(addHours(new Date(), 23)));
    setRepeatSendTime(toTimeInputValue(addHours(new Date(), 23)));
    setDurationMinutes("120");
    setRepeatEnabled(true);
    setFooterText("Role on Start");
    setPingRoleId("");
    setReminderEnabled(false);
    setReminderScheduledAt(toDatetimeLocalValue(addHours(new Date(), 22)));
    setReminderMessage("Mainop attendance reminder. Please react if you have not already.");
    setReminderRoleId("");
    setOptions(cloneDefaultOptions());
    setOpenEmojiPickerIndex(null);
  }

  function loadEventForEdit(event: AttendanceEvent) {
    setEditingEventId(event.id);
    setTitle(event.title || "");
    setDescription(event.description || "");
    setChannelId(event.channel_id || discordAnnouncementChannels[0]?.id || "");
    setEventStartsAt(toStoredDatetimeLocalValue(event.event_starts_at, addHours(new Date(), 24)));
    const repeatSendDate = new Date(event.repeat_scheduled_send_at || event.scheduled_send_at);
    const safeRepeatSendDate = Number.isNaN(repeatSendDate.getTime())
      ? addHours(new Date(), 23)
      : repeatSendDate;
    setRepeatSendDay(getWeekdayValue(safeRepeatSendDate));
    setRepeatSendTime(toTimeInputValue(safeRepeatSendDate));
    setDurationMinutes(String(event.duration_minutes || 120));
    setRepeatEnabled(Boolean(event.repeat_enabled));
    setFooterText(event.footer_text || "Role on Start");
    setPingRoleId(event.ping_role_id || "");
    setReminderEnabled(Boolean(event.reminder_enabled));
    setReminderScheduledAt(
      toStoredDatetimeLocalValue(event.reminder_scheduled_at, addHours(new Date(), 22)),
    );
    setReminderMessage(
      event.reminder_message ||
        "Mainop attendance reminder. Please react if you have not already.",
    );
    setReminderRoleId(event.reminder_role_id || "");
    setOptions(cleanOptionsForForm(event.options));
    setOpenEmojiPickerIndex(null);
    setStatusMessage(`Editing "${event.title}". Save changes to update this record.`);
  }

  function updateOption(index: number, patch: Partial<AttendanceOption>) {
    setOptions((current) =>
      current.map((option, optionIndex) =>
        optionIndex === index ? { ...option, ...patch } : option,
      ),
    );
  }

  function removeOption(index: number) {
    setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index));
  }

  async function submitEvent() {
    setSaving(true);
    setStatusMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      setStatusMessage("You must be signed in to create or update attendance events.");
      setSaving(false);
      return;
    }

    const nextRepeatSendAt = repeatEnabled
      ? getNextWeeklyDate(repeatSendDay, repeatSendTime)
      : null;

    if (repeatEnabled && !nextRepeatSendAt) {
      setStatusMessage("Choose a valid weekly send day and time.");
      setSaving(false);
      return;
    }

    const repeatSendIso = nextRepeatSendAt?.toISOString() || null;

    const payload = {
      title,
      description,
      channel_id: channelId,
      event_starts_at: new Date(eventStartsAt).toISOString(),
      scheduled_send_at: repeatEnabled
        ? repeatSendIso
        : new Date().toISOString(),
      repeat_scheduled_send_at: repeatEnabled
        ? repeatSendIso
        : null,
      duration_minutes: Number(durationMinutes),
      repeat_enabled: repeatEnabled,
      repeat_type: repeatEnabled ? "weekly" : "none",
      repeat_timezone: "Europe/London",
      footer_text: footerText,
      ping_role_id: pingRoleId || null,
      reminder_enabled: reminderEnabled,
      reminder_scheduled_at: reminderEnabled
        ? new Date(reminderScheduledAt).toISOString()
        : null,
      reminder_message: reminderEnabled ? reminderMessage : null,
      reminder_role_id: reminderEnabled ? reminderRoleId || null : null,
      options: options.map((option, index) => ({
        id: option.id,
        emoji: option.emoji,
        label: option.label,
        assign_role_id: option.assign_role_id || null,
        sort_order: index,
      })),
    };

    const response = await fetch(
      isEditing ? `/api/discord-attendance/${editingEventId}` : "/api/discord-attendance",
      {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      setStatusMessage(
        result.error || `Failed to ${isEditing ? "update" : "create"} attendance event.`,
      );
      setSaving(false);
      return;
    }

    setSaving(false);
    resetForm();
    setStatusMessage(isEditing ? "Attendance event updated." : "Attendance event created.");
    await loadEvents();
  }

  async function deleteEvent(event: AttendanceEvent) {
    const confirmed = window.confirm(
      `Delete "${event.title}"? This will also delete the Discord embed message if it has been sent.`,
    );

    if (!confirmed) return;

    setDeletingEventId(event.id);
    setStatusMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      setStatusMessage("You must be signed in to delete attendance events.");
      setDeletingEventId(null);
      return;
    }

    const response = await fetch(`/api/discord-attendance/${event.id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      setStatusMessage(result.error || "Failed to delete attendance event.");
      setDeletingEventId(null);
      return;
    }

    if (editingEventId === event.id) {
      resetForm();
    }

    setStatusMessage("Attendance event deleted.");
    setDeletingEventId(null);
    await loadEvents();
  }

  if (loadingAuth) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#020704] px-4 text-[#00ff66]">
        <div className="border border-[#00ff66]/20 bg-black/45 px-5 py-4 text-sm uppercase tracking-[0.18em]">
          Checking attendance access...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020704] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 border border-[#00ff66]/20 bg-black/45 p-5">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#00ff66]/60">
            Discord Operations
          </p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-[0.12em] text-[#00ff66]">
                Attendance Messages
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">
                Create scheduled Discord attendance embeds with reaction options.
                The bot sends the message, tracks reactions, and updates the embed live.
              </p>
            </div>
            <button
              type="button"
              onClick={loadEvents}
              className="inline-flex items-center gap-2 border border-[#00ff66]/35 bg-[#00ff66]/10 px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[#00ff66]"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </header>

        {statusMessage && (
          <div className="mb-5 border border-[#00ff66]/25 bg-[#00ff66]/10 px-4 py-3 text-sm text-[#9cffbd]">
            {statusMessage}
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(420px,0.58fr)]">
          <section className="border border-[#00ff66]/15 bg-black/35 p-5">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <CalendarClock className="h-6 w-6 text-[#00ff66]" />
                <h2 className="text-2xl font-bold text-[#00ff66]">
                  {isEditing ? "Edit Event" : "Create Event"}
                </h2>
              </div>

              {isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setStatusMessage("Edit cancelled. Ready to create a new attendance message.");
                  }}
                  className="inline-flex items-center gap-2 border border-[#00ff66]/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#00ff66]"
                >
                  <X className="h-4 w-4" />
                  New Message
                </button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.18em] text-gray-500">Title</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="mt-2 h-11 w-full border border-[#00ff66]/25 bg-black/50 px-3 text-sm text-white outline-none focus:border-[#00ff66]/70"
                />
              </label>

              <label className="block">
                <span className="text-xs uppercase tracking-[0.18em] text-gray-500">
                  Discord Channel
                </span>
                <select
                  value={channelId}
                  onChange={(event) => setChannelId(event.target.value)}
                  className="mt-2 h-11 w-full border border-[#00ff66]/25 bg-black/50 px-3 text-sm text-white outline-none focus:border-[#00ff66]/70"
                >
                  {discordAnnouncementChannels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      #{channel.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs uppercase tracking-[0.18em] text-gray-500">
                  Event Time
                </span>
                <input
                  type="datetime-local"
                  value={eventStartsAt}
                  onChange={(event) => setEventStartsAt(event.target.value)}
                  className="mt-2 h-11 w-full border border-[#00ff66]/25 bg-black/50 px-3 text-sm text-white outline-none focus:border-[#00ff66]/70"
                />
              </label>

              <label className="block">
                <span className="text-xs uppercase tracking-[0.18em] text-gray-500">
                  Duration Minutes
                </span>
                <input
                  type="number"
                  min="1"
                  value={durationMinutes}
                  onChange={(event) => setDurationMinutes(event.target.value)}
                  className="mt-2 h-11 w-full border border-[#00ff66]/25 bg-black/50 px-3 text-sm text-white outline-none focus:border-[#00ff66]/70"
                />
              </label>

              <label className="block">
                <span className="text-xs uppercase tracking-[0.18em] text-gray-500">Footer</span>
                <input
                  value={footerText}
                  onChange={(event) => setFooterText(event.target.value)}
                  className="mt-2 h-11 w-full border border-[#00ff66]/25 bg-black/50 px-3 text-sm text-white outline-none focus:border-[#00ff66]/70"
                />
              </label>

              <label className="block">
                <span className="text-xs uppercase tracking-[0.18em] text-gray-500">
                  Main Ping Role
                </span>
                <select
                  value={pingRoleId}
                  onChange={(event) => setPingRoleId(event.target.value)}
                  className="mt-2 h-11 w-full border border-[#00ff66]/25 bg-black/50 px-3 text-sm text-white outline-none focus:border-[#00ff66]/70"
                >
                  <option value="">No role ping</option>
                  {attendancePingRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-4 flex items-center gap-3 border border-[#00ff66]/15 bg-black/35 px-4 py-3">
              <input
                type="checkbox"
                checked={repeatEnabled}
                onChange={(event) => setRepeatEnabled(event.target.checked)}
              />
              <span className="text-sm text-gray-300">Repeat every week</span>
            </label>

            {repeatEnabled && (
              <div className="mt-4 border border-[#00ff66]/15 bg-black/35 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-gray-500">
                  Weekly Message Sends
                </div>
                <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_180px]">
                  <fieldset>
                    <legend className="sr-only">Weekly send day</legend>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                      {weekDays.map((day) => (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => setRepeatSendDay(day.value)}
                          className={`h-11 border px-3 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                            repeatSendDay === day.value
                              ? "border-[#00ff66] bg-[#00ff66]/15 text-[#00ff66]"
                              : "border-[#00ff66]/20 bg-black/45 text-gray-400 hover:border-[#00ff66]/60 hover:text-[#00ff66]"
                          }`}
                        >
                          {day.label.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <label className="block">
                    <span className="text-xs uppercase tracking-[0.18em] text-gray-500">
                      Time
                    </span>
                    <input
                      type="time"
                      value={repeatSendTime}
                      onChange={(event) => setRepeatSendTime(event.target.value)}
                      className="mt-2 h-11 w-full border border-[#00ff66]/25 bg-black/50 px-3 text-sm text-white outline-none focus:border-[#00ff66]/70"
                    />
                  </label>
                </div>
                <p className="mt-3 text-xs text-gray-500">
                  Next send will be calculated as the next {getWeekdayLabel(repeatSendDay)} at{" "}
                  {repeatSendTime || "00:00"}.
                </p>
              </div>
            )}

            <div className="mt-4 border border-[#00ff66]/15 bg-black/35 p-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={(event) => setReminderEnabled(event.target.checked)}
                />
                <span className="text-sm text-gray-300">Send a reminder message</span>
              </label>

              {reminderEnabled && (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="text-xs uppercase tracking-[0.18em] text-gray-500">
                      Reminder Sends At
                    </span>
                    <input
                      type="datetime-local"
                      value={reminderScheduledAt}
                      onChange={(event) => setReminderScheduledAt(event.target.value)}
                      className="mt-2 h-11 w-full border border-[#00ff66]/25 bg-black/50 px-3 text-sm text-white outline-none focus:border-[#00ff66]/70"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs uppercase tracking-[0.18em] text-gray-500">
                      Reminder Ping Role
                    </span>
                    <select
                      value={reminderRoleId}
                      onChange={(event) => setReminderRoleId(event.target.value)}
                      className="mt-2 h-11 w-full border border-[#00ff66]/25 bg-black/50 px-3 text-sm text-white outline-none focus:border-[#00ff66]/70"
                    >
                      <option value="">No role ping</option>
                      {attendanceAssignableRoles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block md:col-span-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-gray-500">
                      Reminder Message
                    </span>
                    <textarea
                      value={reminderMessage}
                      onChange={(event) => setReminderMessage(event.target.value)}
                      rows={3}
                      className="mt-2 w-full resize-none border border-[#00ff66]/25 bg-black/50 px-3 py-3 text-sm text-white outline-none focus:border-[#00ff66]/70"
                    />
                  </label>
                </div>
              )}
            </div>

            <label className="mt-4 block">
              <span className="text-xs uppercase tracking-[0.18em] text-gray-500">
                Description
              </span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="Optional message shown in the attendance embed..."
                className="mt-2 w-full resize-none border border-[#00ff66]/25 bg-black/50 px-3 py-3 text-sm text-white outline-none focus:border-[#00ff66]/70"
              />
            </label>

            <div className="mt-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-[#00ff66]">Reaction Options</h3>
                <button
                  type="button"
                  onClick={() =>
                    setOptions((current) => [
                      ...current,
                      {
                        emoji: emojiOptions[0]?.value || "1️⃣",
                        label: "Option",
                        assign_role_id: "",
                      },
                    ])
                  }
                  className="inline-flex items-center gap-2 border border-[#00ff66]/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#00ff66]"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>

              <div className="mt-3 grid gap-3">
                {options.map((option, index) => {
                  const selectedEmoji =
                    emojiOptions.find((emoji) => emoji.value === option.emoji) || {
                      label: option.emoji || "Current",
                      preview: option.emoji || "?",
                      value: option.emoji,
                      source: "base" as const,
                    };

                  return (
                    <div
                      key={option.id || `${option.emoji}-${index}`}
                      className="grid gap-2 md:grid-cols-[220px_minmax(0,1fr)_220px_44px]"
                    >
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenEmojiPickerIndex((current) =>
                              current === index ? null : index,
                            )
                          }
                          className="flex h-11 w-full items-center gap-3 border border-[#00ff66]/25 bg-black/50 px-3 text-left text-sm text-white outline-none transition hover:border-[#00ff66]/55"
                        >
                          <EmojiPreview emoji={selectedEmoji} className="h-7 w-7 shrink-0" />
                          <span className="truncate">{selectedEmoji.label}</span>
                        </button>
                      </div>

                      <input
                        value={option.label}
                        onChange={(event) => updateOption(index, { label: event.target.value })}
                        className="h-11 border border-[#00ff66]/25 bg-black/50 px-3 text-sm text-white outline-none focus:border-[#00ff66]/70"
                      />

                      <select
                        value={option.assign_role_id || ""}
                        onChange={(event) =>
                          updateOption(index, {
                            assign_role_id: event.target.value,
                          })
                        }
                        className="h-11 border border-[#00ff66]/25 bg-black/50 px-3 text-sm text-white outline-none focus:border-[#00ff66]/70"
                      >
                        <option value="">No role assignment</option>
                        {attendanceAssignableRoles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        className="grid h-11 place-items-center border border-red-500/30 text-red-300"
                        aria-label="Remove option"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={submitEvent}
              disabled={saving}
              className="mt-6 w-full border border-[#00ff66]/40 bg-[#00ff66]/10 px-4 py-3 text-sm font-bold uppercase tracking-[0.16em] text-[#00ff66] transition hover:bg-[#00ff66]/20 disabled:opacity-50"
            >
              {saving
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                  ? "Save Changes"
                  : "Create Attendance Message"}
            </button>
          </section>

          <aside className="border border-[#00ff66]/15 bg-black/35 p-5">
            <h2 className="text-2xl font-bold text-[#00ff66]">Scheduled</h2>
            <p className="mt-2 text-sm text-gray-400">
              {selectedChannel ? `Form channel: #${selectedChannel.name}` : "Select a channel"}
            </p>

            <div className="mt-5 space-y-3">
              {loading ? (
                <p className="text-sm text-gray-500">Loading attendance messages...</p>
              ) : events.length === 0 ? (
                <p className="text-sm text-gray-500">No attendance messages found.</p>
              ) : (
                events.map((event) => (
                  <div
                    key={event.id}
                    className={`w-full border p-4 text-left transition hover:border-[#00ff66]/60 hover:bg-[#00ff66]/10 ${
                      editingEventId === event.id
                        ? "border-[#00ff66]/70 bg-[#00ff66]/10"
                        : "border-[#00ff66]/15 bg-black/35"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-white">{event.title}</h3>
                        <p className="mt-1 text-xs text-gray-500">
                          #{event.channel_name || event.channel_id}
                        </p>
                      </div>
                      <span className="border border-[#00ff66]/20 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[#00ff66]">
                        {event.status}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-gray-400">
                      Event: {new Date(event.event_starts_at).toLocaleString()}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {event.repeat_enabled
                        ? formatWeeklySend(event.repeat_scheduled_send_at || event.scheduled_send_at)
                        : `Sends: ${new Date(event.scheduled_send_at).toLocaleString()}`}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-gray-600">
                      {event.repeat_enabled ? "Repeats weekly" : "One time"}
                    </p>

                    {event.options.length > 0 && (
                      <p className="mt-2 text-xs text-gray-500">
                        Options: {event.options.map((option) => option.label).join(", ")}
                      </p>
                    )}

                    {event.ping_role_id && (
                      <p className="mt-2 text-xs text-[#00ff66]/70">
                        Main ping: &lt;@&amp;{event.ping_role_id}&gt;
                      </p>
                    )}

                    {event.reminder_enabled && (
                      <p className="mt-1 text-xs text-amber-300/80">
                        Reminder:{" "}
                        {event.reminder_scheduled_at
                          ? new Date(event.reminder_scheduled_at).toLocaleString()
                          : "Not scheduled"}
                        {event.reminder_sent_at ? " · sent" : ""}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => loadEventForEdit(event)}
                        className="border border-[#00ff66]/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#00ff66] transition hover:bg-[#00ff66]/10"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteEvent(event)}
                        disabled={deletingEventId === event.id}
                        className="inline-flex items-center gap-2 border border-red-500/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deletingEventId === event.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>

      {openEmojiPickerIndex !== null && activeEmojiOption && activeSelectedEmoji && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-8 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Pick reaction emoji"
        >
          <div className="max-h-[86vh] w-full max-w-3xl overflow-hidden border border-[#00ff66]/35 bg-[#020704] shadow-2xl shadow-black">
            <div className="flex items-center justify-between gap-4 border-b border-[#00ff66]/20 px-5 py-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">
                  Reaction Icon
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <EmojiPreview emoji={activeSelectedEmoji} className="h-8 w-8 shrink-0" />
                  <span className="text-sm text-white">
                    {options[openEmojiPickerIndex]?.label || "Reaction option"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenEmojiPickerIndex(null)}
                className="grid h-10 w-10 place-items-center border border-[#00ff66]/25 text-[#00ff66] transition hover:bg-[#00ff66]/10"
                aria-label="Close emoji picker"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(86vh-96px)] overflow-y-auto p-5">
              {loadingEmojis ? (
                <div className="border border-[#00ff66]/15 bg-black/35 px-4 py-5 text-sm text-gray-500">
                  Loading emojis...
                </div>
              ) : (
                <>
                  {activeEmojiOption.emoji &&
                    !emojiOptions.some((emoji) => emoji.value === activeEmojiOption.emoji) && (
                      <button
                        type="button"
                        onClick={() => setOpenEmojiPickerIndex(null)}
                        className="mb-5 flex w-full items-center gap-3 border border-[#00ff66]/20 bg-black/40 px-4 py-3 text-left text-sm text-white"
                      >
                        <EmojiPreview
                          emoji={activeSelectedEmoji}
                          className="h-8 w-8 shrink-0"
                        />
                        <span className="truncate">Current: {activeEmojiOption.emoji}</span>
                      </button>
                    )}

                  <section>
                    <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-gray-500">
                      Base Numbers
                    </p>
                    <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-11">
                      {baseEmojiOptions.map((emoji) => (
                        <button
                          key={emoji.value}
                          type="button"
                          onClick={() => {
                            updateOption(openEmojiPickerIndex, { emoji: emoji.value });
                            setOpenEmojiPickerIndex(null);
                          }}
                          className="flex h-12 items-center justify-center border border-[#00ff66]/15 bg-black/40 text-white transition hover:border-[#00ff66]/60 hover:bg-[#00ff66]/10"
                          title={emoji.label}
                        >
                          <EmojiPreview emoji={emoji} />
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="mt-6">
                    <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-gray-500">
                      101st Server
                    </p>
                    {serverEmojiOptions.length === 0 ? (
                      <div className="border border-[#00ff66]/15 bg-black/35 px-4 py-5 text-sm text-gray-500">
                        No server emojis loaded.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                        {serverEmojiOptions.map((emoji) => (
                          <button
                            key={emoji.value}
                            type="button"
                            onClick={() => {
                              updateOption(openEmojiPickerIndex, { emoji: emoji.value });
                              setOpenEmojiPickerIndex(null);
                            }}
                            className="flex min-w-0 items-center gap-2 border border-[#00ff66]/15 bg-black/40 px-3 py-2 text-left text-xs text-white transition hover:border-[#00ff66]/60 hover:bg-[#00ff66]/10"
                            title={emoji.label}
                          >
                            <EmojiPreview emoji={emoji} className="h-8 w-8 shrink-0" />
                            <span className="truncate">{emoji.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
