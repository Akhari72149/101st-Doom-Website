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
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [previousStatus, setPreviousStatus] = useState<Record<number, boolean>>({});
  const [user, setUser] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);
  
/* ================= AUTH ================= */

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);

      if (user) {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        setRoles(data?.map((r) => r.role) || []);
      }
    };

    getUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/login");
  };

 /* ================= Page Const ================= */

const personnelItems = [
  {
    href: "/personnel-profile",
    title: "Personnel Profile",
  },
  {
    href: "/grand-orbat",
    title: "Grand ORBAT",
  },
  {
    href: "/roster",
    title: "Slotted Roster",
  },
  {
    href: "/admin/positions",
    title: "Slotting & Rank",
    allowedRoles: ["admin", "nco", "di"],
  },
  {
    href: "/admin/create",
    title: "User Creation",
    allowedRoles: ["admin", "recruiter"],
  },
  {
    href: "/admin/certifications",
    title: "Certification Management",
    allowedRoles: ["admin", "nco", "trainer"],
  },
  {
    href: "/certifications",
    title: "Certification Lookup",
  },
  {
    href: "/servers",
    title: "Server Booking",
  },
  {
    href: "/audit",
    title: "Audit Log",
    allowedRoles: ["nco", "admin", "trainer", "di"],
  },
  {
    href: "/admin/attendance",
    title: "Attendance Roster",
    allowedRoles: ["nco", "admin"],
  },
];

/* ================= How to Join  ================= */

const whoWeAreLinks = [
  {
    label: "Who We Are",
    href: "/Who-We-Are",
  },
  {
    label: "What we Offer",
    href: "/certs",
  },
];

