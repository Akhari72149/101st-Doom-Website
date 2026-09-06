"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { animate, stagger } from "animejs";
import {
  Activity,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Code2,
  ExternalLink,
  Gamepad2,
  Headphones,
  Instagram,
  Medal,
  MessageCircle,
  RadioTower,
  Shield,
  Trophy,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";

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
    // Fetches are intentionally scoped to selected date changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Polling setup is intentionally created once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const params = new URLSearchParams({
      kind: "events",
      start: start.toISOString(),
      end: end.toISOString(),
    });
    const response = await fetch(`/api/home-dashboard?${params}`, { cache: "no-store" });
    const body = (await response.json().catch(() => null)) as { events?: Event[] } | null;
    if (!response.ok || !body) {
      setEvents([]);
      setPastEvents([]);
      return;
    }
    const safeEvents = body.events || [];

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

      const params = new URLSearchParams({
        kind: "highlights",
        start: start.toISOString(),
        end: end.toISOString(),
      });
      const response = await fetch(`/api/home-dashboard?${params}`, { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as {
        highlights?: AuditHighlight[];
      } | null;
      if (!response.ok || !body) {
        setDailyHighlights([]);
        return;
      }

      const filtered = (body.highlights || [])
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
    <div className="boot relative min-h-screen overflow-x-hidden bg-[#020704] text-white font-orbitron">
      <div
        className="fixed inset-0 bg-center bg-no-repeat bg-cover opacity-12 pointer-events-none z-0"
        style={{ backgroundImage: "url('/background/bg.jpg')" }}
      />
      <div className="fixed inset-0 z-0 bg-[linear-gradient(90deg,rgba(0,255,102,0.045)_1px,transparent_1px),linear-gradient(rgba(0,255,102,0.035)_1px,transparent_1px)] bg-[size:72px_72px]" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_top,rgba(0,255,102,0.13),transparent_34%),linear-gradient(180deg,rgba(2,7,4,0.66),#020704_82%)]" />

      <div className="relative z-10 mx-auto w-full max-w-[1840px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-[#00ff66]/15 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.34em] text-[#00ff66]/60">
              Operational Command System
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-[0.16em] text-[#00ff66] sm:text-5xl lg:text-6xl">
              101ST DOOM BATTALION
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">
              Personnel, operations, server activity, and Arma progression from
              one live command surface.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[680px]">
            <div className="border-l border-[#00ff66]/30 bg-black/25 px-4 py-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-gray-500">
                <Wifi className="h-3.5 w-3.5 text-[#00ff66]" />
                Online
              </div>
              <div className="mt-2 text-2xl font-bold text-white">
                {onlineCount}
              </div>
            </div>
            <div className="border-l border-red-400/30 bg-black/25 px-4 py-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-gray-500">
                <WifiOff className="h-3.5 w-3.5 text-red-300" />
                Offline
              </div>
              <div className="mt-2 text-2xl font-bold text-white">
                {offlineCount}
              </div>
            </div>
            <div className="border-l border-[#00ff66]/30 bg-black/25 px-4 py-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-gray-500">
                <CalendarDays className="h-3.5 w-3.5 text-[#00ff66]" />
                Events
              </div>
              <div className="mt-2 text-2xl font-bold text-white">
                {events.length}
              </div>
            </div>
            <div className="border-l border-[#00ff66]/30 bg-black/25 px-4 py-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-gray-500">
                <Users className="h-3.5 w-3.5 text-[#00ff66]" />
                Players
              </div>
              <div className="mt-2 text-2xl font-bold text-white">
                {totalPlayers}
              </div>
            </div>
          </div>
        </header>

        <main className="grid gap-5 py-5 xl:grid-cols-[minmax(0,1fr)_430px]">
          <section className="min-w-0 space-y-5">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
              <div className="relative min-h-[360px] overflow-hidden border border-[#00ff66]/20 bg-black/35 shadow-[0_0_36px_rgba(0,255,102,0.08)] sm:min-h-[520px]">
                {slides.map((slide, index) => (
                  <div
                    key={slide}
                    className={`absolute inset-0 transition-all duration-1000 ${
                      index === currentSlide
                        ? "opacity-100 scale-105"
                        : "opacity-0 scale-100"
                    }`}
                  >
                    <Image
                      src={slide}
                      alt=""
                      fill
                      sizes="(max-width: 1024px) 100vw, 70vw"
                      priority={index === 0}
                      aria-hidden={index !== currentSlide}
                      className="object-cover"
                    />
                  </div>
                ))}

                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.86),rgba(0,0,0,0.16)_58%,rgba(0,0,0,0.74)),linear-gradient(0deg,rgba(0,0,0,0.78),transparent_50%)]" />

                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-2 border border-[#00ff66]/25 bg-black/45 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-[#00ff66]">
                      <Shield className="h-3.5 w-3.5" />
                      Live Unit Dashboard
                    </div>
                    <h2 className="mt-4 text-3xl font-bold text-white sm:text-5xl">
                      Command, roster, and operations at a glance.
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-gray-300">
                      Track server state, scheduled operations, commendations,
                      weekly events, and Arma XP without leaving the home page.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => router.push("/personnel-profile")}
                        className="border border-[#00ff66]/45 bg-[#00ff66]/10 px-4 py-2 text-sm font-semibold text-[#00ff66] transition hover:bg-[#00ff66]/18"
                      >
                        Personnel Profiles
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push("/member-link")}
                        className="border border-white/15 bg-black/40 px-4 py-2 text-sm text-white transition hover:border-[#00ff66]/40 hover:text-[#00ff66]"
                      >
                        Link Steam
                      </button>
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-5 right-5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentSlide((prev) =>
                        prev === 0 ? slides.length - 1 : prev - 1,
                      )
                    }
                    className="grid h-10 w-10 place-items-center border border-[#00ff66]/25 bg-black/55 text-[#00ff66] transition hover:bg-[#00ff66]/10"
                    aria-label="Previous slide"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentSlide((prev) =>
                        prev === slides.length - 1 ? 0 : prev + 1,
                      )
                    }
                    className="grid h-10 w-10 place-items-center border border-[#00ff66]/25 bg-black/55 text-[#00ff66] transition hover:bg-[#00ff66]/10"
                    aria-label="Next slide"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>

                <div className="absolute left-5 top-5 flex max-w-[70%] flex-wrap gap-2">
                  {slides.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setCurrentSlide(index)}
                      className={`h-1.5 rounded-full transition-all ${
                        index === currentSlide
                          ? "w-8 bg-[#00ff66]"
                          : "w-3 bg-white/35 hover:bg-white/70"
                      }`}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-5">
                <div className="border border-[#00ff66]/15 bg-black/35 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.24em] text-[#00ff66]/60">
                        Current Time
                      </p>
                      <p className="mt-2 text-3xl font-bold text-white">
                        {time.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </p>
                    </div>
                    <Clock3 className="h-8 w-8 text-[#00ff66]/70" />
                  </div>
                </div>

                <div className="border border-[#00ff66]/15 bg-black/35 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.24em] text-[#00ff66]/60">
                        Next Operation
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {featuredEvent?.title || "No upcoming event"}
                      </p>
                      <p className="mt-1 text-sm text-gray-400">
                        {featuredEvent
                          ? getRelativeCountdown(
                              new Date(featuredEvent.start_time),
                            )
                          : selectedEventDateLabel}
                      </p>
                    </div>
                    <CalendarDays className="h-8 w-8 text-[#00ff66]/70" />
                  </div>
                </div>

                <div className="border border-[#00ff66]/15 bg-black/35 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.24em] text-[#00ff66]/60">
                        XP Leader
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {xpLeaderboard[0]?.name || "Awaiting records"}
                      </p>
                      <p className="mt-1 text-sm text-gray-400">
                        {xpLeaderboard[0]
                          ? `Level ${xpLeaderboard[0].currentLevel} - ${xpLeaderboard[0].totalXp.toLocaleString()} XP`
                          : "Link Steam to enter the board"}
                      </p>
                    </div>
                    <Trophy className="h-8 w-8 text-[#00ff66]/70" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid items-start gap-5 lg:grid-cols-2">
              <div className="border border-[#00ff66]/15 bg-black/35">
                <button
                  type="button"
                  onClick={() => setServersOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between gap-3 border-b border-[#00ff66]/15 px-5 py-4 text-left transition hover:bg-white/[0.03]"
                >
                  <span className="inline-flex items-center gap-3 text-[#00ff66]">
                    <RadioTower className="h-5 w-5" />
                    <span className="text-sm uppercase tracking-[0.22em]">
                      Servers
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 text-[#00ff66] transition ${
                      serversOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <div
                  className={`overflow-hidden transition-all duration-500 ${
                    serversOpen ? "max-h-[1400px] opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="space-y-3 p-4">
                    {initialLoad ? (
                      <div className="py-6 text-center text-sm text-gray-400 animate-pulse">
                        Checking server status...
                      </div>
                    ) : servers.length === 0 ? (
                      <div className="py-6 text-center text-sm text-gray-400">
                        No servers found.
                      </div>
                    ) : (
                      servers.map((server) => {
                        const isOpen = expandedServer === server.id;
                        const population =
                          server.maxPlayers && server.maxPlayers > 0
                            ? Math.min(
                                100,
                                Math.round(
                                  (server.players / server.maxPlayers) * 100,
                                ),
                              )
                            : 0;

                        return (
                          <div
                            key={server.id}
                            className={`border bg-black/45 transition ${
                              server.online
                                ? "border-[#00ff66]/25"
                                : "border-red-400/20"
                            } ${
                              justCameOnline(server)
                                ? "animate-[glowBurst_1.2s_ease-out]"
                                : ""
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleServer(server.id)}
                              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                            >
                              <span className="flex min-w-0 items-center gap-3">
                                <span
                                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                    server.online
                                      ? "bg-[#00ff66] shadow-[0_0_10px_#00ff66]"
                                      : "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.7)]"
                                  }`}
                                />
                                <span className="truncate text-sm font-semibold text-white">
                                  Server {server.id}
                                </span>
                              </span>
                              <span
                                className={`shrink-0 border px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${
                                  server.online
                                    ? "border-[#00ff66]/25 text-[#00ff66]"
                                    : "border-red-400/25 text-red-300"
                                }`}
                              >
                                {server.online ? "Online" : "Offline"}
                              </span>
                            </button>

                            <div
                              className={`grid transition-all duration-300 ${
                                isOpen && server.online
                                  ? "grid-rows-[1fr] opacity-100"
                                  : "grid-rows-[0fr] opacity-0"
                              }`}
                            >
                              <div className="overflow-hidden">
                                <div className="border-t border-[#00ff66]/10 px-4 py-4">
                                  {server.missionFile && (
                                    <p className="mb-3 break-words text-xs text-gray-400">
                                      {server.missionFile}
                                    </p>
                                  )}
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500">
                                      Population
                                    </span>
                                    <span className="font-semibold text-white">
                                      {server.players ?? 0} /{" "}
                                      {server.maxPlayers || "?"}
                                    </span>
                                  </div>
                                  <div className="mt-3 h-2 overflow-hidden bg-white/10">
                                    <div
                                      className="h-full bg-[#00ff66] transition-all duration-500"
                                      style={{ width: `${population}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="border border-[#00ff66]/15 bg-black/35">
                <button
                  type="button"
                  onClick={() => setLeaderboardOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between gap-3 border-b border-[#00ff66]/15 px-5 py-4 text-left transition hover:bg-white/[0.03]"
                >
                  <span className="inline-flex items-center gap-3 text-[#00ff66]">
                    <Trophy className="h-5 w-5" />
                    <span className="text-sm uppercase tracking-[0.22em]">
                      XP Leaderboard
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 text-[#00ff66] transition ${
                      leaderboardOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <div
                  className={`overflow-hidden transition-all duration-500 ${
                    leaderboardOpen
                      ? "max-h-[980px] opacity-100"
                      : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="space-y-3 p-4">
                    <div className="border border-[#00ff66]/15 bg-black/45 p-3 text-xs leading-5 text-gray-400">
                      Link your Steam account to your personnel profile to appear
                      on the board and earn XP from tracked Arma events.
                      <button
                        type="button"
                        onClick={() => router.push("/member-link")}
                        className="ml-2 text-[#00ff66] underline decoration-[#00ff66]/40 underline-offset-4 transition hover:text-white"
                      >
                        Link Steam
                      </button>
                    </div>

                    {loadingXpLeaderboard ? (
                      <div className="border border-[#00ff66]/15 bg-black/40 p-4 text-center text-sm text-gray-400 animate-pulse">
                        Loading XP standings...
                      </div>
                    ) : xpLeaderboard.length === 0 ? (
                      <div className="border border-[#00ff66]/15 bg-black/40 p-4 text-sm text-gray-400">
                        No XP records yet.
                      </div>
                    ) : (
                      xpLeaderboard.slice(0, 5).map((entry) => (
                        <button
                          key={entry.personnelId}
                          type="button"
                          onClick={() =>
                            router.push(
                              `/personnel-profile?id=${entry.personnelId}`,
                            )
                          }
                          className="group w-full border border-[#00ff66]/15 bg-black/45 p-3 text-left transition hover:border-[#00ff66]/55 hover:bg-[#00ff66]/10"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="grid h-8 w-8 shrink-0 place-items-center border border-[#00ff66]/30 bg-[#00ff66]/10 text-sm font-bold text-[#00ff66]">
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
                                Level
                              </div>
                              <div className="text-lg font-bold text-white">
                                {entry.currentLevel}
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
                            {[
                              ["XP", entry.totalXp, "text-[#00ff66]"],
                              ["K", entry.kills, "text-white"],
                              ["D", entry.deaths, "text-white"],
                              ["TK", entry.teamkills, "text-red-300"],
                            ].map(([label, value, className]) => (
                              <div
                                key={label}
                                className="border border-white/10 bg-white/[0.03] px-2 py-2"
                              >
                                <div className="text-gray-500">{label}</div>
                                <div className={`mt-1 font-bold ${className}`}>
                                  {Number(value).toLocaleString()}
                                </div>
                              </div>
                            ))}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid items-start gap-5 lg:grid-cols-2">
              <div className="border border-[#00ff66]/15 bg-black/35">
              <button
                type="button"
                onClick={() => setHighlightsOpen((prev) => !prev)}
                className="flex w-full items-center justify-between gap-3 border-b border-[#00ff66]/15 px-5 py-4 text-left transition hover:bg-white/[0.03]"
              >
                <span className="inline-flex items-center gap-3 text-[#00ff66]">
                  <Medal className="h-5 w-5" />
                  <span className="text-sm uppercase tracking-[0.22em]">
                    Commendations
                  </span>
                </span>
                <ChevronDown
                  className={`h-5 w-5 text-[#00ff66] transition ${
                    highlightsOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              <div
                className={`overflow-hidden transition-all duration-500 ${
                  highlightsOpen
                    ? "max-h-[520px] opacity-100"
                    : "max-h-0 opacity-0"
                }`}
              >
                <div className="max-h-[460px] overflow-y-auto p-4">
                  {loadingHighlights ? (
                    <div className="py-6 text-center text-sm text-gray-400 animate-pulse">
                      Loading today&apos;s commendations...
                    </div>
                  ) : dailyHighlights.length === 0 ? (
                    <div className="py-4 text-sm text-gray-400">
                      No promotions or certifications logged today yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {dailyHighlights.map((item) => (
                        <div
                          key={item.id}
                          className="border border-[#00ff66]/15 bg-black/45 p-4"
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

              <div className="border border-cyan-300/15 bg-black/35">
              <button
                type="button"
                onClick={() => setSiteVersionOpen((prev) => !prev)}
                className="flex w-full items-center justify-between gap-3 border-b border-cyan-300/15 px-5 py-4 text-left transition hover:bg-white/[0.03]"
              >
                <span className="inline-flex items-center gap-3 text-cyan-300">
                  <Code2 className="h-5 w-5" />
                  <span className="text-sm uppercase tracking-[0.22em]">
                    Website Build
                  </span>
                </span>
                <ChevronDown
                  className={`h-5 w-5 text-cyan-300 transition ${
                    siteVersionOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              <div
                className={`overflow-hidden transition-all duration-500 ${
                  siteVersionOpen
                    ? "max-h-[640px] opacity-100"
                    : "max-h-0 opacity-0"
                }`}
              >
                <div className="space-y-3 p-4">
                  {loadingSiteVersion ? (
                    <div className="py-4 text-center text-sm text-gray-400 animate-pulse">
                      Loading website version...
                    </div>
                  ) : !siteVersion ? (
                    <div className="border border-red-400/20 bg-red-500/5 p-4 text-sm text-red-300">
                      Unable to load website version data.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="border border-cyan-300/15 bg-black/45 p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">
                          Version
                        </div>
                        <div className="mt-2 text-2xl font-bold text-cyan-300">
                          {siteVersion.version}
                        </div>
                      </div>

                      <div className="border border-cyan-300/15 bg-black/45 p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">
                          Latest Commit
                        </div>
                        <div className="mt-2 text-sm text-white leading-relaxed break-words">
                          {siteVersion.commitMessage}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="border border-cyan-300/15 bg-black/45 p-4">
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

                        <div className="border border-cyan-300/15 bg-black/45 p-4">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">
                            Author
                          </div>
                          <div className="mt-2 text-sm text-white break-words">
                            {siteVersion.author}
                          </div>
                        </div>
                      </div>

                      <div className="border border-cyan-300/15 bg-black/45 p-4">
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
            </div>
          </section>

          <aside className="space-y-5 xl:sticky xl:top-5 xl:h-fit">
            <section className="border border-[#00ff66]/15 bg-black/35 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[#00ff66]/60">
                    Operations
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">
                    Upcoming Events
                  </h2>
                </div>
                <CalendarDays className="h-7 w-7 text-[#00ff66]/70" />
              </div>

              <div className="mt-5 flex items-center justify-between gap-3 border border-[#00ff66]/20 bg-black/45 px-3 py-3">
              <button
                type="button"
                onClick={() => changeEventDate(-1)}
                className="grid h-10 w-10 shrink-0 place-items-center border border-[#00ff66]/25 text-[#00ff66] transition hover:bg-[#00ff66]/10"
                aria-label="Previous day"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1 text-center">
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
                type="button"
                onClick={() => changeEventDate(1)}
                className="grid h-10 w-10 shrink-0 place-items-center border border-[#00ff66]/25 text-[#00ff66] transition hover:bg-[#00ff66]/10"
                aria-label="Next day"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={jumpToToday}
              className="mt-3 w-full border border-[#00ff66]/20 bg-black/40 px-4 py-2 text-sm text-[#00ff66] transition hover:bg-[#00ff66]/10"
            >
              Jump to Today
            </button>

          {featuredEvent && (
            <div className="mt-5 border border-[#00ff66]/35 bg-[#00ff66]/8 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] tracking-[0.2em] uppercase text-[#00ff66]">
                  Next Operation
                </div>

                <div className="w-fit border border-[#00ff66]/25 px-2 py-1 text-[10px] text-[#00ff66]">
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
                <div className="w-fit border border-[#00ff66]/15 bg-black/50 px-3 py-1 text-xs text-gray-200">
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
                <div className="py-5 text-center text-sm text-gray-400">
                  No upcoming events for this date.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {regularEvents.map((event) => (
                    <div
                      key={event.id}
                      className="border border-[#00ff66]/15 bg-black/45 p-4 transition hover:border-[#00ff66]/45"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-[#00ff66]">
                            Server {event.server_id}
                          </div>
                          <div className="mt-2 break-words font-semibold text-white">
                            {event.title}
                          </div>
                          <div className="mt-1 break-words text-sm text-gray-300">
                            {event.personnel?.name || "Unknown"}
                          </div>
                        </div>
                        <div className="w-fit shrink-0 border border-[#00ff66]/20 bg-black/50 px-3 py-1 text-xs text-[#00ff66]">
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
                type="button"
                onClick={() => setPastEventsOpen((prev) => !prev)}
                className="flex w-full items-center justify-between gap-3 border border-[#00ff66]/25 bg-black/40 p-4 transition hover:bg-black/55"
              >
                <span className="text-sm text-[#00ff66] tracking-[0.16em] sm:tracking-[0.2em] uppercase text-left">
                  Earlier Today ({pastEvents.length})
                </span>

                <ChevronDown
                  className={`h-5 w-5 text-[#00ff66] transition ${
                    pastEventsOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              <div
                className={`overflow-hidden transition-all duration-500 ${
                  pastEventsOpen
                    ? "max-h-[1000px] opacity-100 mt-4"
                    : "max-h-0 opacity-0"
                }`}
              >
                <div className="space-y-3">
                  {pastEvents.map((event) => (
                    <div
                      key={event.id}
                      className="border border-[#00ff66]/10 bg-black/35 p-4 opacity-80 transition hover:opacity-100"
                    >
                      <div className="flex items-start justify-between gap-3">
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

                        <div className="w-fit shrink-0 border border-[#00ff66]/15 bg-black/40 px-3 py-1 text-xs text-gray-300">
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
            </section>

          <div className="hidden">
            101st Doom Battalion Star Wars MilSim Military Roleplay Arma Unit
            Tactical Gaming Community
          </div>

            <section className="border border-[#00ff66]/15 bg-black/35">
            <button
              type="button"
              onClick={() => setWeeklyOpen(!weeklyOpen)}
              className="flex w-full items-center justify-between gap-3 border-b border-[#00ff66]/15 px-5 py-4 text-left transition hover:bg-white/[0.03]"
            >
              <span className="inline-flex items-center gap-3 text-[#00ff66]">
                <Activity className="h-5 w-5" />
                <span className="text-sm uppercase tracking-[0.22em]">
                  Weekly Events
                </span>
              </span>
              <ChevronDown
                className={`h-5 w-5 text-[#00ff66] transition ${
                  weeklyOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            <div
              className={`overflow-hidden transition-all duration-500 ${
                weeklyOpen
                  ? "max-h-[1000px] opacity-100 mt-4"
                : "max-h-0 opacity-0"
              }`}
            >
              <div className="p-4">
                <div className="space-y-3">
                  {weeklyEvents.map((event) => {
                    const nextOccurrence = getNextOccurrence(
                      event.day,
                      event.hour,
                      event.minute,
                    );

                    return (
                      <div
                        key={event.name}
                        className="border border-[#00ff66]/15 bg-black/45 p-4 transition hover:border-[#00ff66]/45"
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

                          <div className="w-fit border border-[#00ff66]/20 bg-black/50 px-3 py-1 text-[11px] text-[#00ff66] whitespace-nowrap">
                            {getRelativeCountdown(nextOccurrence)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            </section>

            <section className="border border-[#00ff66]/15 bg-black/35 p-5">
              <h3 className="flex items-center gap-3 text-sm uppercase tracking-[0.22em] text-[#00ff66]">
                <Gamepad2 className="h-5 w-5" />
                Unit Connections
              </h3>

            {[
              {
                label: "Join Our Discord",
                href: "https://discord.gg/dZhRghrDfX",
                icon: MessageCircle,
              },
              {
                label: "Unit Reddit",
                href: "https://www.reddit.com/user/101stDBMediaTeam/",
                icon: BookOpen,
              },
              {
                label: "Unit Instagram",
                href: "https://www.instagram.com/101stdoombattalion_mediateam?igsh=MWk2d2t5cWd1amFhZw==",
                icon: Instagram,
              },
              {
                label: "Join TeamSpeak Server",
                href: "ts3server://ts.101stdoombattalion.com",
                icon: Headphones,
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex items-center justify-between gap-3 border border-[#00ff66]/15 bg-black/40 px-4 py-3 text-sm text-gray-200 transition hover:border-[#00ff66]/45 hover:bg-[#00ff66]/10 hover:text-[#00ff66]"
              >
                <span className="inline-flex min-w-0 items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0 text-[#00ff66]/80" />
                  <span className="truncate">{item.label}</span>
                </span>
                <ExternalLink className="h-4 w-4 shrink-0" />
              </a>
              );
            })}
            </section>
          </aside>
        </main>
      </div>
    </div>
  );
}
