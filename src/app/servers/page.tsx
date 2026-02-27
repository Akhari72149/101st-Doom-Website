"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

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


  const [activeServer, setActiveServer] = useState(1);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [selectedStartIndex, setSelectedStartIndex] =
    useState<number | null>(null);

  const [durationHours, setDurationHours] = useState<1 | 2>(1);

  const [personnelList, setPersonnelList] = useState<any[]>([]);
  const [selectedPerson, setSelectedPerson] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [bookingTitle, setBookingTitle] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [pendingAction, setPendingAction] = useState<"book" | "delete" | null>(null);
  const [canBook, setCanBook] = useState(false);

  const slots = generateSlots(selectedDate);

  const filteredPersonnel = personnelList.filter((person) =>
    person.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /* ================= AUTH ================= */



  useEffect(() => {
  const certificationIds = [
    "0a559b7d-b2d4-4972-a2a7-a64d805d968e",
    "5d61393e-ce1e-40c9-b698-2526b020a486",
    "d6555eb7-3eac-4019-81cb-e11291437156",
    "a4316aa4-f69d-4265-aff0-0760614ff987"
  ];

  supabase
    .from("personnel")
    .select(`
      id,
      name,
      personnel_certifications!inner (
        certification_id
      )
    `)
    .in("personnel_certifications.certification_id", certificationIds)
    .then(({ data }) => {
      setPersonnelList(data || []);
    });

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
  
const [year, month, day] = selectedDate.split("-").map(Number);

const start = new Date(year, month - 1, day, 0, 0, 0);
const end = new Date(year, month - 1, day + 1, 0, 0, 0);

const weekday = new Date(start).getDay();



  /* ================= NORMAL BOOKINGS ================= */

  const { data: bookingData } = await supabase
    .from("server_bookings")
    .select("*")
    .eq("server_id", activeServer)
    .gte("start_time", formatLocalTimestamp(start))
    .lt("start_time", formatLocalTimestamp(end));

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

const startOfDay = new Date(year, month - 1, day, 0, 0, 0);
const endOfDay = new Date(year, month - 1, day + 1, 0, 0, 0);

const { data: recurring } = await supabase
  .from("recurring_server_blocks")
  .select("*")
  .eq("server_id", activeServer)
  .gte("start_at", startOfDay.toISOString())
  .lt("start_at", endOfDay.toISOString());

const recurringBookings = (recurring ?? [])
  .filter((r) => r.start_at && r.end_at)
  .map((r) => {

    // ✅ Direct timestamp conversion
    const start = new Date(r.start_at);
    const end = new Date(r.end_at);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.warn("Invalid timestamptz values", r);
    }

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
    if (!canBook) {
  setPendingAction("delete");
  setShowPasswordPrompt(true);
  return;
}

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
  if (!canBook || !selectedPerson) {
    return;
  }


  if (selectedStartIndex === null) {
    alert("Please select a time slot first.");
    return;
  }

  const start = slots[selectedStartIndex];

  const end = new Date(
    start.getTime() + durationHours * 60 * 60 * 1000
  );

  const { error } = await supabase.from("server_bookings").insert([
    {
      server_id: activeServer,
      booked_for: selectedPerson,
      title: bookingTitle,
      start_time: formatLocalTimestamp(start),
      end_time: formatLocalTimestamp(end),
    },
  ]);

  if (error) {
    alert(error.message);
    return;
  }

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

{showPasswordPrompt && (
  <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50">
    <div className="p-6 bg-black border border-[#00ff66] rounded-xl w-96">
      


      <div className="flex items-center justify-between mb-4">
  <h2 className="text-[#00ff66] text-lg font-bold">
    Admin Password Required
  </h2>

  {/* Close Button INSIDE HEADER */}
  <button
    onClick={() => {
      setShowPasswordPrompt(false);
      setPendingAction(null);
      setAdminPassword("");
    }}
    className="text-red-400 hover:text-red-300 text-2xl leading-none"
  >
    ✕
  </button>
</div>
      <input
        type="password"
        placeholder="Enter Password"
        value={adminPassword}
        onChange={(e) => setAdminPassword(e.target.value)}
        className="w-full p-3 rounded-xl bg-black border border-[#00ff66] text-white"
      />

      <button
        onClick={async () => {
          const { data } = await supabase.rpc("verify_admin_password", {
            password_input: adminPassword,
          });

          if (data === true) {
            setCanBook(true);
            setShowPasswordPrompt(false);

            // ✅ After unlocking — automatically retry the action
            if (pendingAction === "book" && selectedStartIndex !== null) {
            setSelectedStartIndex(selectedStartIndex);
            }

            if (pendingAction === "delete") {
              // You may want to store the delete ID temporarily
            }
          } else {
            alert("Wrong password");
          }
        }}
        className="mt-4 w-full px-4 py-2 bg-[#00ff66] text-black rounded-xl font-semibold"
      >
        Unlock
      </button>
    </div>
  </div>
)}

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
               if (blocked) return;

               if (!canBook) {
               setPendingAction("book");
               setShowPasswordPrompt(true);
                return;
                             }

               setSelectedStartIndex(index);
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
                {slot.toLocaleTimeString([], {
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
              {slots[selectedStartIndex].toLocaleTimeString()} →
              {new Date(
                slots[selectedStartIndex].getTime() +
                  durationHours * 60 * 60 * 1000
              ).toLocaleTimeString()}
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
              <option value={4}>4 Hours</option>
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

function parseLocalTimestamp(value: string) {
  return new Date(value.replace(" ", "T"));
}

function formatLocalTimestamp(date: Date) {
  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0") +
    " " +
    String(date.getHours()).padStart(2, "0") +
    ":" +
    String(date.getMinutes()).padStart(2, "0") +
    ":00"
  );
}

function generateSlots(dateString: string) {
  const slots: Date[] = [];

  const [year, month, day] = dateString.split("-").map(Number);

  // Build using LOCAL time — NOT UTC
  const base = new Date(year, month - 1, day, 0, 0, 0);

  for (let i = 0; i < 48; i++) {
    slots.push(new Date(base.getTime() + i * 30 * 60 * 1000));
  }

  return slots;
}