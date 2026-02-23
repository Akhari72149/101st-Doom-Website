"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Event = {
  id: string;
  server_id: number;
  title: string;
  start_time: string;
  personnel?: {
    name: string;
  }[];
};

export default function HomePage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);

  /* ================= FETCH TODAY EVENTS ================= */

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: bookings } = await supabase
      .from("server_bookings")
      .select(`
        id,
        server_id,
        title,
        start_time,
        personnel:booked_for ( name )
      `)
      .gte("start_time", today.toISOString())
      .lt("start_time", tomorrow.toISOString())
      .order("start_time", { ascending: true });

    // ✅ Fix: Cast safely and avoid TypeScript error
    setEvents((bookings as unknown as Event[]) || []);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05080f] via-[#0b0f1a] to-black text-white font-orbitron flex">

      {/* ================= LEFT SIDE — BRANDING ================= */}
      <div className="flex-1 flex flex-col items-center pt-16">

        <h1 className="text-3xl md:text-5xl font-bold tracking-[0.3em] text-[#00e5ff] text-center">
          101ST<br />
          DOOM BATTALION
        </h1>

        <p className="mt-4 text-gray-400 text-sm md:text-base text-center tracking-wide">
          Operational Command & Personnel Management System
        </p>

        <div className="mt-8">
          <button
            onClick={() => router.push("/pcs")}
            className="px-8 py-3 text-sm md:text-lg border border-[#00e5ff]
                       rounded-lg hover:bg-[#00e5ff] hover:text-black
                       transition-all duration-300
                       shadow-[0_0_20px_rgba(0,229,255,0.3)]"
          >
            Enter Personnel Command
          </button>
        </div>

      </div>

      {/* ================= RIGHT SIDE — EVENTS + CONNECTIONS ================= */}
      <div className="w-[380px] border-l border-[#00e5ff]/30 p-6 bg-black/40 backdrop-blur-xl flex flex-col">

        {/* ===== EVENTS ===== */}
        <h2 className="text-xl text-[#00e5ff] mb-4 tracking-widest">
          Upcoming Events Today
        </h2>

        {events.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            No events scheduled today.
          </div>
        ) : (
          <div className="space-y-4 flex-1 overflow-y-auto">
            {events.map((event) => (
              <div
                key={event.id}
                className="border border-[#00e5ff]/40 rounded-xl p-4 bg-black/60
                           shadow-[0_0_15px_rgba(0,229,255,0.2)]"
              >
                <div className="text-sm text-[#00e5ff]">
                  SERVER {event.server_id}
                </div>

                <div className="font-semibold mt-1">
                  {event.personnel && event.personnel.length > 0
                    ? event.personnel[0].name
                    : "Unknown"}
                </div>

                <div className="text-gray-400 text-sm">
                  {event.title}
                </div>

                <div className="text-xs text-gray-500 mt-2">
                  {new Date(event.start_time).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== CONNECTION LINKS ===== */}
        <div className="mt-6 border-t border-[#00e5ff]/30 pt-6">

          <h3 className="text-[#00e5ff] tracking-widest mb-4">
            Unit Connections
          </h3>

          {/* DISCORD */}
          <a
  href="https://discord.gg/dZhRghrDfX"
  target="_blank"
  className="flex items-center justify-center gap-3 mb-4 px-4 py-3 rounded-xl
             border border-[#00e5ff]/40
             hover:bg-[#00e5ff] hover:text-black
             transition-all duration-300
             shadow-[0_0_15px_rgba(0,229,255,0.4)] group"
>

  {/* Discord SVG Icon */}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className="w-6 h-6 fill-current text-[#00e5ff] group-hover:text-black transition"
  >
    <path d="M20.317 4.369a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.078.037c-.21.375-.444.864-.608 1.249a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.249.077.077 0 00-.078-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.054 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.027c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.201 13.201 0 01-1.872-.89.077.077 0 01-.008-.128c.126-.094.252-.192.372-.29a.074.074 0 01.077-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 01.078.009c.12.098.246.196.372.29a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.89.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.031-.054c.5-5.177-.838-9.674-3.548-13.661a.061.061 0 00-.031-.028z" />
  </svg>

  <span>Join Our Discord Unit</span>

</a>

          {/* TEAMSPEAK */}
          <div className="px-4 py-3 rounded-xl border border-[#00e5ff]/40 text-center">
            <div className="text-sm text-gray-400">
              TeamSpeak Server
            </div>
            <div className="text-[#00e5ff] mt-1 font-semibold">
              199.33.118.13
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}