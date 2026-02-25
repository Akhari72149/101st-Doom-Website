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
  };
};

type Server = {
  id: number;
  online: boolean;
  players: number;
  maxPlayers: number;
  playerList: string[];
};

export default function HomePage() {
  const router = useRouter();

  const [events, setEvents] = useState<Event[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [expandedServer, setExpandedServer] = useState<number | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [time, setTime] = useState(new Date());

  /* ================= DATA ================= */

  const newsItems = [
    "Weekly Unit Stats - 150 clone casualties this week, 256 lost during Yoabos GC",
    "Weekly Kill Stats - 600+ clankers taken out, 2100+ destroyed during GC",
    "Company Medic Applications closed",
    "ARF Sideop this Thursday, Longbow Omegon and Longbow Epsilon to make Planet Fall and scout the region",
  ];

  const slides = [
    "/slideshow/farewell.jpg",
    "/slideshow/img1.jpg",
    "/slideshow/img2.jpg",
    "/slideshow/img3.jpg",
    "/slideshow/img4.jpg",
    "/slideshow/img5.jpg",
    "/slideshow/dagger.jpg",
    "/slideshow/simple.jpg",
    "/slideshow/beach.jpg",
    "/slideshow/img6.jpg",
    "/slideshow/img7.jpg",
    "/slideshow/halberd.jpg",
  ];

  /* ================= CLOCK ================= */

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  /* ================= SLIDESHOW ================= */

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) =>
        prev === slides.length - 1 ? 0 : prev + 1
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);
  
  /* ================= WEEKLY EVENTS (UTC BASED) ================= */

const weeklyEvents = [
  { name: "Tomahawk 1", day: 0, hour: 20, minute: 0 }, 
  { name: "Claymore 2", day: 6, hour: 24, minute: 0 }, 
  { name: "Broadsword 3", day: 0, hour: 2, minute: 0 },
  { name: "Dagger", day: 6, hour: 23, minute: 0 },
];

