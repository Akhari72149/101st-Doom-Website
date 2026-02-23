"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/* ========================================================= */
/* ======================= TYPES =========================== */
/* ========================================================= */

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
  online: boolean;
};

/* ========================================================= */
/* ======================= PAGE ============================ */
/* ========================================================= */

export default function HomePage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    "/slideshow/img1.jpg",
    "/slideshow/img2.jpg",
    "/slideshow/img3.jpg",
    "/slideshow/img4.jpg",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) =>
        prev === slides.length - 1 ? 0 : prev + 1
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

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

  useEffect(() => {
    fetchServers();
    const interval = setInterval(fetchServers, 10000);
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

  /* ========================================================= */
  /* ======================== UI ============================= */
  /* ========================================================= */

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#001200] via-[#002700] to-[#000a00] text-white font-orbitron flex">

      {/* LEFT — SERVERS */}
      <div className="w-[320px] border-r border-[#00ff4c]/30 p-6 bg-black/40 backdrop-blur-xl">

        <h2 className="text-xl text-[#00ff4c] mb-6 tracking-widest">
          Servers
        </h2>

        {servers.map((server) => (
          <div
            key={server.id}
            className="
              mb-4
              border border-[#00ff4c]/30
              rounded-xl p-4 bg-black/60
              shadow-[0_0_12px_rgba(0,255,80,0.2)]
              flex justify-between items-center
              transition-all duration-300
              hover:border-[#00ff4c]
              hover:scale-[1.03]
              hover:shadow-[0_0_25px_rgba(0,255,80,0.4)]
            "
          >
            <span className="font-semibold">
              Server {server.id}
            </span>

            <span
              className={`text-xs font-bold ${
                server.online ? "text-[#00ff4c]" : "text-red-500"
              }`}
            >
              {server.online ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
        ))}

      </div>

      {/* CENTER */}
      <div className="flex-1 flex flex-col items-center pt-16">

        <h1 className="text-3xl md:text-5xl font-bold tracking-[0.3em] text-[#00ff4c] text-center">
          101ST<br />
          DOOM BATTALION
        </h1>

        <p className="mt-4 text-gray-300 text-sm md:text-base text-center tracking-wide">
          Operational Command & Personnel Management System
        </p>

        {/* BUTTON */}
        <div className="mt-8">
          <button
            onClick={() => router.push("/pcs")}
            className="
              px-8 py-3
              text-sm md:text-lg
              border border-[#00ff4c]
              rounded-lg
              transition-all duration-300
              shadow-[0_0_15px_rgba(0,255,80,0.3)]
              hover:bg-[#003d14]
              hover:text-[#00ff4c]
              hover:scale-105
              hover:shadow-[0_0_25px_rgba(0,255,80,0.5)]
            "
          >
            Enter Personnel Command
          </button>
        </div>

        {/* SLIDESHOW */}
        <div className="
          mt-12
          w-[95%] max-w-4xl h-[500px]
          relative overflow-hidden
          rounded-2xl
          border border-[#00ff4c]/30
          shadow-[0_0_30px_rgba(0,255,80,0.3)]
        ">

          {slides.map((slide, index) => (
            <img
              key={slide}
              src={slide}
              alt="slideshow"
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                index === currentSlide ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}

        </div>

      </div>

      {/* RIGHT — EVENTS */}
      <div className="w-[380px] border-l border-[#00ff4c]/30 p-6 bg-black/40 backdrop-blur-xl flex flex-col">

        <h2 className="text-xl text-[#00ff4c] mb-4 tracking-widest">
          Upcoming Events Today
        </h2>

        {events.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">
            No events scheduled today.
          </div>
        ) : (
          <div className="space-y-4 flex-1 overflow-y-auto">
            {events.map((event) => (
              <div
                key={event.id}
                className="
                  border border-[#00ff4c]/30
                  rounded-xl p-4
                  bg-black/60
                  shadow-[0_0_15px_rgba(0,255,80,0.2)]
                  transition-all duration-300
                  hover:border-[#00ff4c]
                  hover:scale-[1.03]
                  hover:shadow-[0_0_25px_rgba(0,255,80,0.4)]
                "
              >
                <div className="text-sm text-[#00ff4c]">
                  SERVER {event.server_id}
                </div>

                <div className="font-semibold mt-1">
                  {event.personnel && event.personnel.length > 0
                    ? event.personnel[0].name
                    : "Unknown"}
                </div>

                <div className="text-gray-300 text-sm">
                  {event.title}
                </div>

                <div className="text-xs text-gray-400 mt-2">
                  {new Date(event.start_time).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CONNECTIONS */}
        <div className="mt-6 border-t border-[#00ff4c]/30 pt-6">

          <h3 className="text-[#00ff4c] tracking-widest mb-4">
            Unit Connections
          </h3>

          {[
            {
              label: "Join Our Discord",
              href: "https://discord.gg/dZhRghrDfX",
            },
            {
              label: "Download TeamSpeak",
              href: "https://files.teamspeak-services.com/releases/client/3.6.2/TeamSpeak3-Client-win64-3.6.2.exe",
            },
            {
              label: "Join TeamSpeak Server",
              href: "ts3server://199.33.118.13",
            },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              target="_blank"
              className="
                block mb-4 px-4 py-3 text-center
                rounded-xl
                border border-[#00ff4c]/30
                transition-all duration-300
                hover:bg-[#003d14]
                hover:text-[#00ff4c]
                hover:scale-105
                hover:shadow-[0_0_20px_rgba(0,255,80,0.5)]
              "
            >
              {item.label}
            </a>
          ))}

        </div>

      </div>

    </div>
  );
}