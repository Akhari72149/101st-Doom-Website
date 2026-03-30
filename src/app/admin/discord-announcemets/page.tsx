"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { animate, stagger } from "animejs";
import { discordAnnouncementChannels } from "@/data/discordAnnouncementChannels";

type DiscordChannel = {
  id: string;
  name: string;
};

type Announcement = {
  id: string;
  title: string;
  message: string;
  channel_id: string;
  channel_name: string | null;
  scheduled_for: string;
  repeat_enabled: boolean;
  repeat_type: "none" | "daily" | "weekly" | "monthly" | "custom";
  repeat_interval_minutes: number | null;
  ping_role: boolean;
  ping_role_id: string | null;
  active: boolean;
  last_sent_at: string | null;
  created_at: string;
};

const ROLE_ID = "446542700951633923";
const DISCORD_MESSAGE_LIMIT = 2000;

const repeatOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom Minutes" },
] as const;

const listFilters = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "repeating", label: "Repeating" },
  { value: "one-time", label: "One-Time" },
] as const;

const sortOptions = [
  { value: "scheduled_asc", label: "Soonest First" },
  { value: "scheduled_desc", label: "Latest Scheduled" },
  { value: "created_desc", label: "Newest Created" },
  { value: "created_asc", label: "Oldest Created" },
  { value: "active_first", label: "Active First" },
] as const;

export default function DiscordAnnouncementsPage() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingPage, setLoadingPage] = useState(true);
  const [saving, setSaving] = useState(false);

  const [user, setUser] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [channelId, setChannelId] = useState("");

  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatType, setRepeatType] = useState<"daily" | "weekly" | "monthly" | "custom">("daily");
  const [repeatIntervalMinutes, setRepeatIntervalMinutes] = useState("60");
  const [pingRole, setPingRole] = useState(false);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [successPulse, setSuccessPulse] = useState(false);

  const [listFilter, setListFilter] = useState<"all" | "active" | "inactive" | "repeating" | "one-time">("all");
  const [listSearch, setListSearch] = useState("");
  const [sortBy, setSortBy] = useState<"scheduled_asc" | "scheduled_desc" | "created_desc" | "created_asc" | "active_first">("scheduled_asc");

  const [editingId, setEditingId] = useState<string | null>(null);

  const canAccess = useMemo(
    () => roles.includes("admin") || roles.includes("akhari"),
    [roles]
  );

  useEffect(() => {
    animate(".boot", {
      opacity: [0, 1],
      y: [20, 0],
      duration: 800,
      easing: "easeOutExpo",
      delay: stagger(80),
    });
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoadingAuth(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setUser(user);

      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const roleList = roleRows?.map((r: any) => r.role) || [];
      setRoles(roleList);

      if (!roleList.includes("admin") && !roleList.includes("logistics")) {
        router.replace("/");
        return;
      }

      setLoadingAuth(false);
    };

    init();
  }, [router]);

  useEffect(() => {
    if (!canAccess) return;

    const load = async () => {
      setLoadingPage(true);
      await fetchAnnouncements();
      setLoadingPage(false);
    };

    load();
  }, [canAccess]);

  useEffect(() => {
    if (!successPulse) return;

    const timer = setTimeout(() => {
      setSuccessPulse(false);
    }, 1800);

    return () => clearTimeout(timer);
  }, [successPulse]);

  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from("discord_announcements")
      .select("*")
      .order("scheduled_for", { ascending: true });

    if (error) {
      console.error("Failed to fetch announcements", error);
      return;
    }

    setAnnouncements((data || []) as Announcement[]);
  };

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setChannelId("");
    setScheduleEnabled(false);
    setScheduledFor("");
    setRepeatEnabled(false);
    setRepeatType("daily");
    setRepeatIntervalMinutes("60");
    setPingRole(false);
    setEditingId(null);
  };