const getNextOccurrence = (day: number, hour: number, minute: number) => {
  const now = new Date();
  const result = new Date();

  result.setUTCHours(hour, minute, 0, 0);

  const currentDay = result.getUTCDay();
  const diff = (day - currentDay + 7) % 7;

  result.setUTCDate(result.getUTCDate() + diff);

  if (result < now) {
    result.setUTCDate(result.getUTCDate() + 7);
  }

  return result;
};

  /* ================= EVENTS ================= */

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

    const safeEvents: Event[] = (bookings || []).map((b: any) => ({
      ...b,
      personnel: b.personnel ?? null,
    }));

    setEvents(safeEvents);
  };

  /* ================= SERVERS ================= */

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

      if (initialLoad) {
        setInitialLoad(false);
      }
    } catch (err) {
      console.error("Server fetch failed", err);
    }
  };

  const toggleServer = (id: number) => {
    setExpandedServer((prev) => (prev === id ? null : id));
  };

  const onlineCount = servers.filter((s) => s.online).length;
  const offlineCount = servers.length - onlineCount;

  return (
    <div className="relative min-h-screen flex text-white font-orbitron pb-16">

      {/* ================= BACKGROUND ================= */}
      <div
        className="absolute inset-0 bg-center bg-no-repeat bg-cover opacity-20 pointer-events-none z-0"
        style={{ backgroundImage: "url('/background/bg.jpg')" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#001f11_0%,#000a06_100%)] z-0" />

      {/* ================= LOGO ================= */}
      <img
        src="/background/bg.jpg"
        alt="Logo"
        className="absolute top-1 left-1/2 -translate-x-1/2 translate-x-[-135px] w-48 opacity-90 z-20"
      />

      <div className="relative z-10 flex w-full">

        {/* ================= LEFT PANEL ================= */}
        <div className="w-[320px] border-r border-[#00ff66]/30 p-6 bg-black/40 backdrop-blur-xl">

          <h2 className="text-xl text-[#00ff66] mb-6 tracking-widest">
            Servers
          </h2>

          {/* SUMMARY */}
          <div className="mb-6 p-4 rounded-2xl border border-[#00ff66]/30 bg-black/60">
            <div className="text-sm mb-2">🟢 Online: {onlineCount}</div>
            <div className="text-sm mb-2">🔴 Offline: {offlineCount}</div>
            <div className="text-sm mb-2">📅 Events: {events.length}</div>
            <div className="mt-2 text-[#00ff66] text-sm">
              {time.toLocaleTimeString()}
            </div>
          </div>

          {/* SERVER LIST */}
          <div className="mt-6 p-4 rounded-2xl border border-[#00ff66]/30 bg-black/60">

            {initialLoad ? (
              <div className="text-center text-gray-400 py-6 animate-pulse">
                Checking server status...
              </div>
            ) : servers.length === 0 ? (
              <div className="text-center text-gray-400 py-6">
                No servers found.
              </div>
            ) : (
              <div className="space-y-4">
                {servers.map((server) => {
                  const isOpen = expandedServer === server.id;

                  return (
                    <div key={server.id}>
                      <div
                        onClick={() => toggleServer(server.id)}
                        className="cursor-pointer p-4 rounded-xl border border-[#00ff66]/30 bg-black/60 flex justify-between items-center transition-all duration-200 hover:border-[#00ff66] hover:scale-[1.03]"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              server.online
                                ? "bg-[#00ff66] animate-pulse"
                                : "bg-red-500"
                            }`}
                          />
                          <span>Server {server.id}</span>
                        </div>

                        <div className="text-xs font-bold text-[#00ff66]">
                          {server.online
                            ? `${server.players} / ${server.maxPlayers}`
                            : "OFFLINE"}
                        </div>
                      </div>

                      {isOpen && server.online && (
                        <div className="ml-4 mt-2 p-4 rounded-xl border border-[#00ff66]/20 bg-black/40 text-sm">
                          <div className="text-[#00ff66]">
                            Players Online ({server.players})
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>

        {/* ================= CENTER ================= */}
        <div className="flex-1 flex flex-col items-center pt-45">

          <h1 className="text-4xl md:text-6xl font-bold tracking-[0.4em] text-[#00ff66] text-center">
            101ST<br />
            DOOM BATTALION
          </h1>

          <p className="mt-4 text-gray-300 text-center">
            Operational Command & Personnel Management System
          </p>

          <div className="mt-8 flex flex-col items-center gap-4">

  {/* Main Button */}
  <button
    onClick={() => router.push("/pcs")}
    className="px-8 py-3 border border-[#00ff66] rounded-lg text-[#00ff66] hover:bg-[#00ff66] hover:text-black hover:scale-105 transition-all"
  >
    Enter Personnel Command
  </button>

  {/* Row With Offset Buttons */}
  <div className="flex gap-8">
    
    {/* Left Offset */}
    <button
      onClick={() => router.push("/Art-of-War")}
      className="px-8 py-3 border border-[#00ff66] rounded-lg text-[#00ff66] hover:bg-[#00ff66] hover:text-black hover:scale-105 transition-all translate-x-[-20px]"
    >
      Art of War
    </button>

    {/* Right Button */}
    <button
      onClick={() => router.push("/Galactic-Campaign")}
      className="px-8 py-3 border border-[#00ff66] rounded-lg text-[#00ff66] hover:bg-[#00ff66] hover:text-black hover:scale-105 transition-all translate-x-[20px]"
    >
      Galactic Campaign
    </button>

  </div>

</div>

          <div className="mt-20 w-[95%] max-w-4xl h-[500px] relative overflow-hidden rounded-2xl border border-[#00ff66]/30 shadow-[0_0_30px_rgba(0,255,100,0.3)]">
            {slides.map((slide, index) => (
              <img
                key={slide}
                src={slide}
                alt="slideshow"
                className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ${
                  index === currentSlide
                    ? "opacity-100 scale-105"
                    : "opacity-0 scale-100"
                }`}
              />
            ))}
          </div>

        </div>

        {/* ================= RIGHT PANEL ================= */}
        <div className="w-[380px] border-l border-[#00ff66]/30 p-6 bg-black/40 backdrop-blur-xl flex flex-col">

          <h2 className="text-xl text-[#00ff66] mb-4 tracking-widest">
            Upcoming Events Today
          </h2>

          {events.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              No events scheduled today.
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="p-4 rounded-xl border border-[#00ff66]/30 bg-black/60 hover:border-[#00ff66] transition-all"
                >
                  <div className="text-sm text-[#00ff66]">
                    SERVER {event.server_id}
                  </div>
                  <div className="font-semibold mt-1">
                    {event.personnel?.name || "Unknown"}
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

          {/* ================= WEEKLY EVENTS ================= */}
          <div className="space-y-4">
  {weeklyEvents.map((event) => {
    const localDate = getNextOccurrence(
      event.day,
      event.hour,
      event.minute
    );

    return (
      <div
        key={event.name}
        className="p-4 rounded-xl border border-[#00ff66]/30 bg-black/60 hover:border-[#00ff66] transition-all"
      >
        <div className="text-[#00ff66] font-semibold">
          {event.name}
        </div>

        <div className="text-sm text-gray-300 mt-1">
          {localDate.toLocaleDateString(undefined, {
            weekday: "long",
          })}
        </div>

        <div className="text-xs text-gray-400 mt-1">
          {localDate.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
        </div>
      </div>
    );
  })}
</div>

          {/* UNIT CONNECTIONS */}
          <div className="mt-6 border-t border-[#00ff66]/30 pt-6">
            <h3 className="text-[#00ff66] tracking-widest mb-4">
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
                className="block mb-4 px-4 py-3 text-center rounded-xl border border-[#00ff66]/30 hover:bg-[#00ff66]/10 hover:scale-105 transition-all"
              >
                {item.label}
              </a>
            ))}
          </div>

        </div>
      </div>

      {/* ================= NEWS TICKER ================= */}
      <div className="fixed bottom-0 left-0 w-full bg-black/70 backdrop-blur-xl border-t border-[#00ff66]/30 overflow-hidden z-50">
        <div className="flex w-max animate-ticker gap-16 px-8 py-3 text-[#00ff66] whitespace-nowrap">
          {[...newsItems, ...newsItems].map((item, index) => (
            <span key={index} className="mr-16">
              {item}
            </span>
          ))}
        </div>

        <style jsx global>{`
          @keyframes ticker {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }

          .animate-ticker {
            animation: ticker 30s linear infinite;
          }
        `}</style>
      </div>

    </div>
  );
}