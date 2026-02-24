"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { hasRole } from "@/lib/permissions";

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
};

export default function HomePage() {
  const router = useRouter();

  const [events, setEvents] = useState<Event[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [time, setTime] = useState(new Date());

  /* ================= NEWS TICKER TEXT ================= */

  const newsItems = [
    "Weekly Unit Stats - 150 clone casualties this week, 256 lost during Yoabos GC",
	"Weekly Kill Stats - 600+ clankers taken out, 2100+ destroyed during GC",
	"Company Medic Applications closed",
	"Fkin CWOS"
  ];

  const slides = [
    "/slideshow/img1.jpg",
    "/slideshow/img2.jpg",
    "/slideshow/img3.jpg",
    "/slideshow/img4.jpg",
    "/slideshow/img5.jpg",
  ];

  /* ================= LIVE CLOCK ================= */

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
    } catch (err) {
      console.error("Server fetch failed", err);
    }
  };

  /* ================= STATUS ================= */

  const onlineCount = servers.filter((s) => s.online).length;
  const offlineCount = servers.length - onlineCount;

  /* ================= UI ================= */

  return (
    <div className="relative min-h-screen flex text-white font-orbitron pb-16">

      {/* BACKGROUND */}
      <div
        className="absolute inset-0 bg-center bg-no-repeat bg-cover opacity-20 pointer-events-none z-0"
        style={{
          backgroundImage: "url('/background/bg.jpg')",
        }}
      />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#001f11_0%,#000a06_100%)] z-0" />

      {/* LOGO */}
      <img
        src="/background/bg.jpg"
        alt="Logo"
        className="absolute top-3 left-[48.9%] -translate-x-1/2 w-50 opacity-90 z-20"
      />

      <div className="relative z-10 flex w-full">

        {/* LEFT PANEL */}
        <div className="w-[320px] border-r border-[#00ff66]/30 p-6 bg-black/40 backdrop-blur-xl">
          <h2 className="text-xl text-[#00ff66] mb-6 tracking-widest">
            Servers
          </h2>

          {/* STATUS SUMMARY */}
          <div className="mb-6 p-4 rounded-xl border border-[#00ff66]/30 bg-black/60 text-sm">
            <div>🟢 Online: {onlineCount}</div>
            <div>🔴 Offline: {offlineCount}</div>
            <div>📅 Events: {events.length}</div>
            <div className="mt-2 text-[#00ff66]">
              {time.toLocaleTimeString()}
            </div>
          </div>

          {servers.map((server) => (
            <div
              key={server.id}
              className="mb-4 p-4 rounded-xl border border-[#00ff66]/30 bg-black/60 flex justify-between items-center transition-all duration-200 hover:border-[#00ff66] hover:scale-[1.03] hover:shadow-[0_0_25px_rgba(0,255,100,0.4)]"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    server.online ? "bg-[#00ff66] animate-pulse" : "bg-red-500"
                  }`}
                />
                <span>Server {server.id}</span>
              </div>

              <span
                className={`text-xs font-bold ${
                  server.online ? "text-[#00ff66]" : "text-red-500"
                }`}
              >
                {server.online ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
          ))}
        </div>

        {/* CENTER */}
        <div className="flex-1 flex flex-col items-center pt-54">

          <h1 className="text-4xl md:text-6xl font-bold tracking-[0.4em] text-[#00ff66] text-center">
            101ST<br />
            DOOM BATTALION
          </h1>

          <p className="mt-4 text-gray-300 text-center">
            Operational Command & Personnel Management System
          </p>

          <button
            onClick={() => router.push("/pcs")}
            className="mt-8 px-8 py-3 border border-[#00ff66] rounded-lg text-[#00ff66] transition-all duration-200 hover:bg-[#00ff66] hover:text-black hover:scale-105"
          >
            Enter Personnel Command
          </button>

          {/* SLIDESHOW */}
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

        {/* RIGHT PANEL */}
        <div className="w-[380px] border-l border-[#00ff66]/30 p-6 bg-black/40 backdrop-blur-xl flex flex-col">
          <h2 className="text-xl text-[#00ff66] mb-4 tracking-widest">
            Upcoming Events Today
          </h2>

          {events.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              No events scheduled today.
            </div>
          ) : (
            <div className="space-y-4 flex-1 overflow-y-auto">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="p-4 rounded-xl border border-[#00ff66]/30 bg-black/60 transition-all duration-200 hover:border-[#00ff66] hover:scale-[1.03] hover:shadow-[0_0_25px_rgba(0,255,100,0.4)]"
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

        </div>
      </div>

      {/* ================= NEWS REEL ================= */}

      <div className="fixed bottom-0 left-0 w-full bg-black/70 backdrop-blur-xl border-t border-[#00ff66]/30 overflow-hidden z-50">
        <div className="flex animate-[tickerScroll_20s_linear_infinite] gap-16 px-8 py-3 text-[#00ff66] whitespace-nowrap">
          {[...newsItems, ...newsItems].map((item, index) => (
            <span key={index} className="mr-16">
              {item}
            </span>
          ))}
        </div>
      </div>

    </div>
  );
}