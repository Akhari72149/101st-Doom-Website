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

type Server = {
  id: number;
  host: string;
  port: number;
  online: boolean;
  players: number;
  playerList: string[];
};

export default function HomePage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [expandedServer, setExpandedServer] = useState<number | null>(null);

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

    setEvents((bookings as unknown as Event[]) || []);
  };

  /* ================= FETCH SERVER STATUS ================= */

  useEffect(() => {
    fetchServers();
    const interval = setInterval(fetchServers, 10000); // refresh every 10 sec
    return () => clearInterval(interval);
  }, []);

  const fetchServers = async () => {
    try {
      const res = await fetch("/api/server-status");
      const data = await res.json();
      setServers(data);
    } catch (err) {
      console.error("Server fetch failed", err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05080f] via-[#0b0f1a] to-black text-white font-orbitron flex">

      {/* ================= LEFT SIDE — SERVER STATUS ================= */}
      <div className="w-[320px] border-r border-[#00e5ff]/30 p-6 bg-black/40 backdrop-blur-xl overflow-y-auto">

        <h2 className="text-xl text-[#00e5ff] mb-6 tracking-widest">
          Server Status
        </h2>

        {servers.map((server) => (
          <div
            key={server.id}
            className="mb-4 border border-[#00e5ff]/40 rounded-xl p-4 bg-black/60
                       shadow-[0_0_12px_rgba(0,229,255,0.2)]"
          >
            <div
              onClick={() =>
                setExpandedServer(
                  expandedServer === server.id ? null : server.id
                )
              }
              className="flex justify-between items-center cursor-pointer"
            >
              <span className="font-semibold">
                Server {server.id}
              </span>

              <span
                className={`text-xs font-bold ${
                  server.online
                    ? "text-green-400"
                    : "text-red-500"
                }`}
              >
                {server.online ? "ONLINE" : "OFFLINE"}
              </span>
            </div>

            {expandedServer === server.id && (
              <div className="mt-3 text-sm text-gray-300 space-y-1">
                <div>
                  IP: {server.host}:{server.port}
                </div>

                <div>
                  Players: {server.players}
                </div>

                {server.playerList.length > 0 && (
                  <ul className="mt-2 text-xs text-gray-400 space-y-1">
                    {server.playerList.map((player) => (
                      <li key={player}>• {player}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}

      </div>

      {/* ================= CENTER — BRANDING ================= */}
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

        {/* CONNECTIONS */}
        <div className="mt-6 border-t border-[#00e5ff]/30 pt-6">

          <h3 className="text-[#00e5ff] tracking-widest mb-4">
            Unit Connections
          </h3>

          <a
            href="https://discord.gg/dZhRghrDfX"
            target="_blank"
            className="flex items-center justify-center gap-3 mb-4 px-4 py-3 rounded-xl
                       border border-[#00e5ff]/40
                       hover:bg-[#00e5ff] hover:text-black
                       transition-all duration-300
                       shadow-[0_0_15px_rgba(0,229,255,0.4)] group"
          >
            <span>Join Our Discord</span>
          </a>

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