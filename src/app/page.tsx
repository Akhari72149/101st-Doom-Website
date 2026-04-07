"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { animate, stagger } from "animejs";

type Event = {
  id: string;
  server_id: number;
  title: string;
  start_time: string;
  personnel?: {
    name: string;
  } | null;
};

type Server = {
  id: number;
  online: boolean;
  players: number;
  maxPlayers: number;
  playerList: string[];
  missionFile?: string;
};

type WeeklyEvent = {
  name: string;
  day: number;
  hour: number;
  minute: number;
};

export default function HomePage() {
  const router = useRouter();

  const [events, setEvents] = useState<Event[]>([]);
  const [pastEvents, setPastEvents] = useState<Event[]>([]);
  const [pastEventsOpen, setPastEventsOpen] = useState(false);
  const [servers, setServers] = useState<Server[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [expandedServer, setExpandedServer] = useState<number | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [time, setTime] = useState(new Date());
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [previousStatus, setPreviousStatus] = useState<Record<number, boolean>>(
    {}
  );
  const [selectedEventDate, setSelectedEventDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  const newsItems = [
    "Week 5 Unit Stats - 112 clone casualties last week, 638 lost during Yoabos GC",
    "Week 5 Kill Stats - 6000+ clankers taken out, 18200+ destroyed during GC",
    "Latest numbers, CWO Sicko purged more Troopers from the unit, than the droids did last weekend, FKIN CWOS, they are the true threat",
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

  const weeklyEvents: WeeklyEvent[] = [
    { name: "Tomahawk 1", day: 0, hour: 19, minute: 0 },
    { name: "Claymore 2", day: 5, hour: 23, minute: 0 },
    { name: "Broadsword 3", day: 0, hour: 1, minute: 0 },
    { name: "Dagger", day: 6, hour: 22, minute: 0 },
  ];

  useEffect(() => {
    const getUser = async () => {
      await supabase.auth.getUser();
    };

    getUser();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    animate(".boot", {
      opacity: [0, 1],
      y: [20, 0],
      duration: 800,
      easing: "easeOutExpo",
      delay: stagger(120),
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.hidden) return;
      setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, 5000);

    return () => clearInterval(interval);
  }, [slides.length]);

  useEffect(() => {
    fetchEvents(selectedEventDate);
  }, [selectedEventDate]);

  useEffect(() => {
    fetchServers();
    const interval = setInterval(fetchServers, 10000);
    return () => clearInterval(interval);
  }, []);

  const isSameDay = (a: Date, b: Date) => {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  };

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

  const getRelativeCountdown = (targetDate: Date) => {
    const now = new Date();
    const diffMs = targetDate.getTime() - now.getTime();

    if (diffMs <= 0) return "Started";

    const totalMinutes = Math.floor(diffMs / 60000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) {
      return hours > 0
        ? `In ${days}d ${hours}h`
        : `In ${days} day${days > 1 ? "s" : ""}`;
    }

    if (hours > 0) {
      return minutes > 0
        ? `In ${hours}h ${minutes}m`
        : `In ${hours} hour${hours > 1 ? "s" : ""}`;
    }

    return `In ${minutes} min`;
  };

  const fetchEvents = async (date: Date) => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const { data: bookings } = await supabase
      .from("server_bookings")
      .select(`
        id,
        server_id,
        title,
        start_time,
        personnel:booked_for ( name )
      `)
      .gte("start_time", start.toISOString())
      .lt("start_time", end.toISOString())
      .order("start_time", { ascending: true });

    const safeEvents: Event[] = (bookings || []).map((b: any) => ({
      ...b,
      personnel: b.personnel ?? null,
    }));

    const now = new Date();
    const selectedIsToday = isSameDay(start, now);

    if (selectedIsToday) {
      const upcoming = safeEvents.filter(
        (event) => new Date(event.start_time).getTime() >= now.getTime()
      );
      const earlier = safeEvents.filter(
        (event) => new Date(event.start_time).getTime() < now.getTime()
      );

      setEvents(upcoming);
      setPastEvents(earlier.reverse());
    } else {
      setEvents(safeEvents);
      setPastEvents([]);
      setPastEventsOpen(false);
    }
  };

  const fetchServers = async () => {
    try {
      const res = await fetch("/api/server-status");
      const data = await res.json();

      setPreviousStatus((prev) => {
        const updated: Record<number, boolean> = { ...prev };

        data.forEach((server: Server) => {
          if (prev[server.id] === false && server.online === true) {
            updated[server.id] = true;
          } else {
            updated[server.id] = server.online;
          }
        });

        return updated;
      });

      setServers(data);

      if (initialLoad) {
        setInitialLoad(false);
      }
    } catch (err) {
      console.error("Server fetch failed", err);
    }
  };

  const changeEventDate = (days: number) => {
    setSelectedEventDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + days);
      next.setHours(0, 0, 0, 0);
      return next;
    });
  };

  const jumpToToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setSelectedEventDate(today);
  };

  const toggleServer = (id: number) => {
    setExpandedServer((prev) => (prev === id ? null : id));
  };

  const onlineCount = servers.filter((s) => s.online).length;
  const offlineCount = servers.length - onlineCount;
  const totalPlayers = servers.reduce(
    (sum, server) => sum + (server.players || 0),
    0
  );

  const justCameOnline = (server: Server) =>
    previousStatus[server.id] === false && server.online;

  const selectedEventDateLabel = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (selectedEventDate.toDateString() === today.toDateString()) {
      return "Today";
    }

    if (selectedEventDate.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    }

    if (selectedEventDate.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }

    return selectedEventDate.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [selectedEventDate]);

  const featuredEvent = useMemo(() => {
    if (events.length === 0) return null;
    return [...events].sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    )[0];
  }, [events]);

  const regularEvents = useMemo(() => {
    if (!featuredEvent) return events;
    return events.filter((event) => event.id !== featuredEvent.id);
  }, [events, featuredEvent]);

  const showEarlierTodaySection =
    isSameDay(selectedEventDate, new Date()) && pastEvents.length > 0;

  return (
    <div className="boot relative min-h-screen flex text-white font-orbitron pb-20">
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

      <div className="relative z-10 flex w-full">
        <div className="w-[320px] border-r border-[#00ff66]/30 p-6 bg-black/30 backdrop-blur-2xl">
          <h2 className="text-xl text-[#00ff66] mb-6 tracking-widest">
            Servers
          </h2>

          <div className="mb-6 p-4 rounded-2xl border border-[#00ff66]/30 bg-black/50">
            <div className="text-sm mb-2">🟢 Online: {onlineCount}</div>
            <div className="text-sm mb-2">🔴 Offline: {offlineCount}</div>
            <div className="text-sm mb-2">
              📅 Upcoming Events: {events.length}
            </div>
            <div className="mt-2 text-[#00ff66] text-sm">
              {time.toLocaleTimeString()}
            </div>
          </div>

          <div className="mt-6 p-4 rounded-2xl border border-[#00ff66]/30 bg-black/50">
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
                        className={`cursor-pointer rounded-xl border bg-black/60 overflow-hidden transition-all duration-300 hover:border-[#00ff66]
                        ${
                          server.online
                            ? "border-[#00ff66]/40 shadow-[0_0_20px_rgba(0,255,102,0.08)]"
                            : "border-[#00ff66]/20"
                        }
                        ${
                          justCameOnline(server)
                            ? "animate-[glowBurst_1.2s_ease-out]"
                            : ""
                        }`}
                      >
                        <div className="p-4 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${
                                server.online
                                  ? "bg-[#00ff66] shadow-[0_0_10px_#00ff66]"
                                  : "bg-red-500 shadow-[0_0_8px_red]"
                              }`}
                            />
                            <span>Server {server.id}</span>
                          </div>

                          <div
                            className={`text-[10px] px-2 py-1 rounded-full ${
                              server.online
                                ? "bg-green-500/20 text-green-400"
                                : "bg-red-500/20 text-red-400"
                            }`}
                          >
                            {server.online ? "ONLINE" : "OFFLINE"}
                          </div>
                        </div>

                        <div
                          className={`grid transition-all duration-300 ${
                            isOpen && server.online
                              ? "grid-rows-[1fr] opacity-100"
                              : "grid-rows-[0fr] opacity-0"
                          }`}
                        >
                          <div className="overflow-hidden">
                            <div className="border-t border-[#00ff66]/20 p-5 text-sm text-gray-300">
                              <div className="text-[#00ff66] mb-3 tracking-wide">
                                Server Population
                              </div>

                              {server.missionFile && (
                                <div className="text-xs text-gray-400 mt-2">
                                  Map: {server.missionFile}
                                </div>
                              )}

                              <div className="flex items-center justify-between text-white text-lg font-semibold">
                                <span>
                                  {server.players ?? 0} /{" "}
                                  {server.maxPlayers || "?"}
                                </span>

                                <span className="text-xs text-gray-400">
                                  Players Online
                                </span>
                              </div>

                              <div className="mt-3 w-full h-3 bg-black/70 rounded-full overflow-hidden border border-[#00ff66]/30">
                                <div
                                  className="h-full bg-[#00ff66] transition-all duration-500"
                                  style={{
                                    width:
                                      server.maxPlayers &&
                                      server.maxPlayers > 0
                                        ? `${
                                            (server.players /
                                              server.maxPlayers) *
                                            100
                                          }%`
                                        : "0%",
                                  }}
                                />
                              </div>

                              <div className="mt-2 text-xs text-gray-400">
                                {server.players === 0
                                  ? "Server is empty"
                                  : server.players === server.maxPlayers
                                  ? "Server is full"
                                  : "Server is active"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center pt-40 px-8">
          <h1 className="text-4xl md:text-6xl font-bold tracking-[0.4em] text-[#00ff66] text-center">
            101ST
            <br />
            DOOM BATTALION
          </h1>

          <p className="mt-4 text-gray-300 text-center">
            Operational Command & Personnel Management System
          </p>

          <div className="mt-6 w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-[#00ff66]/25 bg-black/45 backdrop-blur-xl px-4 py-3 text-center">
              <div className="text-[11px] uppercase tracking-[0.25em] text-gray-400">
                Active Servers
              </div>
              <div className="mt-2 text-2xl font-bold text-[#00ff66]">
                {onlineCount}
              </div>
            </div>

            <div className="rounded-2xl border border-[#00ff66]/25 bg-black/45 backdrop-blur-xl px-4 py-3 text-center">
              <div className="text-[11px] uppercase tracking-[0.25em] text-gray-400">
                Players Online
              </div>
              <div className="mt-2 text-2xl font-bold text-[#00ff66]">
                {totalPlayers}
              </div>
            </div>

            <div className="rounded-2xl border border-[#00ff66]/25 bg-black/45 backdrop-blur-xl px-4 py-3 text-center">
              <div className="text-[11px] uppercase tracking-[0.25em] text-gray-400">
                UK Time
              </div>
              <div className="mt-2 text-2xl font-bold text-[#00ff66]">
                {time.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </div>
            </div>
          </div>

          <div className="group mt-10 w-[95%] max-w-5xl h-[540px] relative overflow-hidden rounded-2xl border border-[#00ff66]/30 shadow-[0_0_30px_rgba(0,255,100,0.3)]">
            {slides.map((slide, index) => (
              <div
                key={slide}
                className={`absolute inset-0 transition-all duration-1000 ${
                  index === currentSlide
                    ? "opacity-100 scale-105"
                    : "opacity-0 scale-100"
                }`}
              >
                <img
                  loading="lazy"
                  src={slide}
                  alt="slideshow"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              </div>
            ))}

            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 z-20">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-2 rounded-full transition-all ${
                    index === currentSlide
                      ? "w-8 bg-[#00ff66]"
                      : "w-2 bg-gray-500 hover:bg-gray-300"
                  }`}
                />
              ))}
            </div>

            <button
              onClick={() =>
                setCurrentSlide((prev) =>
                  prev === 0 ? slides.length - 1 : prev - 1
                )
              }
              className="absolute left-4 top-1/2 -translate-y-1/2 
                         bg-black/60 text-[#00ff66] p-3 rounded-full 
                         opacity-0 group-hover:opacity-100 
                         transition-all duration-300 
                         hover:scale-110 hover:bg-black/80 z-20"
            >
              ◀
            </button>

            <button
              onClick={() =>
                setCurrentSlide((prev) =>
                  prev === slides.length - 1 ? 0 : prev + 1
                )
              }
              className="absolute right-4 top-1/2 -translate-y-1/2 
                         bg-black/60 text-[#00ff66] p-3 rounded-full 
                         opacity-0 group-hover:opacity-100 
                         transition-all duration-300 
                         hover:scale-110 hover:bg-black/80 z-20"
            >
              ▶
            </button>
          </div>
        </div>

        <div className="w-[400px] border-l border-[#00ff66]/30 p-6 bg-black/35 backdrop-blur-2xl shadow-2xl flex flex-col">
          <div className="mb-4">
            <h2 className="text-xl text-[#00ff66] tracking-widest">
              Upcoming Events
            </h2>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[#00ff66]/30 bg-black/50 px-3 py-3">
              <button
                onClick={() => changeEventDate(-1)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[#00ff66]/30 text-[#00ff66] hover:bg-[#00ff66]/10 hover:scale-105 transition-all"
              >
                ◀
              </button>

              <div className="flex-1 text-center">
                <div className="text-sm text-[#00ff66] font-semibold">
                  {selectedEventDateLabel}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {selectedEventDate.toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
              </div>

              <button
                onClick={() => changeEventDate(1)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[#00ff66]/30 text-[#00ff66] hover:bg-[#00ff66]/10 hover:scale-105 transition-all"
              >
                ▶
              </button>
            </div>

            <button
              onClick={jumpToToday}
              className="mt-3 w-full rounded-xl border border-[#00ff66]/25 bg-black/40 px-4 py-2 text-sm text-[#00ff66] hover:bg-[#00ff66]/10 transition-all"
            >
              Jump to Today
            </button>
          </div>

          {featuredEvent && (
            <div className="mb-5 rounded-2xl border border-[#00ff66]/40 bg-[linear-gradient(135deg,rgba(0,255,102,0.12),rgba(0,0,0,0.5))] p-4 shadow-[0_0_18px_rgba(0,255,102,0.12)]">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] tracking-[0.2em] uppercase text-[#00ff66]">
                  Next Operation
                </div>
                <div className="rounded-full border border-[#00ff66]/30 px-2 py-1 text-[10px] text-[#00ff66]">
                  SERVER {featuredEvent.server_id}
                </div>
              </div>

              <div className="mt-3 text-lg font-semibold text-white">
                {featuredEvent.title}
              </div>

              <div className="mt-1 text-sm text-gray-300">
                {featuredEvent.personnel?.name || "Unknown"}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="rounded-lg bg-black/50 px-3 py-1 text-xs text-gray-200 border border-[#00ff66]/20">
                  {new Date(featuredEvent.start_time).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>

                <div className="text-xs text-[#00ff66]">
                  {getRelativeCountdown(new Date(featuredEvent.start_time))}
                </div>
              </div>
            </div>
          )}

          {events.length === 0 ? (
            <div className="text-gray-400 py-4 text-center">
              No upcoming events for this date.
            </div>
          ) : (
            <div className="space-y-4">
              {regularEvents.map((event) => (
                <div
                  key={event.id}
                  className="p-4 rounded-xl border border-[#00ff66]/30 bg-black/60 hover:border-[#00ff66] transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[#00ff66]">
                        Server {event.server_id}
                      </div>
                      <div className="font-semibold mt-2 text-white">
                        {event.title}
                      </div>
                      <div className="text-gray-300 text-sm mt-1">
                        {event.personnel?.name || "Unknown"}
                      </div>
                    </div>

                    <div className="shrink-0 rounded-lg border border-[#00ff66]/25 bg-black/50 px-3 py-1 text-xs text-[#00ff66]">
                      {new Date(event.start_time).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showEarlierTodaySection && (
            <div className="mt-5">
              <button
                onClick={() => setPastEventsOpen((prev) => !prev)}
                className="w-full flex items-center justify-between p-4 rounded-2xl border border-[#00ff66]/35 bg-black/40 hover:bg-black/55 transition-all"
              >
                <span className="text-sm text-[#00ff66] tracking-[0.2em] uppercase">
                  Earlier Today ({pastEvents.length})
                </span>

                <span
                  className={`text-[#00ff66] text-xl transition-transform duration-300 ${
                    pastEventsOpen ? "rotate-180" : "rotate-0"
                  }`}
                >
                  ▼
                </span>
              </button>

              <div
                className={`overflow-hidden transition-all duration-500 ${
                  pastEventsOpen
                    ? "max-h-[1000px] opacity-100 mt-4"
                    : "max-h-0 opacity-0"
                }`}
              >
                <div className="space-y-4">
                  {pastEvents.map((event) => (
                    <div
                      key={event.id}
                      className="p-4 rounded-xl border border-[#00ff66]/15 bg-black/35 opacity-80 hover:opacity-100 transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.18em] text-[#00ff66]/80">
                            Server {event.server_id}
                          </div>
                          <div className="font-semibold mt-2 text-white/90">
                            {event.title}
                          </div>
                          <div className="text-gray-400 text-sm mt-1">
                            {event.personnel?.name || "Unknown"}
                          </div>
                        </div>

                        <div className="shrink-0 rounded-lg border border-[#00ff66]/15 bg-black/40 px-3 py-1 text-xs text-gray-300">
                          {new Date(event.start_time).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>

                      <div className="mt-3 text-[11px] uppercase tracking-[0.18em] text-gray-500">
                        Completed Earlier Today
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="hidden">
            101st Doom Battalion Star Wars MilSim Military Roleplay Arma Unit
            Tactical Gaming Community
          </div>

          <div className="mt-8">
            <button
              onClick={() => setWeeklyOpen(!weeklyOpen)}
              className="w-full flex items-center justify-between p-4 rounded-2xl border border-[#00ff66]/60 bg-black/50 hover:bg-black/70 transition-all cursor-pointer"
            >
              <span className="text-xl text-[#00ff66] tracking-widest">
                Weekly Events
              </span>

              <span
                className={`text-[#00ff66] text-2xl transition-transform duration-300 ${
                  weeklyOpen ? "rotate-180" : "rotate-0"
                }`}
              >
                ▼
              </span>
            </button>

            <div
              className={`overflow-hidden transition-all duration-500 ${
                weeklyOpen ? "max-h-[1000px] opacity-100 mt-4" : "max-h-0 opacity-0"
              }`}
            >
              <div className="p-4 rounded-2xl border border-[#00ff66]/40 bg-black/40">
                <div className="space-y-4">
                  {weeklyEvents.map((event) => {
                    const nextOccurrence = getNextOccurrence(
                      event.day,
                      event.hour,
                      event.minute
                    );

                    return (
                      <div
                        key={event.name}
                        className="p-4 rounded-xl border border-[#00ff66]/30 bg-black/60 hover:border-[#00ff66] transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[#00ff66] font-semibold">
                              {event.name}
                            </div>

                            <div className="text-sm text-gray-300 mt-1">
                              {nextOccurrence.toLocaleDateString(undefined, {
                                weekday: "long",
                              })}
                            </div>

                            <div className="text-xs text-gray-400 mt-1">
                              {nextOccurrence.toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>

                          <div className="rounded-lg border border-[#00ff66]/25 bg-black/50 px-3 py-1 text-[11px] text-[#00ff66] whitespace-nowrap">
                            {getRelativeCountdown(nextOccurrence)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-[#00ff66]/30 pt-6">
            <h3 className="text-[#00ff66] tracking-widest mb-4">
              Unit Connections
            </h3>

            {[
              {
                label: "💬 Join Our Discord",
                href: "https://discord.gg/dZhRghrDfX",
              },
              {
                label: "📘 Unit Reddit",
                href: "https://www.reddit.com/user/101stDBMediaTeam/",
              },
              {
                label: "📸 Unit Instagram",
                href: "https://www.instagram.com/101stdoombattalion_mediateam?igsh=MWk2d2t5cWd1amFhZw==",
              },
              {
                label: "🎧 Join TeamSpeak Server",
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

      <div className="fixed bottom-15 left-0 w-full bg-black/70 backdrop-blur-xl border-t border-[#00ff66]/30 overflow-hidden z-50">
        <div className="flex w-max animate-ticker gap-16 px-8 py-3 text-[#00ff66] whitespace-nowrap">
          {[...newsItems, ...newsItems].map((item, index) => (
            <span key={index} className="mr-16">
              {item}
            </span>
          ))}
        </div>

        <style jsx global>{`
          @keyframes ticker {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(-50%);
            }
          }

          .animate-ticker {
            animation: ticker 30s linear infinite;
          }
        `}</style>
      </div>
    </div>
  );
}