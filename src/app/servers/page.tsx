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
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [selectedStartIndex, setSelectedStartIndex] =
    useState<number | null>(null);

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
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

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

    setBookings(enriched as any);
  }

  async function handleConfirmBooking() {
    if (!canBook) return;
    if (!user || selectedStartIndex === null || !selectedPerson) return;

    const start = slots[selectedStartIndex];
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const tempId = crypto.randomUUID();

    const newBooking: Booking = {
      id: tempId,
      server_id: activeServer,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      title: bookingTitle,
      booked_for: selectedPerson,
      personnel: {
        name:
          personnelList.find((p) => p.id === selectedPerson)?.name ||
          "Unknown",
      },
    };

    setBookings((prev) => [...prev, newBooking]);

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

    if (error) {
      setBookings((prev) => prev.filter((b) => b.id !== tempId));
      alert(error.message);
    } else {
      setSelectedStartIndex(null);
      setSelectedPerson("");
      setSearchQuery("");
      setBookingTitle("");
      setShowResults(false);
    }
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

  function isBlocked(slot: Date) {
    return bookings.some((b) => {
      const slotEnd = new Date(slot.getTime() + 30 * 60 * 1000);
      const bookingStart = new Date(b.start_time);
      const bookingEnd = new Date(b.end_time);
      return slot < bookingEnd && slotEnd > bookingStart;
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#001200] via-[#002700] to-[#000a00] text-white p-10">

      {/* BACK BUTTON */}
      <button
        onClick={() => router.push("/pcs")}
        className="mb-6 border border-[#00ff4c] px-4 py-2 hover:bg-[#00ff4c] hover:text-black transition"
      >
        ← Return to Dashboard
      </button>

      {/* DATE */}
      <div className="mb-8">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="bg-black border border-[#00ff4c] p-3 rounded-xl"
        />
      </div>

      {/* SERVER SELECT */}
      <div className="flex gap-4 mb-8 flex-wrap">
        {[1, 2, 3, 4, 5, 6].map((server) => (
          <div
            key={server}
            onClick={() => setActiveServer(server)}
            className={`px-6 py-3 cursor-pointer border border-[#00ff4c] rounded-md ${
              activeServer === server
                ? "bg-[#003d14] border border-[#00ff4c] text-[#00ff4c] scale-105 shadow-[0_0_15px_rgba(0,255,80,0.3)]"
                : "text-[#00ff4c] hover:bg-[#00ff4c] hover:text-black"
            }`}
          >
            SERVER-{server}
          </div>
        ))}
      </div>

      {/* SLOTS */}
      <div className="max-w-3xl grid gap-5">
        {slots.map((slot, index) => {
          const blocked = isBlocked(slot);
          const isSelected =
            selectedStartIndex !== null &&
            index >= selectedStartIndex &&
            index <= selectedStartIndex + 3;

          return (
            <div
              key={slot.toISOString()}
              onClick={() => {
                if (!blocked && canBook) {
                  setSelectedStartIndex(index);
                }
              }}
              className={`p-6 rounded-2xl transition-all ${
                blocked
                  ? "bg-black/40 border border-[#00ff4c]"
                  : isSelected
                  ? "bg-[#003d14] border border-[#00ff4c] text-[#00ff4c] scale-105 shadow-[0_0_15px_rgba(0,255,80,0.3)]"
                  : "bg-black/40 border border-[#00ff4c]/40 hover:border-[#00ff4c] hover:scale-105"
              } ${!canBook ? "cursor-default" : "cursor-pointer"}`}
            >
              <div className="text-xl font-bold">
                {slot.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>

              {bookings
                .filter((b) => {
                  const slotEnd = new Date(slot.getTime() + 30 * 60 * 1000);
                  const bookingStart = new Date(b.start_time);
                  const bookingEnd = new Date(b.end_time);
                  return slot < bookingEnd && slotEnd > bookingStart;
                })
                .map((b) => (
                  <div
                    key={b.id}
                    className="mt-3 p-4 rounded-xl bg-black/60 border border-[#00ff4c]"
                  >
                    <div className="text-[#00ff4c] font-semibold text-lg">
                      {b.personnel?.name}
                    </div>
                    <div className="text-gray-300">{b.title}</div>

                    {canBook && (
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
        <div className="fixed bottom-10 right-10 z-50 bg-black/90 backdrop-blur-xl border border-[#00ff4c] p-6 rounded-2xl w-96">
          <div className="text-lg mb-4">
            Booking from{" "}
            <span className="text-[#00ff4c] font-bold">
              {slots[selectedStartIndex].toLocaleTimeString()} →
              {slots[selectedStartIndex + 3]?.toLocaleTimeString()}
            </span>
          </div>

          <input
            placeholder="Booking Title"
            value={bookingTitle}
            onChange={(e) => setBookingTitle(e.target.value)}
            className="w-full bg-black border border-[#00ff4c] p-3 rounded-xl mb-4 text-white"
          />

          <div className="relative mb-4">
            <input
              placeholder="Search personnel..."
              value={searchQuery}
              onFocus={() => setShowResults(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowResults(true);
              }}
              className="w-full bg-black border border-[#00ff4c] p-3 rounded-xl text-white"
            />

            {showResults && searchQuery && (
              <div className="absolute z-[9999] w-full bg-black border border-[#00ff4c] rounded-xl mt-2 max-h-60 overflow-y-auto">
                {filteredPersonnel.length === 0 && (
                  <div className="p-3 text-gray-400">No results</div>
                )}
                {filteredPersonnel.map((person) => (
                  <div
                    key={person.id}
                    onClick={() => {
                      setSelectedPerson(person.id);
                      setSearchQuery(person.name);
                      setShowResults(false);
                    }}
                    className="p-3 hover:bg-[#00ff4c] hover:text-black cursor-pointer transition"
                  >
                    {person.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleConfirmBooking}
              className="px-6 py-3 border border-[#00ff4c] text-[#00ff4c] rounded-xl hover:bg-[#00ff4c] hover:text-black transition"
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
              }}
              className="px-6 py-3 border border-red-500 text-red-400 rounded-xl hover:bg-red-500 hover:text-black transition"
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