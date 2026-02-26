"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { hasRole } from "@/lib/permissions";

type Booking = {
  id: string;
  server_id: number;
  start_time: string;
  end_time: string;
  title: string;
  booked_for: string;
  personnel?: {
    name: string;
  };
};

export default function ServersPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [canBook, setCanBook] = useState(false);

  const [activeServer, setActiveServer] = useState(1);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const today = new Date();
  const localDate = today.getFullYear() + "-" +
        String(today.getMonth() + 1).padStart(2, "0") + "-" +
        String(today.getDate()).padStart(2, "0");

  const [selectedDate, setSelectedDate] = useState(localDate);
  const [selectedStartIndex, setSelectedStartIndex] =
    useState<number | null>(null);

  const [durationHours, setDurationHours] = useState<1 | 2>(1);

  const [personnelList, setPersonnelList] = useState<any[]>([]);
  const [selectedPerson, setSelectedPerson] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [bookingTitle, setBookingTitle] = useState("");

  const slots = generateSlots(selectedDate);

  const filteredPersonnel = personnelList.filter((person) =>
    person.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /* ================= AUTH ================= */

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);
      if (!user) return;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const roleList = roles?.map((r) => r.role) || [];

      if (hasRole(roleList, ["zeus"])) {
        setCanBook(true);
      }
    };

    loadUser();
  }, []);

  useEffect(() => {
    supabase
      .from("personnel")
      .select("id,name")
      .then(({ data }) => setPersonnelList(data || []));
  }, []);

  useEffect(() => {
    fetchBookings();

    const channel = supabase
      .channel("server-bookings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "server_bookings" },
        () => fetchBookings()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeServer, selectedDate]);

async function fetchBookings() {
const start = new Date(selectedDate + "T00:00:00");

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  /* ================= NORMAL BOOKINGS ================= */

  const { data: bookingData } = await supabase
    .from("server_bookings")
    .select("*")
    .eq("server_id", activeServer)
    .gte("start_time", start.toISOString())
    .lt("start_time", end.toISOString());

  const personnelIds = [
    ...new Set((bookingData || []).map((b) => b.booked_for)),
  ];

  const { data: personnelData } = await supabase
    .from("personnel")
    .select("id,name")
    .in("id", personnelIds);

  const map = Object.fromEntries(
    (personnelData || []).map((p) => [p.id, p.name])
  );

  const enriched = (bookingData || []).map((b) => ({
    ...b,
    personnel: { name: map[b.booked_for] || "Unknown" },
  }));

  /* ================= RECURRING BLOCKS ================= */

  const weekday = new Date(selectedDate).getDay();

  const { data: recurring } = await supabase
    .from("recurring_server_blocks")
    .select("*")
    .eq("server_id", activeServer)
    .eq("weekday", weekday);

  const recurringBookings = (recurring || []).map((r) => {
    const start = new Date(selectedDate);
    const [startH, startM] = r.start_time.split(":");
    start.setHours(Number(startH), Number(startM), 0, 0);

    const end = new Date(selectedDate);
    const [endH, endM] = r.end_time.split(":");
    end.setHours(Number(endH), Number(endM), 0, 0);

    return {
      id: `recurring-${r.id}`,
      server_id: r.server_id,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      title: r.title,
      booked_for: "SYSTEM",
      personnel: { name: "Blocked" },
    };
  });

  /* ================= MERGE ================= */

  setBookings([...(enriched as any), ...recurringBookings]);
}

  function isBlocked(slot: Date) {
    return bookings.some((b) => {
      const slotEnd = new Date(slot.getTime() + 30 * 60 * 1000);
      const bookingStart = new Date(b.start_time);
      const bookingEnd = new Date(b.end_time);
      return slot < bookingEnd && slotEnd > bookingStart;
    });
  }

  async function handleDelete(id: string) {
    if (!canBook) return;

    const old = bookings;
    setBookings((prev) => prev.filter((b) => b.id !== id));

    const { error } = await supabase
      .from("server_bookings")
      .delete()
      .eq("id", id);

    if (error) {
      setBookings(old);
      alert(error.message);
    }
  }

  async function handleConfirmBooking() {
    if (!canBook || selectedStartIndex === null || !selectedPerson)
      return;

    const start = slots[selectedStartIndex];
    const end = new Date(
      start.getTime() + durationHours * 60 * 60 * 1000
    );

    const { error } = await supabase.from("server_bookings").insert([
      {
        server_id: activeServer,
        user_id: user.id,
        booked_for: selectedPerson,
        title: bookingTitle,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      },
    ]);

    

    setSelectedStartIndex(null);
    setSelectedPerson("");
    setSearchQuery("");
    setBookingTitle("");
    setShowResults(false);
    setDurationHours(1);

    fetchBookings();
  }

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_center,#001f11_0%,#000a06_100%)] text-white p-10">

      <button
        onClick={() => router.push("/pcs")}
        className="mb-8 px-4 py-2 rounded-lg border border-[#00ff66]/50 text-[#00ff66] backdrop-blur-md transition-all duration-200 hover:bg-[#00ff66]/10 hover:scale-105"
      >
        ← Back
      </button>

      <h1 className="text-4xl font-bold mb-10 text-[#00ff66] tracking-[0.4em]">
        SERVER BOOKINGS
      </h1>

      <input
        type="date"
        value={selectedDate}
        onChange={(e) => setSelectedDate(e.target.value)}
        className="mb-8 p-3 rounded-xl bg-black/40 border border-[#00ff66]/40 text-[#00ff66]"
      />

      {/* SERVER TABS RESTORED */}
      <div className="flex gap-4 mb-10 flex-wrap">
        {[1, 2, 3, 4, 5, 6].map((server) => (
          <div
            key={server}
            onClick={() => setActiveServer(server)}
            className={`px-6 py-3 rounded-xl cursor-pointer border transition-all duration-200 ${
              activeServer === server
                ? "bg-[#00ff66]/20 border-[#00ff66] text-[#00ff66] scale-105 shadow-[0_0_20px_rgba(0,255,100,0.4)]"
                : "border-[#00ff66]/30 hover:bg-[#00ff66]/10 hover:scale-105"
            }`}
          >
            SERVER {server}
          </div>
        ))}
      </div>

      {/* SLOTS */}
      <div className="max-w-6xl grid grid-cols-4 gap-4">
        {slots.map((slot, index) => {
          const blocked = isBlocked(slot);
          const durationSlots = durationHours * 2;

          const isSelected =
            selectedStartIndex !== null &&
            index >= selectedStartIndex &&
            index < selectedStartIndex + durationSlots;

          return (
            <div
              key={slot.toISOString()}
              onClick={() => {
                if (!blocked && canBook) {
                  setSelectedStartIndex(index);
                }
              }}
              className={`p-6 rounded-2xl border transition-all duration-200 ${
                blocked
                  ? "bg-black/50 border-[#00ff66]/30"
                  : isSelected
                  ? "bg-[#003d14] border-[#00ff66] scale-105 shadow-[0_0_20px_rgba(0,255,100,0.4)]"
                  : "bg-black/40 border-[#00ff66]/20 hover:border-[#00ff66] hover:scale-105"
              }`}
            >
              <div className="text-xl font-bold text-[#00ff66]">
                {slot.toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>


              {bookings
                .filter((b) => {
                  const slotEnd = new Date(
                    slot.getTime() + 30 * 60 * 1000
                  );
                  const bookingStart = new Date(b.start_time);
                  const bookingEnd = new Date(b.end_time);
                  return slot < bookingEnd && slotEnd > bookingStart;
                })
                .map((b) => (
                  <div
                    key={b.id}
                    className="mt-4 p-4 rounded-xl bg-black/60 border border-[#00ff66]"
                  >
                    <div className="text-[#00ff66] font-semibold">
                      {b.personnel?.name}
                    </div>
                    <div className="text-gray-300 text-sm">
                      {b.title}
                    </div>

                    {canBook && !b.id.startsWith("recurring-") && (
                      <button
                        onClick={() => handleDelete(b.id)}
                        className="mt-2 text-sm text-red-400 hover:text-red-300"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                ))}
            </div>
          );
        })}
      </div>

      {/* CONFIRM PANEL */}
      {selectedStartIndex !== null && canBook && (
        <div className="fixed bottom-10 right-10 w-96 p-6 rounded-2xl bg-black/80 border border-[#00ff66] shadow-[0_0_40px_rgba(0,255,100,0.3)]">

          <h2 className="mb-4 text-lg text-[#00ff66]">
            Booking:
            <span className="font-bold ml-2">
              {slots[selectedStartIndex].toLocaleTimeString(undefined, {
  hour: "2-digit",
  minute: "2-digit",
})}
 →
{new Date(
  slots[selectedStartIndex].getTime() +
    durationHours * 60 * 60 * 1000
).toLocaleTimeString(undefined, {
  hour: "2-digit",
  minute: "2-digit",
})}
            </span>
          </h2>

          {/* PERSON SEARCH */}
          <div className="relative mb-4">
            <input
              placeholder="Search personnel..."
              value={searchQuery}
              onFocus={() => setShowResults(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowResults(true);
              }}
              className="w-full p-3 rounded-xl bg-black border border-[#00ff66] text-white"
            />

            {showResults && searchQuery && (
              <div className="absolute z-50 w-full mt-2 max-h-60 overflow-y-auto bg-black/90 border border-[#00ff66] rounded-xl">
                {filteredPersonnel.map((person) => (
                  <div
                    key={person.id}
                    onClick={() => {
                      setSelectedPerson(person.id);
                      setSearchQuery(person.name);
                      setShowResults(false);
                    }}
                    className="p-3 cursor-pointer hover:bg-[#00ff66] hover:text-black transition"
                  >
                    {person.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DURATION */}
          <div className="mb-4">
            <label className="block mb-2 text-sm text-[#00ff66]">
              Duration
            </label>
            <select
              value={durationHours}
              onChange={(e) =>
                setDurationHours(Number(e.target.value) as 1 | 2)
              }
              className="w-full p-3 rounded-xl bg-black border border-[#00ff66] text-white"
            >
              <option value={1}>1 Hour</option>
              <option value={2}>2 Hours</option>
            </select>
          </div>

          <input
            placeholder="Booking Title"
            value={bookingTitle}
            onChange={(e) => setBookingTitle(e.target.value)}
            className="w-full p-3 mb-4 rounded-xl bg-black border border-[#00ff66] text-white"
          />

          <div className="flex gap-3">
            <button
              onClick={handleConfirmBooking}
              className="px-4 py-2 rounded-xl bg-[#00ff66] text-black font-semibold hover:scale-105 transition"
            >
              Confirm
            </button>

            <button
              onClick={() => {
                setSelectedStartIndex(null);
                setSelectedPerson("");
                setSearchQuery("");
                setBookingTitle("");
                setShowResults(false);
                setDurationHours(1);
              }}
              className="px-4 py-2 rounded-xl border border-red-500 text-red-400 hover:bg-red-500 hover:text-black transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function generateSlots(dateString: string) {
  const slots: Date[] = [];
  const base = new Date(dateString);
  base.setHours(0, 0, 0, 0);

  for (let i = 0; i < 48; i++) {
    slots.push(new Date(base.getTime() + i * 30 * 60 * 1000));
  }

  return slots;
}