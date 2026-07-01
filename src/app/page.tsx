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

type ServerBookingRow = Omit<Event, "personnel"> & {
  personnel?: Event["personnel"] | Array<{ name: string }>;
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

type AuditHighlight = {
  id: string;
  action: string | null;
  details: string | null;
  created_at: string;
  targetPersonnel?: { name: string } | { name: string }[] | null;
  targetCertification?: { name: string } | { name: string }[] | null;
  targetRank?: { name: string } | { name: string }[] | null;
};

type SiteVersionData = {
  version: string;
  commitMessage: string;
  shortSha: string;
  committedAt: string | null;
  author: string;
  commitUrl?: string;
};

type XpLeaderboardEntry = {
  position: number;
  personnelId: string;
  name: string;
  displayedRank: string;
  totalXp: number;
  currentLevel: number;
  kills: number;
  deaths: number;
  teamkills: number;
  lastEventAt: string | null;
};

export default function HomePage() {
  const router = useRouter();

  const [events, setEvents] = useState<Event[]>([]);
  const [pastEvents, setPastEvents] = useState<Event[]>([]);
  const [pastEventsOpen, setPastEventsOpen] = useState(false);

  const [servers, setServers] = useState<Server[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [expandedServer, setExpandedServer] = useState<number | null>(null);
  const [serversOpen, setServersOpen] = useState(false);

  const [dailyHighlights, setDailyHighlights] = useState<AuditHighlight[]>([]);
  const [loadingHighlights, setLoadingHighlights] = useState(true);
  const [highlightsOpen, setHighlightsOpen] = useState(false);

  const [siteVersion, setSiteVersion] = useState<SiteVersionData | null>(null);
  const [loadingSiteVersion, setLoadingSiteVersion] = useState(true);
  const [siteVersionOpen, setSiteVersionOpen] = useState(false);
  const [xpLeaderboard, setXpLeaderboard] = useState<XpLeaderboardEntry[]>([]);
  const [loadingXpLeaderboard, setLoadingXpLeaderboard] = useState(true);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [time, setTime] = useState(new Date());
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [previousStatus, setPreviousStatus] = useState<Record<number, boolean>>(
    {},
  );

  const [selectedEventDate, setSelectedEventDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });

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
    fetchDailyHighlights();
    fetchSiteVersion();
    fetchXpLeaderboard();

    const serverInterval = setInterval(fetchServers, 10000);
    const highlightInterval = setInterval(fetchDailyHighlights, 60000);
    const leaderboardInterval = setInterval(fetchXpLeaderboard, 60000);

    return () => {
      clearInterval(serverInterval);
      clearInterval(highlightInterval);
      clearInterval(leaderboardInterval);
    };
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

  const unwrapRelationName = (
    value: { name: string } | { name: string }[] | null | undefined,
  ) => {
    if (!value) return null;
    if (Array.isArray(value)) return value[0]?.name ?? null;
    return value.name ?? null;
  };

  const detectHighlightType = (row: AuditHighlight) => {
    if (unwrapRelationName(row.targetRank)) return "promotion";
    if (unwrapRelationName(row.targetCertification)) return "certification";

    const haystack = `${row.action ?? ""} ${row.details ?? ""}`.toLowerCase();

    if (haystack.includes("promot")) return "promotion";

    if (
      haystack.includes("cert") ||
      haystack.includes("qualification") ||
      haystack.includes("awarded") ||
      haystack.includes("assigned")
    ) {
      return "certification";
    }

    return "unknown";
  };

  const isPromotionOrCertLog = (row: AuditHighlight) => {
    const action = (row.action ?? "").toLowerCase();

    if (action === "certification_revoked") return false;

    return detectHighlightType(row) !== "unknown";
  };

  const formatHighlightTitle = (row: AuditHighlight) => {
    const type = detectHighlightType(row);

    if (type === "promotion") return "Promotion Earned";
    if (type === "certification") return "Certification Earned";
    return "Unit Achievement";
  };

  const formatHighlightText = (row: AuditHighlight) => {
    const name = unwrapRelationName(row.targetPersonnel);
    const certName = unwrapRelationName(row.targetCertification);
    const rankName = unwrapRelationName(row.targetRank);
    const type = detectHighlightType(row);

    const highlightClass = "text-[#00ff66] font-semibold";

    if (type === "promotion") {
      if (name && rankName) {
        return (
          <>
            Congratulations to <span className={highlightClass}>{name}</span> on
            your promotion to <span className={highlightClass}>{rankName}</span>
          </>
        );
      }

      if (name) {
        return (
          <>
            Congratulations to <span className={highlightClass}>{name}</span> on
            your promotion
          </>
        );
      }

      if (rankName) {
        return (
          <>
            Congratulations on the promotion to{" "}
            <span className={highlightClass}>{rankName}</span>
          </>
        );
      }

      return "Congratulations on your promotion";
    }

    if (type === "certification") {
      if (name && certName) {
        return (
          <>
            Congratulations <span className={highlightClass}>{name}</span>,{" "}
            <span className={highlightClass}>{certName}</span> assigned
          </>
        );
      }

      if (name) {
        return (
          <>
            Congratulations <span className={highlightClass}>{name}</span> on
            your certification
          </>
        );
      }

      if (certName) {
        return (
          <>
            Congratulations, <span className={highlightClass}>{certName}</span>{" "}
            assigned
          </>
        );
      }

      return "Congratulations on your certification";
    }

    return "Congratulations on today’s achievement";
  };

  const formatSiteVersionDate = (value: string | null) => {
    if (!value) return "Unknown";

    return new Date(value).toLocaleString([], {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const fetchEvents = async (date: Date) => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const { data: bookings } = await supabase
      .from("server_bookings")
      .select(
        `
        id,
        server_id,
        title,
        start_time,
        personnel:booked_for ( name )
      `,
      )
      .gte("start_time", start.toISOString())
      .lt("start_time", end.toISOString())
      .order("start_time", { ascending: true });

    const safeEvents: Event[] = ((bookings as unknown as ServerBookingRow[]) || []).map((b) => {
      const relation = Array.isArray(b.personnel)
        ? b.personnel[0] ?? null
        : b.personnel ?? null;

      return {
        ...b,
        personnel: relation,
      };
    });

    const now = new Date();
    const selectedIsToday = isSameDay(start, now);

    if (selectedIsToday) {
      const upcoming = safeEvents.filter(
        (event) => new Date(event.start_time).getTime() >= now.getTime(),
      );
      const earlier = safeEvents.filter(
        (event) => new Date(event.start_time).getTime() < now.getTime(),
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

  const fetchDailyHighlights = async () => {
    try {
      setLoadingHighlights(true);

      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const { data, error } = await supabase
        .from("audit_logs")
        .select(
          `
          id,
          action,
          details,
          created_at,
          targetPersonnel:target_personnel_id ( name ),
          targetCertification:target_certification_id ( name ),
          targetRank:target_rank_id ( name )
        `,
        )
        .in("action", ["CERTIFICATION_ASSIGNED", "RANK_CHANGED"])
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString())
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch audit highlights", error);
        setDailyHighlights([]);
        return;
      }

      const filtered = ((data as AuditHighlight[]) || [])
        .filter((row) => isPromotionOrCertLog(row))
        .slice(0, 8);

      setDailyHighlights(filtered);
    } catch (err) {
      console.error("Failed to fetch audit highlights", err);
      setDailyHighlights([]);
    } finally {
      setLoadingHighlights(false);
    }
  };

  const fetchSiteVersion = async () => {
    try {
      setLoadingSiteVersion(true);

      const res = await fetch("/api/site-version");

      if (!res.ok) {
        setSiteVersion(null);
        return;
      }

      const data = await res.json();
      setSiteVersion(data);
    } catch (err) {
      console.error("Failed to fetch site version", err);
      setSiteVersion(null);
    } finally {
      setLoadingSiteVersion(false);
    }
  };

  const fetchXpLeaderboard = async () => {
    try {
      setLoadingXpLeaderboard(true);

      const res = await fetch("/api/arma/xp-leaderboard", {
        cache: "no-store",
      });

      if (!res.ok) {
        setXpLeaderboard([]);
        return;
      }

      const data = (await res.json()) as {
        leaderboard?: XpLeaderboardEntry[];
      };

      setXpLeaderboard(data.leaderboard || []);
    } catch (err) {
      console.error("Failed to fetch XP leaderboard", err);
      setXpLeaderboard([]);
    } finally {
      setLoadingXpLeaderboard(false);
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
    0,
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
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
    )[0];
  }, [events]);

  const regularEvents = useMemo(() => {
    if (!featuredEvent) return events;
    return events.filter((event) => event.id !== featuredEvent.id);
  }, [events, featuredEvent]);

  const showEarlierTodaySection =
    isSameDay(selectedEventDate, new Date()) && pastEvents.length > 0;

  return (
    <div className="boot relative min-h-screen overflow-x-hidden text-white font-orbitron">
      <div
        className="fixed inset-0 bg-center bg-no-repeat bg-cover opacity-20 pointer-events-none z-0"
        style={{ backgroundImage: "url('/background/bg.jpg')" }}
      />

      <div className="fixed inset-0 bg-[radial-gradient(circle_at_center,#001f11_0%,#000a06_100%)] z-0" />

      <img
        src="/background/bg.jpg"
        alt=""
        aria-hidden="true"
        className="fixed left-1/2 top-1/2 z-[1] w-[700px] sm:w-[950px] xl:w-[1200px] -translate-x-1/2 -translate-y-1/2 opacity-[0.2] blur-sm saturate-150 pointer-events-none"
      />

      <div className="relative z-10 flex w-full flex-col xl:flex-row">
        <div className="order-2 xl:order-1 w-full xl:w-[320px] xl:min-h-screen border-t xl:border-t-0 xl:border-r border-[#00ff66]/30 p-4 sm:p-6 bg-black/30 backdrop-blur-2xl">
          <div className="mb-5 grid grid-cols-2 gap-3 rounded-2xl border border-[#00ff66]/30 bg-black/50 p-4 xl:block xl:space-y-2">
            <div className="text-xs sm:text-sm">🟢 Online: {onlineCount}</div>
            <div className="text-xs sm:text-sm">🔴 Offline: {offlineCount}</div>
            <div className="text-xs sm:text-sm">📅 Events: {events.length}</div>
            <div className="text-xs sm:text-sm">👥 Players: {totalPlayers}</div>
            <div className="col-span-2 mt-1 text-[#00ff66] text-xs sm:text-sm xl:mt-2">
              {time.toLocaleTimeString()}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-[#00ff66]/30 bg-black/50 overflow-hidden">
              <button
                onClick={() => setServersOpen((prev) => !prev)}
                className="w-full flex items-center justify-between px-4 py-4 hover:bg-black/40 transition-all"
              >
                <span className="text-lg sm:text-xl text-[#00ff66] tracking-widest">
                  Servers
                </span>

                <span
                  className={`text-[#00ff66] text-2xl transition-transform duration-300 ${
                    serversOpen ? "rotate-180" : "rotate-0"
                  }`}
                >
                  ▼
                </span>
              </button>

              <div
                className={`overflow-hidden transition-all duration-500 ${
                  serversOpen
                    ? "max-h-[1400px] opacity-100"
                    : "max-h-0 opacity-0"
                }`}
              >
                <div className="px-4 pb-4">
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
                              className={`cursor-pointer rounded-xl border bg-black/60 overflow-hidden transition-all duration-300 hover:border-[#00ff66] ${
                                server.online
                                  ? "border-[#00ff66]/40 shadow-[0_0_20px_rgba(0,255,102,0.08)]"
                                  : "border-[#00ff66]/20"
                              } ${
                                justCameOnline(server)
                                  ? "animate-[glowBurst_1.2s_ease-out]"
                                  : ""
                              }`}
                            >
                              <div className="p-4 flex justify-between items-center gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                      server.online
                                        ? "bg-[#00ff66] shadow-[0_0_10px_#00ff66]"
                                        : "bg-red-500 shadow-[0_0_8px_red]"
                                    }`}
                                  />

                                  <span className="truncate">
                                    Server {server.id}
                                  </span>
                                </div>

                                <div
                                  className={`shrink-0 text-[10px] px-2 py-1 rounded-full ${
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
                                  <div className="border-t border-[#00ff66]/20 p-4 sm:p-5 text-sm text-gray-300">
                                    <div className="text-[#00ff66] mb-3 tracking-wide">
                                      Server Population
                                    </div>

                                    {server.missionFile && (
                                      <div className="text-xs text-gray-400 mt-2 break-words">
                                        Map: {server.missionFile}
                                      </div>
                                    )}

                                    <div className="flex items-center justify-between text-white text-lg font-semibold gap-3">
                                      <span>
                                        {server.players ?? 0} /{" "}
                                        {server.maxPlayers || "?"}
                                      </span>

                                      <span className="text-xs text-gray-400 text-right">
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
            </div>

            <div className="rounded-2xl border border-[#00ff66]/30 bg-black/50 overflow-hidden">
              <button
                onClick={() => setHighlightsOpen((prev) => !prev)}
                className="w-full flex items-center justify-between gap-3 px-4 py-4 hover:bg-black/40 transition-all"
              >
                <span className="text-sm sm:text-base text-[#00ff66] tracking-[0.16em] sm:tracking-[0.2em] uppercase text-left">
                  Today&apos;s Commendations
                </span>

                <span
                  className={`text-[#00ff66] text-2xl transition-transform duration-300 ${
                    highlightsOpen ? "rotate-180" : "rotate-0"
                  }`}
                >
                  ▼
                </span>
              </button>

              <div
                className={`overflow-hidden transition-all duration-500 ${
                  highlightsOpen
                    ? "max-h-[420px] opacity-100"
                    : "max-h-0 opacity-0"
                }`}
              >
                <div className="px-4 pb-4 max-h-[360px] overflow-y-auto pr-2">
                  {loadingHighlights ? (
                    <div className="text-center text-gray-400 py-6 animate-pulse">
                      Loading today&apos;s commendations...
                    </div>
                  ) : dailyHighlights.length === 0 ? (
                    <div className="text-sm text-gray-400 py-4">
                      No promotions or certifications logged today yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {dailyHighlights.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-[#00ff66]/20 bg-black/55 p-4"
                        >
                          <div className="text-[11px] uppercase tracking-[0.18em] text-[#00ff66]">
                            {formatHighlightTitle(item)}
                          </div>

                          <div className="mt-2 text-sm text-white leading-relaxed">
                            {formatHighlightText(item)}
                          </div>

                          <div className="mt-3 text-[11px] text-gray-500">
                            {new Date(item.created_at).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-400/30 bg-black/50 overflow-hidden">
              <button
                onClick={() => setSiteVersionOpen((prev) => !prev)}
                className="w-full flex items-center justify-between px-4 py-4 hover:bg-black/40 transition-all"
              >
                <span className="text-sm sm:text-base text-cyan-300 tracking-[0.2em] uppercase">
                  Website Build
                </span>

                <span
                  className={`text-cyan-300 text-2xl transition-transform duration-300 ${
                    siteVersionOpen ? "rotate-180" : "rotate-0"
                  }`}
                >
                  ▼
                </span>
              </button>

              <div
                className={`overflow-hidden transition-all duration-500 ${
                  siteVersionOpen
                    ? "max-h-[640px] opacity-100"
                    : "max-h-0 opacity-0"
                }`}
              >
                <div className="px-4 pb-4">
                  {loadingSiteVersion ? (
                    <div className="text-center text-gray-400 py-4 animate-pulse">
                      Loading website version...
                    </div>
                  ) : !siteVersion ? (
                    <div className="rounded-xl border border-red-400/20 bg-red-500/5 p-4 text-sm text-red-300">
                      Unable to load website version data.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-cyan-400/20 bg-black/55 p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">
                          Version
                        </div>
                        <div className="mt-2 text-2xl font-bold text-cyan-300">
                          {siteVersion.version}
                        </div>
                      </div>

                      <div className="rounded-xl border border-cyan-400/20 bg-black/55 p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">
                          Latest Commit
                        </div>
                        <div className="mt-2 text-sm text-white leading-relaxed break-words">
                          {siteVersion.commitMessage}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-cyan-400/20 bg-black/55 p-4">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">
                            Commit
                          </div>

                          {siteVersion.commitUrl ? (
                            <a
                              href={siteVersion.commitUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-block text-sm font-semibold text-cyan-300 hover:underline break-all"
                            >
                              {siteVersion.shortSha}
                            </a>
                          ) : (
                            <div className="mt-2 text-sm font-semibold text-cyan-300 break-all">
                              {siteVersion.shortSha}
                            </div>
                          )}
                        </div>

                        <div className="rounded-xl border border-cyan-400/20 bg-black/55 p-4">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">
                            Author
                          </div>
                          <div className="mt-2 text-sm text-white break-words">
                            {siteVersion.author}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-cyan-400/20 bg-black/55 p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">
                          Updated
                        </div>
                        <div className="mt-2 text-sm text-white">
                          {formatSiteVersionDate(siteVersion.committedAt)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#00ff66]/30 bg-black/50 overflow-hidden">
              <button
                onClick={() => setLeaderboardOpen((prev) => !prev)}
                className="w-full flex items-center justify-between gap-3 px-4 py-4 hover:bg-black/40 transition-all"
              >
                <span className="text-sm sm:text-base text-[#00ff66] tracking-[0.2em] uppercase">
                  XP Leaderboard
                </span>

                <span
                  className={`text-[#00ff66] text-2xl transition-transform duration-300 ${
                    leaderboardOpen ? "rotate-180" : "rotate-0"
                  }`}
                >
                  ▼
                </span>
              </button>

              <div
                className={`overflow-hidden transition-all duration-500 ${
                  leaderboardOpen
                    ? "max-h-[980px] opacity-100"
                    : "max-h-0 opacity-0"
                }`}
              >
                <div className="space-y-3 px-4 pb-4">
                  <div className="rounded-xl border border-[#00ff66]/20 bg-black/55 p-3 text-xs leading-5 text-gray-400">
                    Link your Steam account to your personnel profile to appear
                    on the board and earn XP from tracked Arma events.
                    <button
                      onClick={() => router.push("/member-link")}
                      className="ml-2 text-[#00ff66] underline decoration-[#00ff66]/40 underline-offset-4 transition hover:text-white"
                    >
                      Link Steam
                    </button>
                  </div>

                  {loadingXpLeaderboard ? (
                    <div className="rounded-xl border border-[#00ff66]/15 bg-black/40 p-4 text-center text-sm text-gray-400 animate-pulse">
                      Loading XP standings...
                    </div>
                  ) : xpLeaderboard.length === 0 ? (
                    <div className="rounded-xl border border-[#00ff66]/15 bg-black/40 p-4 text-sm text-gray-400">
                      No XP records yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {xpLeaderboard.slice(0, 5).map((entry) => (
                        <button
                          key={entry.personnelId}
                          onClick={() =>
                            router.push(`/personnel-profile?id=${entry.personnelId}`)
                          }
                          className="group w-full rounded-xl border border-[#00ff66]/20 bg-black/55 p-3 text-left transition hover:border-[#00ff66]/60 hover:bg-[#00ff66]/10"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#00ff66]/30 bg-[#00ff66]/10 text-sm font-bold text-[#00ff66]">
                                {entry.position}
                              </div>

                              <div className="min-w-0">
                                <div className="truncate text-[10px] uppercase tracking-[0.14em] text-[#00ff66]">
                                  {entry.displayedRank}
                                </div>
                                <div className="mt-1 truncate text-sm font-semibold text-white group-hover:text-[#00ff66]">
                                  {entry.name}
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 text-right">
                              <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500">
                                Lvl
                              </div>
                              <div className="text-lg font-bold text-white">
                                {entry.currentLevel}
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
                            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2">
                              <div className="text-gray-500">XP</div>
                              <div className="mt-1 font-bold text-[#00ff66]">
                                {entry.totalXp.toLocaleString()}
                              </div>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2">
                              <div className="text-gray-500">K</div>
                              <div className="mt-1 font-bold text-white">
                                {entry.kills.toLocaleString()}
                              </div>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2">
                              <div className="text-gray-500">D</div>
                              <div className="mt-1 font-bold text-white">
                                {entry.deaths.toLocaleString()}
                              </div>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2">
                              <div className="text-gray-500">TK</div>
                              <div className="mt-1 font-bold text-red-300">
                                {entry.teamkills.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <main className="order-1 xl:order-2 flex-1 flex flex-col items-center pt-24 sm:pt-32 xl:pt-40 px-4 sm:px-8">
          <h1 className="mt-10 text-3xl sm:text-4xl md:text-6xl font-bold tracking-[0.18em] sm:tracking-[0.3em] md:tracking-[0.4em] text-[#00ff66] text-center">
            101ST
            <br />
            DOOM BATTALION
          </h1>

          <p className="mt-4 max-w-2xl text-sm sm:text-base text-gray-300 text-center px-2">
            Operational Command & Personnel Management System
          </p>

          <div className="group mt-8 sm:mt-10 w-full max-w-5xl h-[240px] sm:h-[360px] lg:h-[540px] relative overflow-hidden rounded-2xl border border-[#00ff66]/30 shadow-[0_0_30px_rgba(0,255,100,0.3)]">
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

            <div className="absolute bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 flex max-w-[85%] flex-wrap justify-center gap-2 z-20">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-2 rounded-full transition-all ${
                    index === currentSlide
                      ? "w-7 sm:w-8 bg-[#00ff66]"
                      : "w-2 bg-gray-500 hover:bg-gray-300"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>

            <button
              onClick={() =>
                setCurrentSlide((prev) =>
                  prev === 0 ? slides.length - 1 : prev - 1,
                )
              }
              className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 bg-black/60 text-[#00ff66] p-2 sm:p-3 rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300 hover:scale-110 hover:bg-black/80 z-20"
              aria-label="Previous slide"
            >
              ◀
            </button>

            <button
              onClick={() =>
                setCurrentSlide((prev) =>
                  prev === slides.length - 1 ? 0 : prev + 1,
                )
              }
              className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 bg-black/60 text-[#00ff66] p-2 sm:p-3 rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300 hover:scale-110 hover:bg-black/80 z-20"
              aria-label="Next slide"
            >
              ▶
            </button>
          </div>

        </main>

        <aside className="order-3 w-full xl:w-[400px] xl:min-h-screen border-t xl:border-t-0 xl:border-l border-[#00ff66]/30 p-4 sm:p-6 bg-black/35 backdrop-blur-2xl shadow-2xl flex flex-col">
          <div className="mb-4">
            <h2 className="text-lg sm:text-xl text-[#00ff66] tracking-widest">
              Upcoming Events
            </h2>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[#00ff66]/30 bg-black/50 px-3 py-3">
              <button
                onClick={() => changeEventDate(-1)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#00ff66]/30 text-[#00ff66] hover:bg-[#00ff66]/10 hover:scale-105 transition-all"
              >
                ◀
              </button>

              <div className="flex-1 min-w-0 text-center">
                <div className="text-sm text-[#00ff66] font-semibold truncate">
                  {selectedEventDateLabel}
                </div>

                <div className="text-xs text-gray-400 mt-1 truncate">
                  {selectedEventDate.toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
              </div>

              <button
                onClick={() => changeEventDate(1)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#00ff66]/30 text-[#00ff66] hover:bg-[#00ff66]/10 hover:scale-105 transition-all"
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-[11px] tracking-[0.2em] uppercase text-[#00ff66]">
                  Next Operation
                </div>

                <div className="w-fit rounded-full border border-[#00ff66]/30 px-2 py-1 text-[10px] text-[#00ff66]">
                  SERVER {featuredEvent.server_id}
                </div>
              </div>

              <div className="mt-3 text-lg font-semibold text-white break-words">
                {featuredEvent.title}
              </div>

              <div className="mt-1 text-sm text-gray-300 break-words">
                {featuredEvent.personnel?.name || "Unknown"}
              </div>

              <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="w-fit rounded-lg bg-black/50 px-3 py-1 text-xs text-gray-200 border border-[#00ff66]/20">
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
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[#00ff66]">
                        Server {event.server_id}
                      </div>

                      <div className="font-semibold mt-2 text-white break-words">
                        {event.title}
                      </div>

                      <div className="text-gray-300 text-sm mt-1 break-words">
                        {event.personnel?.name || "Unknown"}
                      </div>
                    </div>

                    <div className="w-fit shrink-0 rounded-lg border border-[#00ff66]/25 bg-black/50 px-3 py-1 text-xs text-[#00ff66]">
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
                className="w-full flex items-center justify-between gap-3 p-4 rounded-2xl border border-[#00ff66]/35 bg-black/40 hover:bg-black/55 transition-all"
              >
                <span className="text-sm text-[#00ff66] tracking-[0.16em] sm:tracking-[0.2em] uppercase text-left">
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
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-[#00ff66]/80">
                            Server {event.server_id}
                          </div>

                          <div className="font-semibold mt-2 text-white/90 break-words">
                            {event.title}
                          </div>

                          <div className="text-gray-400 text-sm mt-1 break-words">
                            {event.personnel?.name || "Unknown"}
                          </div>
                        </div>

                        <div className="w-fit shrink-0 rounded-lg border border-[#00ff66]/15 bg-black/40 px-3 py-1 text-xs text-gray-300">
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
              className="w-full flex items-center justify-between gap-3 p-4 rounded-2xl border border-[#00ff66]/60 bg-black/50 hover:bg-black/70 transition-all cursor-pointer"
            >
              <span className="text-lg sm:text-xl text-[#00ff66] tracking-widest">
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
                weeklyOpen
                  ? "max-h-[1000px] opacity-100 mt-4"
                  : "max-h-0 opacity-0"
              }`}
            >
              <div className="p-4 rounded-2xl border border-[#00ff66]/40 bg-black/40">
                <div className="space-y-4">
                  {weeklyEvents.map((event) => {
                    const nextOccurrence = getNextOccurrence(
                      event.day,
                      event.hour,
                      event.minute,
                    );

                    return (
                      <div
                        key={event.name}
                        className="p-4 rounded-xl border border-[#00ff66]/30 bg-black/60 hover:border-[#00ff66] transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
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

                          <div className="w-fit rounded-lg border border-[#00ff66]/25 bg-black/50 px-3 py-1 text-[11px] text-[#00ff66] whitespace-nowrap">
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
                href: "ts3server://ts.101stdoombattalion.com",
              },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="block mb-4 px-4 py-3 text-center rounded-xl border border-[#00ff66]/30 hover:bg-[#00ff66]/10 hover:scale-[1.02] sm:hover:scale-105 transition-all break-words"
              >
                {item.label}
              </a>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