const filteredPersonnelItems = personnelItems.filter(
  (item) =>
    !item.allowedRoles ||
    item.allowedRoles.some((role) => roles.includes(role))
);

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
  { name: "Tomahawk 1", day: 0, hour: 20, minute:0 }, 
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

    // Track status transitions
    setPreviousStatus((prev) => {
      const updated: Record<number, boolean> = { ...prev };

      data.forEach((server: Server) => {
        if (prev[server.id] === false && server.online === true) {
          // Server just came online
          updated[server.id] = true;
        } else {
          // Store current status for next comparison
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

  const toggleServer = (id: number) => {
    setExpandedServer((prev) => (prev === id ? null : id));
  };

  const onlineCount = servers.filter((s) => s.online).length;
  const offlineCount = servers.length - onlineCount;
  
  const justCameOnline = (server: Server) =>
  previousStatus[server.id] === false && server.online;

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
       className={`cursor-pointer rounded-xl border border-[#00ff66]/30 bg-black/60 overflow-hidden transition-all duration-300 hover:border-[#00ff66]
        ${justCameOnline(server) ? "animate-[glowBurst_1.2s_ease-out]" : ""}
        `}
         >
        {/* HEADER (Always Visible) */}
        <div className="p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                server.online
                  ? "bg-[#00ff66] shadow-[0_0_8px_#00ff66]"
                  : "bg-red-500 shadow-[0_0_8px_red]"
              }`}
            />
            <span>Server {server.id}</span>
          </div>

          <div className={`text-[10px] px-2 py-1 rounded-full ${
            server.online
            ? "bg-green-500/20 text-green-400"
            : "bg-red-500/20 text-red-400"
            }`}>
           {server.online ? "ONLINE" : "OFFLINE"}
          </div>
        </div>

        {/* ✅ EXPANDING SECTION (JUST PLAYER COUNT INFO) */}
        <div
          className={`grid transition-all duration-300 ${
            isOpen && server.online
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div className="border-t border-[#00ff66]/20 p-4 text-sm text-gray-300">
              <div className="text-[#00ff66]">
                Players Online
              </div>

              <div className="mt-2 text-xs font-bold">
                {server.players} Active Players
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
  {/* ================= PERSONNEL COMMAND DROPDOWN ================= */}

<div className="relative group z-52">
  

  {/* MAIN BUTTON */}
  <button
    onClick={() => router.push("/pcs")}
    className="px-8 py-3 border border-[#00ff66] rounded-lg 
               text-[#00ff66] hover:bg-[#00ff66] 
               hover:text-black hover:scale-105 
               transition-all w-full"
  >
    Enter Personnel Command
  </button>

  

  {/* DROPDOWN MENU */}
  <div
    className="
      absolute left-0 top-full w-full pt-2
      opacity-0 invisible
      group-hover:opacity-100
      group-hover:visible
      transition-all duration-200
      pointer-events-none
      group-hover:pointer-events-auto
    "
  >
    <div className="bg-black/95 border border-[#00ff66]/40 rounded-lg p-2 space-y-2 max-h-[400px] overflow-y-auto">


      {filteredPersonnelItems.map((item) => (
        <button
          key={item.href}
          onClick={() => router.push(item.href)}
          className="w-full text-left px-4 py-2 rounded-md 
                     text-[#00ff66] hover:bg-[#00ff66]/10 
                     transition-all text-sm"
        >
          {item.title}
        </button>
      ))}

    </div>
  </div>

</div>



{/* Row With Offset Buttons */}
<div className="flex gap-8">

  {/* ================= LEFT = How to Join ================= */}
  <div className="relative group translate-x-[-20px] z-50">

    {/* MAIN BUTTON */}
    <button
      onClick={() => router.push("/Join")}
      className="px-8 py-3 border border-[#00ff66] rounded-lg 
                 text-[#00ff66] hover:bg-[#00ff66] 
                 hover:text-black hover:scale-105 
                 transition-all w-full"
    >
      How to Join
    </button>

    {/* DROPDOWN */}
    <div
      className="
        absolute left-0 top-full w-full pt-2
        opacity-0 invisible
        group-hover:opacity-100
        group-hover:visible
        transition-all duration-200
        pointer-events-none
        group-hover:pointer-events-auto
      "
    >
      <div className="bg-black/95 border border-[#00ff66]/40 rounded-lg p-2 space-y-2">

        {whoWeAreLinks.map((item) => (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            className="w-full text-left px-4 py-2 rounded-md 
                       text-[#00ff66] hover:bg-[#00ff66]/10 
                       transition-all text-sm"
          >
            {item.label}
          </button>
        ))}

      </div>
    </div>

  </div>

  {/* ================= RIGHT = GALACTIC CAMPAIGN ================= */}
  <div className="relative group translate-x-[20px] z-51">

    {/* MAIN BUTTON */}
    <button
      onClick={() => router.push("/Galactic-Campaign")}
      className="px-8 py-3 border border-[#00ff66] rounded-lg 
                 text-[#00ff66] hover:bg-[#00ff66] 
                 hover:text-black hover:scale-105 
                 transition-all w-full"
    >
      Galactic Campaign
    </button>

    {/* DROPDOWN MENU */}
    <div
      className="
        absolute left-0 top-full w-full pt-2
        opacity-0 invisible
        group-hover:opacity-100
        group-hover:visible
        transition-all duration-200
        pointer-events-none
        group-hover:pointer-events-auto
      "
    >
      <div className="bg-black/95 border border-[#00ff66]/40 rounded-lg p-2 space-y-2">

        {/* Always Visible */}
        <button
          onClick={() => router.push("/GC-Platoon-Logi")}
          className="w-full px-4 py-2 text-left rounded-md
                     text-[#00ff66] hover:bg-[#00ff66]/10
                     transition-all text-sm"
        >
          Platoon Logistics
        </button>

        {/* Role Restricted */}
        {(roles.includes("admin") || roles.includes("logistics")) && (
          <button
            onClick={() => router.push("/GC-Logi")}
            className="w-full px-4 py-2 text-left rounded-md
                       text-[#00ff66] hover:bg-[#00ff66]/10
                       transition-all text-sm"
          >
            Battalion Logistics
          </button>
        )}

      </div>
    </div>

  </div>

</div>

{/* ================= ART OF WAR (Now Below The Row) ================= */}
<button
  onClick={() => router.push("/Art-of-War")}
  className="px-8 py-3 border border-[#00ff66] rounded-lg 
             text-[#00ff66] hover:bg-[#00ff66] 
             hover:text-black hover:scale-105 
             transition-all"
>
  Art of War
</button>

</div>



          <div className="group mt-20 w-[95%] max-w-4xl h-[500px] relative overflow-hidden rounded-2xl border border-[#00ff66]/30 shadow-[0_0_30px_rgba(0,255,100,0.3)]">

  {/* SLIDES */}
  {slides.map((slide, index) => (
    <img
      loading="lazy"
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
  
  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
  {slides.map((_, index) => (
    <div
      key={index}
      className={`h-2 rounded-full transition-all ${
        index === currentSlide
          ? "w-6 bg-[#00ff66]"
          : "w-2 bg-gray-500"
      }`}
    />
  ))}
</div>

  {/* ================= LEFT ARROW ================= */}
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
               hover:scale-110 hover:bg-black/80"
  >
    ◀
  </button>

  {/* ================= RIGHT ARROW ================= */}
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
               hover:scale-110 hover:bg-black/80"
  >
    ▶
  </button>

</div>

        </div>

        {/* ================= RIGHT PANEL ================= */}
        <div className="w-[380px] border-l border-[#00ff66]/30 p-6 bg-black/50 backdrop-blur-2xl shadow-2xl flex flex-col">

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
          <div className="hidden">
  101st Doom Battalion  
  Star Wars MilSim  
  Military Roleplay  
  Arma Unit  
  Tactical Gaming Community  
</div>

{/* ================= WEEKLY EVENTS ================= */}
<div className="mt-8">
  
  {/* CLICKABLE HEADER */}
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

  {/* COLLAPSIBLE CONTENT */}
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
          );
        })}
      </div>
    </div>
  </div>

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