const selectedChannel =
  discordAnnouncementChannels.find((c) => c.id === channelId) || null;

  const previewMessage = pingRole ? `<@&${ROLE_ID}> ${message}` : message;
  const previewLength = previewMessage.length;
  const isOverLimit = previewLength > DISCORD_MESSAGE_LIMIT;

  const selectedDate = scheduledFor ? new Date(scheduledFor) : null;
  const isPastTime =
    scheduleEnabled && !!selectedDate && selectedDate.getTime() < Date.now();

  const repeatSummary = useMemo(() => {
    if (!scheduleEnabled) {
      return "This announcement will send immediately when submit is pressed.";
    }

    if (!repeatEnabled) return "This announcement will send once only.";

    if (repeatType === "daily") return "This announcement will repeat every day.";
    if (repeatType === "weekly") return "This announcement will repeat every week.";
    if (repeatType === "monthly") return "This announcement will repeat every month.";

    const mins = Number(repeatIntervalMinutes);
    if (repeatType === "custom" && Number.isFinite(mins) && mins > 0) {
      return `This announcement will repeat every ${mins} minute${mins === 1 ? "" : "s"}.`;
    }

    return "This announcement is set to repeat.";
  }, [scheduleEnabled, repeatEnabled, repeatType, repeatIntervalMinutes]);


  const filteredAndSortedAnnouncements = useMemo(() => {
    let result = [...announcements];

    if (listFilter === "active") {
      result = result.filter((item) => item.active);
    } else if (listFilter === "inactive") {
      result = result.filter((item) => !item.active);
    } else if (listFilter === "repeating") {
      result = result.filter((item) => item.repeat_enabled);
    } else if (listFilter === "one-time") {
      result = result.filter((item) => !item.repeat_enabled);
    }

    const search = listSearch.trim().toLowerCase();
    if (search) {
      result = result.filter((item) => {
        const haystack = [
          item.title,
          item.message,
          item.channel_name || "",
          item.channel_id,
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(search);
      });
    }

    result.sort((a, b) => {
      if (sortBy === "scheduled_asc") {
        return new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime();
      }

      if (sortBy === "scheduled_desc") {
        return new Date(b.scheduled_for).getTime() - new Date(a.scheduled_for).getTime();
      }

      if (sortBy === "created_desc") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }

      if (sortBy === "created_asc") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }

      if (sortBy === "active_first") {
        if (a.active === b.active) {
          return new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime();
        }
        return a.active ? -1 : 1;
      }

      return 0;
    });

    return result;
  }, [announcements, listFilter, listSearch, sortBy]);

  const loadIntoEditor = (item: Announcement) => {
    setEditingId(item.id);
    setTitle(item.title);
    setMessage(item.message);
    setChannelId(item.channel_id);
    setScheduleEnabled(true);
    setScheduledFor(toDatetimeLocalValue(item.scheduled_for));
    setRepeatEnabled(item.repeat_enabled);
    setRepeatType(
      item.repeat_enabled
        ? item.repeat_type === "custom" ||
          item.repeat_type === "daily" ||
          item.repeat_type === "weekly" ||
          item.repeat_type === "monthly"
          ? item.repeat_type
          : "daily"
        : "daily"
    );
    setRepeatIntervalMinutes(String(item.repeat_interval_minutes ?? 60));
    setPingRole(item.ping_role);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleCreate = async () => {
    setStatusMessage(null);

    if (!title.trim()) {
      setStatusMessage("Please enter a title.");
      return;
    }

    if (!message.trim()) {
      setStatusMessage("Please enter a message.");
      return;
    }

    if (!channelId) {
      setStatusMessage("Please choose a Discord channel.");
      return;
    }

    if (scheduleEnabled && !scheduledFor) {
      setStatusMessage("Please choose a scheduled date and time.");
      return;
    }

    if (scheduleEnabled && isPastTime) {
      setStatusMessage("The selected scheduled time is in the past.");
      return;
    }

    if (scheduleEnabled && repeatEnabled && repeatType === "custom") {
      const mins = Number(repeatIntervalMinutes);
      if (!Number.isFinite(mins) || mins <= 0) {
        setStatusMessage("Custom repeat minutes must be greater than 0.");
        return;
      }
    }

    if (isOverLimit) {
      setStatusMessage(`Message preview exceeds Discord's ${DISCORD_MESSAGE_LIMIT} character limit.`);
      return;
    }

    setSaving(true);

    try {
      if (!scheduleEnabled && !editingId) {
        const res = await fetch("/api/discord-announcements/send-now", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: title.trim(),
            message: message.trim(),
            channel_id: channelId,
            channel_name: selectedChannel?.name || null,
            ping_role: pingRole,
            ping_role_id: pingRole ? ROLE_ID : null,
            created_by: user?.id || null,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setStatusMessage(data?.error || "Failed to send announcement.");
          setSaving(false);
          return;
        }

        setStatusMessage("Announcement sent successfully.");
        setSuccessPulse(true);
        resetForm();
        setSaving(false);
        return;
      }

      const res = await fetch("/api/discord-announcements", {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingId,
          title: title.trim(),
          message: message.trim(),
          channel_id: channelId,
          channel_name: selectedChannel?.name || null,
          scheduled_for: new Date(scheduledFor).toISOString(),
          repeat_enabled: repeatEnabled,
          repeat_type: repeatEnabled ? repeatType : "none",
          repeat_interval_minutes:
            repeatEnabled && repeatType === "custom"
              ? Number(repeatIntervalMinutes)
              : null,
          ping_role: pingRole,
          ping_role_id: pingRole ? ROLE_ID : null,
          created_by: user?.id || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatusMessage(data?.error || `Failed to ${editingId ? "update" : "create"} announcement.`);
        setSaving(false);
        return;
      }

      setStatusMessage(editingId ? "Announcement updated successfully." : "Announcement created successfully.");
      setSuccessPulse(true);
      resetForm();
      await fetchAnnouncements();
    } catch (err) {
      console.error(err);
      setStatusMessage(
        `Something went wrong while ${!scheduleEnabled && !editingId ? "sending" : editingId ? "updating" : "saving"}.`
      );
    }

    setSaving(false);
  };

  const toggleActive = async (item: Announcement) => {
    const { error } = await supabase
      .from("discord_announcements")
      .update({ active: !item.active })
      .eq("id", item.id);

    if (error) {
      console.error("Failed to toggle active state", error);
      return;
    }

    await fetchAnnouncements();
  };

  const deleteAnnouncement = async (id: string) => {
    const confirmed = window.confirm("Delete this announcement?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("discord_announcements")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Failed to delete announcement", error);
      return;
    }

    if (editingId === id) {
      resetForm();
    }

    await fetchAnnouncements();
  };

  const applyQuickTime = (mode: "10m" | "30m" | "tonight" | "tomorrow18" | "nextSunday18") => {
    const now = new Date();
    const date = new Date(now);

    if (mode === "10m") {
      date.setMinutes(date.getMinutes() + 10);
    }

    if (mode === "30m") {
      date.setMinutes(date.getMinutes() + 30);
    }

    if (mode === "tonight") {
      date.setHours(19, 0, 0, 0);
      if (date.getTime() <= now.getTime()) {
        date.setDate(date.getDate() + 1);
        date.setHours(19, 0, 0, 0);
      }
    }

    if (mode === "tomorrow18") {
      date.setDate(date.getDate() + 1);
      date.setHours(18, 0, 0, 0);
    }

    if (mode === "nextSunday18") {
      const currentDay = date.getDay();
      const daysUntilSunday = ((7 - currentDay) % 7) || 7;
      date.setDate(date.getDate() + daysUntilSunday);
      date.setHours(18, 0, 0, 0);
    }

    setScheduledFor(toDatetimeLocalValue(date.toISOString()));
  };

  if (loadingAuth || loadingPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-[#00ff66] font-orbitron">
        Loading announcement console...
      </div>
    );
  }

  return (
    <div className="boot relative min-h-screen text-white font-orbitron overflow-hidden">
      <div
        className="absolute inset-0 bg-center bg-no-repeat bg-cover opacity-20 pointer-events-none z-0"
        style={{ backgroundImage: "url('/background/bg.jpg')" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#001f11_0%,#000a06_100%)] z-0" />

      <img
        src="/background/bg.jpg"
        alt="Logo"
        className="absolute top-1 left-1/2 -translate-x-1/2 translate-x-[-135px] w-48 opacity-90 z-20"
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-36 pb-16">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-[0.25em] text-[#00ff66]">
              DISCORD
              <br />
              ANNOUNCEMENTS
            </h1>
            <p className="mt-4 text-gray-300">
              Send instantly or schedule bot announcements to a chosen channel.
            </p>
          </div>

          <button
            onClick={() => router.push("/pcs")}
            className="px-6 py-3 border border-[#00ff66] rounded-xl text-[#00ff66] hover:bg-[#00ff66] hover:text-black transition-all"
          >
            Back
          </button>
        </div>

        {statusMessage && (
          <div
            className={`mb-6 rounded-2xl border px-5 py-4 text-sm transition-all ${
              successPulse
                ? "border-[#00ff66] bg-[#00ff66]/15 text-[#b6ffd5] shadow-[0_0_30px_rgba(0,255,102,0.25)] animate-pulse"
                : "border-[#00ff66]/30 bg-black/60 text-gray-200"
            }`}
          >
            {statusMessage}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-8">
          <div
            className={`rounded-2xl border bg-black/50 backdrop-blur-xl p-6 transition-all ${
              successPulse
                ? "border-[#00ff66] shadow-[0_0_35px_rgba(0,255,100,0.22)]"
                : "border-[#00ff66]/30 shadow-[0_0_30px_rgba(0,255,100,0.15)]"
            }`}
          >
            <div className="flex items-center justify-between gap-4 mb-6">
              <h2 className="text-2xl text-[#00ff66] tracking-widest">
                {editingId ? "Edit Announcement" : "Create Announcement"}
              </h2>

              {editingId && (
                <button
                  onClick={resetForm}
                  className="px-4 py-2 rounded-lg border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/15 transition-all text-sm"
                >
                  Exit Edit Mode
                </button>
              )}
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm text-[#00ff66] mb-2">
                  Title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Main op reminder"
                  className="w-full rounded-xl border border-[#00ff66]/30 bg-black/60 px-4 py-3 text-white outline-none focus:border-[#00ff66]"
                />
              </div>

              <div>
  <label className="block text-sm text-[#00ff66] mb-2">
    Discord Channel
  </label>

  <select
    value={channelId}
    onChange={(e) => setChannelId(e.target.value)}
    className="w-full rounded-xl border border-[#00ff66]/30 bg-black/60 px-4 py-3 text-white outline-none focus:border-[#00ff66]"
  >
    <option value="">Select a channel...</option>
    {discordAnnouncementChannels.map((channel) => (
      <option key={channel.id} value={channel.id}>
        #{channel.name}
      </option>
    ))}
  </select>

  <p className="mt-2 text-xs text-gray-400">
    Only approved announcement channels are shown here.
  </p>
</div>

              <div className="rounded-2xl border border-[#00ff66]/25 bg-black/40 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[#00ff66] font-semibold">
                      Schedule Message
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      Turn on to store and schedule this announcement.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const next = !scheduleEnabled;
                      setScheduleEnabled(next);

                      if (!next) {
                        setScheduledFor("");
                        setRepeatEnabled(false);
                        setRepeatType("daily");
                        setRepeatIntervalMinutes("60");
                      }
                    }}
                    className={`relative w-16 h-9 rounded-full transition-all ${
                      scheduleEnabled ? "bg-[#00ff66]/80" : "bg-gray-700"
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-7 h-7 rounded-full bg-white transition-all ${
                        scheduleEnabled ? "left-8" : "left-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {scheduleEnabled && (
                <div>
                  <label className="block text-sm text-[#00ff66] mb-2">
                    Scheduled Time
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    className={`w-full rounded-xl border bg-black/60 px-4 py-3 text-white outline-none ${
                      isPastTime
                        ? "border-red-500/70 focus:border-red-400"
                        : "border-[#00ff66]/30 focus:border-[#00ff66]"
                    }`}
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <QuickButton label="In 10 mins" onClick={() => applyQuickTime("10m")} />
                    <QuickButton label="In 30 mins" onClick={() => applyQuickTime("30m")} />
                    <QuickButton label="Tonight 19:00" onClick={() => applyQuickTime("tonight")} />
                    <QuickButton label="Tomorrow 18:00" onClick={() => applyQuickTime("tomorrow18")} />
                    <QuickButton label="Next Sunday 18:00" onClick={() => applyQuickTime("nextSunday18")} />
                  </div>

                  {isPastTime ? (
                    <p className="mt-2 text-xs text-red-400">
                      Warning: the selected scheduled time is in the past.
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-gray-400">
                      This uses the browser’s local timezone when picked, then saves as UTC.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm text-[#00ff66] mb-2">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={8}
                  placeholder="Type the announcement your bot should send..."
                  className="w-full rounded-xl border border-[#00ff66]/30 bg-black/60 px-4 py-3 text-white outline-none focus:border-[#00ff66] resize-y"
                />
                <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                  <span className="text-gray-400">
                    Discord message length counter
                  </span>
                  <span className={isOverLimit ? "text-red-400" : "text-[#00ff66]"}>
                    {previewLength} / {DISCORD_MESSAGE_LIMIT}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-[#00ff66]/25 bg-black/40 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[#00ff66] font-semibold">
                      Ping Announcement Role
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      Add the role mention at the very start of the message.
                    </div>
                    <div className="text-xs text-gray-500 mt-2 break-all">
                      Role ID: {ROLE_ID}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPingRole((prev) => !prev)}
                    className={`relative w-16 h-9 rounded-full transition-all ${
                      pingRole ? "bg-[#00ff66]/80" : "bg-gray-700"
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-7 h-7 rounded-full bg-white transition-all ${
                        pingRole ? "left-8" : "left-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {scheduleEnabled && (
                <div className="rounded-2xl border border-[#00ff66]/25 bg-black/40 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[#00ff66] font-semibold">
                        Repeat Message
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        Enable this if the bot should resend the message automatically.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setRepeatEnabled((prev) => !prev)}
                      className={`relative w-16 h-9 rounded-full transition-all ${
                        repeatEnabled ? "bg-[#00ff66]/80" : "bg-gray-700"
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-7 h-7 rounded-full bg-white transition-all ${
                          repeatEnabled ? "left-8" : "left-1"
                        }`}
                      />
                    </button>
                  </div>

                  {repeatEnabled && (
                    <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-[#00ff66] mb-2">
                          Repeat Type
                        </label>
                        <select
                          value={repeatType}
                          onChange={(e) =>
                            setRepeatType(
                              e.target.value as "daily" | "weekly" | "monthly" | "custom"
                            )
                          }
                          className="w-full rounded-xl border border-[#00ff66]/30 bg-black/60 px-4 py-3 text-white outline-none focus:border-[#00ff66]"
                        >
                          {repeatOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {repeatType === "custom" && (
                        <div>
                          <label className="block text-sm text-[#00ff66] mb-2">
                            Custom Interval (Minutes)
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={repeatIntervalMinutes}
                            onChange={(e) => setRepeatIntervalMinutes(e.target.value)}
                            className="w-full rounded-xl border border-[#00ff66]/30 bg-black/60 px-4 py-3 text-white outline-none focus:border-[#00ff66]"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4 rounded-xl border border-[#00ff66]/20 bg-black/50 px-4 py-3 text-sm text-gray-200">
                    {repeatSummary}
                  </div>
                </div>
              )}

              {!scheduleEnabled && (
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 px-4 py-3 text-sm text-blue-200">
                  This will send instantly when you press submit and will not be stored in Supabase.
                </div>
              )}

              <div className="rounded-2xl border border-[#5865F2]/30 bg-[#5865F2]/5 p-4">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="text-[#c9d2ff] font-semibold text-lg">
                    Discord Preview
                  </div>
                  <div className="text-xs text-gray-400">
                    Final rendered frontend preview
                  </div>
                </div>

                <div className="rounded-xl border border-[#5865F2]/20 bg-[#1e1f22] p-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="text-white font-semibold">
                        {title.trim() || "Untitled Announcement"}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {selectedChannel ? `#${selectedChannel.name}` : "No channel selected yet"}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-end">
                      <Badge text={pingRole ? "Role Ping" : "No Ping"} tone={pingRole ? "green" : "gray"} />
                      <Badge text={scheduleEnabled ? "Scheduled" : "Send Now"} tone={scheduleEnabled ? "blue" : "green"} />
                      {scheduleEnabled && (
                        <Badge text={repeatEnabled ? "Repeating" : "One-Time"} tone={repeatEnabled ? "blue" : "gray"} />
                      )}
                      {isPastTime && <Badge text="Past Time" tone="red" />}
                    </div>
                  </div>

                  <div className="text-xs text-gray-400 mb-3">
                    {scheduleEnabled
                      ? scheduledFor
                        ? `Scheduled for ${new Date(scheduledFor).toLocaleString()}`
                        : "No scheduled time selected yet"
                      : "Will send immediately when submitted"}
                  </div>

                  <div className="rounded-lg bg-black/40 border border-white/5 px-4 py-3 text-sm text-gray-100 whitespace-pre-wrap break-words min-h-[110px]">
                    {previewMessage.trim() ? (
                      previewMessage
                    ) : (
                      <span className="text-gray-500">
                        Your announcement preview will appear here once you begin typing.
                      </span>
                    )}
                  </div>

                  <div className="mt-3 text-xs text-gray-400">
                    {repeatSummary}
                  </div>
                </div>
              </div>

              <button
                onClick={handleCreate}
                disabled={saving}
                className="w-full px-6 py-3 rounded-xl border border-[#00ff66] text-[#00ff66] hover:bg-[#00ff66] hover:text-black transition-all disabled:opacity-50"
              >
                {saving
                  ? !scheduleEnabled && !editingId
                    ? "Sending..."
                    : editingId
                    ? "Updating..."
                    : "Saving..."
                  : !scheduleEnabled && !editingId
                  ? "Send Announcement Now"
                  : editingId
                  ? "Update Announcement"
                  : "Create Scheduled Announcement"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#00ff66]/30 bg-black/50 backdrop-blur-xl p-6 shadow-[0_0_30px_rgba(0,255,100,0.15)]">
            <h2 className="text-2xl text-[#00ff66] tracking-widest mb-6">
              Existing Announcements
            </h2>

            <div className="space-y-4 mb-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  placeholder="Search title, message, or channel..."
                  className="w-full rounded-xl border border-[#00ff66]/30 bg-black/60 px-4 py-3 text-white outline-none focus:border-[#00ff66]"
                />

                <select
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(
                      e.target.value as "scheduled_asc" | "scheduled_desc" | "created_desc" | "created_asc" | "active_first"
                    )
                  }
                  className="w-full rounded-xl border border-[#00ff66]/30 bg-black/60 px-4 py-3 text-white outline-none focus:border-[#00ff66]"
                >
                  {sortOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      Sort: {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-2">
                {listFilters.map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setListFilter(filter.value)}
                    className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                      listFilter === filter.value
                        ? "border-[#00ff66] bg-[#00ff66]/15 text-[#00ff66]"
                        : "border-[#00ff66]/25 text-gray-300 hover:border-[#00ff66]/50 hover:text-white"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredAndSortedAnnouncements.length === 0 ? (
              <div className="rounded-xl border border-[#00ff66]/20 bg-black/40 p-6 text-gray-400">
                No announcements match the current filters.
              </div>
            ) : (
              <div className="space-y-4 max-h-[900px] overflow-y-auto pr-1">
                {filteredAndSortedAnnouncements.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-4 transition-all ${
                      editingId === item.id
                        ? "border-yellow-500/60 bg-yellow-500/5 shadow-[0_0_18px_rgba(234,179,8,0.15)]"
                        : "border-[#00ff66]/25 bg-black/55 hover:border-[#00ff66]/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-lg text-[#00ff66] font-semibold">
                          {item.title}
                        </div>
                        <div className="text-sm text-gray-400 mt-1">
                          #{item.channel_name || item.channel_id}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 justify-end">
                        <Badge text={item.active ? "ACTIVE" : "INACTIVE"} tone={item.active ? "green" : "red"} />
                        <Badge text={item.repeat_enabled ? "REPEATING" : "ONE-TIME"} tone={item.repeat_enabled ? "blue" : "gray"} />
                        {item.ping_role && <Badge text="ROLE PING" tone="purple" />}
                        {item.last_sent_at && <Badge text="SENT BEFORE" tone="yellow" />}
                        {editingId === item.id && <Badge text="EDITING" tone="yellow" />}
                      </div>
                    </div>

                    <div className="mt-3 text-sm text-gray-200 whitespace-pre-wrap break-words">
                      {item.ping_role && item.ping_role_id ? `<@&${item.ping_role_id}> ` : ""}
                      {item.message}
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-400">
                      <div>
                        Scheduled: {new Date(item.scheduled_for).toLocaleString()}
                      </div>
                      <div>
                        Repeat:{" "}
                        {item.repeat_enabled
                          ? item.repeat_type === "custom"
                            ? `Every ${item.repeat_interval_minutes} minutes`
                            : item.repeat_type
                          : "No"}
                      </div>
                      <div>
                        Ping role: {item.ping_role ? "Yes" : "No"}
                      </div>
                      <div>
                        Last sent:{" "}
                        {item.last_sent_at
                          ? new Date(item.last_sent_at).toLocaleString()
                          : "Never"}
                      </div>
                      <div>
                        Created: {new Date(item.created_at).toLocaleString()}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        onClick={() => loadIntoEditor(item)}
                        className="px-4 py-2 rounded-lg border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/15 transition-all text-sm"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => toggleActive(item)}
                        className="px-4 py-2 rounded-lg border border-[#00ff66]/40 text-[#00ff66] hover:bg-[#00ff66] hover:text-black transition-all text-sm"
                      >
                        {item.active ? "Disable" : "Enable"}
                      </button>

                      <button
                        onClick={() => deleteAnnouncement(item.id)}
                        className="px-4 py-2 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white transition-all text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-2 rounded-lg border border-[#00ff66]/30 bg-black/40 text-sm text-[#00ff66] hover:bg-[#00ff66]/10 transition-all"
    >
      {label}
    </button>
  );
}

function Badge({
  text,
  tone,
}: {
  text: string;
  tone: "green" | "red" | "blue" | "gray" | "purple" | "yellow";
}) {
  const styles = {
    green: "border-green-500/40 text-green-400 bg-green-500/10",
    red: "border-red-500/40 text-red-400 bg-red-500/10",
    blue: "border-blue-500/40 text-blue-300 bg-blue-500/10",
    gray: "border-gray-500/30 text-gray-300 bg-gray-500/10",
    purple: "border-purple-500/40 text-purple-300 bg-purple-500/10",
    yellow: "border-yellow-500/40 text-yellow-300 bg-yellow-500/10",
  };

  return (
    <div className={`text-[10px] px-3 py-1 rounded-full border ${styles[tone]}`}>
      {text}
    </div>
  );
}

function toDatetimeLocalValue(isoString: string) {
  const date = new Date(isoString);
  const pad = (num: number) => String(num).padStart(2, "0");

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}