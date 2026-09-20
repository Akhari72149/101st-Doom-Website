import type { Metadata } from "next";
import Image from "next/image";
import {
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Crown,
  Shield,
  Star,
  Users,
} from "lucide-react";

type Rank = {
  name: string;
  abbreviation: string;
  icon?: string;
  summary: string;
  requirements: string[];
  note?: string;
};

type RankTrack = {
  id: string;
  label: string;
  eyebrow: string;
  accent: "green" | "cyan" | "amber";
  ranks: Rank[];
};

export const metadata: Metadata = {
  title: "Rank Structure | 101st Doom Battalion",
  description:
    "View the 101st Doom Battalion rank structure, progression routes, and promotion requirements.",
};

const tracks: RankTrack[] = [
  {
    id: "entry",
    label: "Entry Progression",
    eyebrow: "Initial Training",
    accent: "cyan",
    ranks: [
      {
        name: "Clone Recruit",
        abbreviation: "CR",
        icon: "/rank-icons/clone-recruit.png",
        summary:
          "A new arrival to the unit who has not yet completed formal training, but is free to attend operations.",
        requirements: [],
      },
      {
        name: "Clone Cadet",
        abbreviation: "CR-C",
        icon: "/rank-icons/clone-cadet.png",
        summary:
          "Has completed either Basic Combat Training or the initial operation requirement. CLS and RTO training are now available.",
        requirements: [
          "Attend BCT, or attend 4 operations",
          "At least 1 attendance must be a Main Operation",
        ],
      },
      {
        name: "Clone Trooper",
        abbreviation: "CT",
        icon: "/rank-icons/clone-trooper.png",
        summary:
          "Has completed the basic training and attendance required to qualify as a full trooper. All basic certifications are now open for training.",
        requirements: [
          "Complete BCT",
          "Attend 4 operations",
          "At least 1 attendance must be a Main Operation",
        ],
      },
    ],
  },
  {
    id: "trooper",
    label: "Trooper Progression",
    eyebrow: "Enlisted Service",
    accent: "green",
    ranks: [
      {
        name: "Clone Trooper (Private Third Class)",
        abbreviation: "CT/PTC",
        summary:
          "The first slotted promotion, recognising time in the squad and a demonstrated commitment to the unit.",
        requirements: ["Slotted member", "60 days TIG", "Attendance above 50%"],
      },
      {
        name: "Clone Trooper (Private Second Class)",
        abbreviation: "CT/PSC",
        summary:
          "The second slotted promotion, recognising continued commitment and growing usefulness to the squad through certifications.",
        requirements: ["Slotted member", "80 days TIG", "Attendance above 50%", "140 DT"],
      },
      {
        name: "Clone Trooper (Private First Class)",
        abbreviation: "CT/PFC",
        summary:
          "The final Clone Trooper promotion, awarded for commitment and proven reliability as a team and squad member.",
        requirements: ["Slotted member", "100 days TIG", "Attendance above 50%", "240 DT"],
      },
      {
        name: "Clone Senior Trooper / Senior Clone Trooper",
        abbreviation: "CST",
        icon: "/rank-icons/clone-senior-trooper.png",
        summary:
          "The first rank beyond Clone Trooper and the first rank to unlock custom armour.",
        requirements: [
          "Slotted member",
          "125 days TIG",
          "Attendance above 50%",
          "365 days from CT",
        ],
      },
      {
        name: "Clone Veteran Trooper / Veteran Clone Trooper",
        abbreviation: "CVT",
        icon: "/rank-icons/clone-veteran-trooper.png",
        summary:
          "Continues enlisted progression and begins unlocking further armour customisation, including chest rigs and thermals.",
        requirements: ["Slotted member", "100 days TIG", "Attendance above 70%", "465 DT"],
      },
      {
        name: "Clone Specialist",
        abbreviation: "CSP",
        icon: "/rank-icons/clone-specialist.png",
        summary:
          "The second-most senior non-NCO position. Specialists are expected to be highly capable squad members who assist NCOs and support newcomers.",
        requirements: [
          "Slotted member",
          "120 days TIG",
          "Attendance above 80%",
          "Company approval",
          "585 DT",
        ],
      },
      {
        name: "Clone Technical Specialist",
        abbreviation: "CTS",
        summary:
          "The most senior non-NCO rank, reserved for exceptionally dedicated members who consistently support their squad.",
        requirements: [
          "Slotted member",
          "145 days TIG",
          "Attendance above 90%",
          "Company approval",
        ],
      },
    ],
  },
  {
    id: "corporal",
    label: "Corporal Cadre",
    eyebrow: "Junior NCO",
    accent: "amber",
    ranks: [
      {
        name: "Clone Lance Corporal",
        abbreviation: "LCP",
        icon: "/rank-icons/clone-lance-corporal.png",
        summary:
          "Awarded upon taking a Corporal NCO billet and beginning the Corporals Course.",
        requirements: ["Slotted into a CP NCO billet"],
      },
      {
        name: "Clone Corporal",
        abbreviation: "CP",
        icon: "/rank-icons/clone-corporal.png",
        summary: "The base Corporal rank awarded after completing the Corporals Course.",
        requirements: ["Complete the CP Course"],
      },
      {
        name: "Clone Senior Corporal",
        abbreviation: "CSC",
        icon: "/rank-icons/clone-senior-corporal.png",
        summary:
          "The first senior Corporal rank, recognising consistent attendance and assistance to the squad leader with training and organisation.",
        requirements: ["Slotted member", "100 days TIG", "Attendance above 50%"],
      },
      {
        name: "Clone Veteran Corporal",
        abbreviation: "CVC",
        summary:
          "The second senior Corporal rank, requiring increased attendance and continued support of troopers and the squad leader.",
        requirements: ["Slotted member", "120 days TIG", "Attendance above 70%"],
      },
      {
        name: "Clone Master Corporal",
        abbreviation: "CMC",
        summary:
          "The most senior regular Corporal rank, recognising strong attendance, team leadership, and support provided to the Sergeant.",
        requirements: [
          "Slotted member",
          "145 days TIG",
          "Attendance above 80%",
          "Company approval",
        ],
      },
      {
        name: "Clone First Corporal",
        abbreviation: "CFC",
        summary:
          "The senior-most Corporal in a platoon and the leading candidate for an available Sergeant billet. Only one may exist per platoon.",
        requirements: [
          "Slotted member",
          "165 days TIG",
          "Attendance above 90%",
          "Company approval",
          "Selected by Platoon HQ as the best candidate",
        ],
      },
    ],
  },
  {
    id: "sergeant",
    label: "Sergeant Cadre",
    eyebrow: "Squad Leadership",
    accent: "amber",
    ranks: [
      {
        name: "Clone Lance Sergeant",
        abbreviation: "LCS",
        summary:
          "Awarded upon taking a Sergeant NCO billet before completing the Sergeants Course.",
        requirements: ["Slotted into a CS NCO billet"],
      },
      {
        name: "Clone Sergeant",
        abbreviation: "CS",
        icon: "/rank-icons/clone-sergeant.png",
        summary: "The base Sergeant rank awarded after completing the Sergeants Course.",
        requirements: [
          "Complete the CS Course",
          "Complete the CP Course when advancing directly past a CP billet",
        ],
      },
      {
        name: "Clone Staff Sergeant",
        abbreviation: "CSS",
        icon: "/rank-icons/clone-staff-sergeant.png",
        summary:
          "The first senior Sergeant rank, recognising dependable leadership in training, organisation, and squad activity.",
        requirements: ["Slotted member", "100 days TIG", "Attendance above 50%"],
      },
      {
        name: "Clone Gunnery Sergeant",
        abbreviation: "CGS",
        summary:
          "The second senior Sergeant rank, requiring increased attendance and continued leadership of troopers and squad activity.",
        requirements: ["Slotted member", "120 days TIG", "Attendance above 70%"],
      },
      {
        name: "Clone Master Sergeant",
        abbreviation: "CMS",
        summary:
          "The most senior regular Sergeant rank, responsible for squad administration, training, and the overall welfare of the squad.",
        requirements: [
          "Slotted member",
          "145 days TIG",
          "Attendance above 80%",
          "Company approval",
        ],
      },
      {
        name: "Clone First Sergeant",
        abbreviation: "CFS",
        summary:
          "The senior-most Sergeant in a platoon and the leading candidate for an available Sergeant Major billet. Only one may exist per platoon.",
        requirements: [
          "Slotted member",
          "165 days TIG",
          "Attendance above 90%",
          "Company approval",
          "Selected by Platoon HQ as the best candidate",
        ],
      },
    ],
  },
  {
    id: "sergeant-major",
    label: "Sergeant Major Cadre",
    eyebrow: "Platoon Leadership",
    accent: "cyan",
    ranks: [
      {
        name: "Clone Sergeant Major",
        abbreviation: "CSM",
        icon: "/rank-icons/clone-sergeant-major.png",
        summary:
          "The first Sergeant Major rank, responsible for leading a platoon alongside the Platoon Commanding Officer.",
        requirements: [
          "Complete the CSM Course",
          "Complete CP and CS courses when advancing directly past those billets",
        ],
      },
      {
        name: "Clone Staff Sergeant Major",
        abbreviation: "SSM",
        summary:
          "A senior promotion for an experienced Sergeant Major who has demonstrated sustained dedication.",
        requirements: [
          "Slotted member",
          "200 days TIG",
          "Attendance above 80%",
          "Company approval",
        ],
      },
      {
        name: "Clone Battalion Sergeant Major",
        abbreviation: "BSM",
        summary: "The Battalion Sergeant Major rank for the battalion.",
        requirements: [],
        note: "Not currently in active use",
      },
    ],
  },
  {
    id: "officer",
    label: "Officer & Command",
    eyebrow: "Unit Leadership",
    accent: "green",
    ranks: [
      {
        name: "Clone Ensign",
        abbreviation: "CE",
        summary:
          "Awarded upon taking an officer billet before completing the Officer Candidate School course.",
        requirements: ["Slotted into a CL officer billet"],
      },
      {
        name: "Clone 2nd Lieutenant",
        abbreviation: "CL",
        icon: "/rank-icons/clone-second-lieutenant.png",
        summary: "The base officer rank awarded after completing the OCS Course.",
        requirements: [
          "Complete the OCS Course",
          "Complete CP, CS, and CSM courses when advancing directly past those billets",
        ],
      },
      {
        name: "Clone 1st Lieutenant",
        abbreviation: "CL",
        icon: "/rank-icons/clone-first-lieutenant.png",
        summary:
          "A senior Lieutenant promotion recognising dedication and experience, intended for the future Company XO rank.",
        requirements: [],
      },
      {
        name: "Clone Company Sergeant Major",
        abbreviation: "CSM",
        icon: "/rank-icons/company-sergeant-major.png",
        summary:
          "The Company Sergeant Major billet, assisting the Company Commanding Officer and Executive Officer.",
        requirements: [
          "Complete the CSM and OCS courses",
          "Complete CP and CS courses when advancing directly past those billets",
          "Company approval",
        ],
      },
      {
        name: "Clone Captain",
        abbreviation: "CC",
        icon: "/rank-icons/clone-captain.png",
        summary: "The Company XO billet and the intended future Company Lead billet.",
        requirements: [
          "Complete the Captains Course",
          "Complete OCS when advancing directly past a CL billet",
          "Candidates must be CSM or above",
        ],
      },
      {
        name: "Clone Major",
        abbreviation: "CMaj.",
        summary: "The Company Lead billet and intended future Battalion Lead.",
        requirements: ["Chosen by the Unit Owner"],
      },
      {
        name: "Battalion Commander",
        abbreviation: "BC",
        icon: "/rank-icons/battalion-commander.png",
        summary: "The Unit Owner and highest authority within the battalion.",
        requirements: ["Not applicable"],
      },
    ],
  },
];

const accentClasses = {
  green: {
    border: "border-[#00ff66]/30",
    text: "text-[#00ff66]",
    muted: "bg-[#00ff66]/8",
  },
  cyan: {
    border: "border-cyan-300/30",
    text: "text-cyan-300",
    muted: "bg-cyan-300/8",
  },
  amber: {
    border: "border-amber-300/30",
    text: "text-amber-300",
    muted: "bg-amber-300/8",
  },
} as const;

export default function RankStructurePage() {
  const rankCount = tracks.reduce((total, track) => total + track.ranks.length, 0);

  return (
    <main className="min-h-screen bg-[#020806] text-white">
      <header className="relative isolate min-h-[430px] overflow-hidden border-b border-[#00ff66]/25">
        <Image
          src="/background/bg.jpg"
          alt="101st Doom Battalion formation"
          fill
          priority
          className="-z-20 object-cover object-center opacity-25"
        />
        <div className="absolute inset-0 -z-10 bg-black/70" />
        <div className="mx-auto flex min-h-[430px] max-w-7xl items-center px-5 py-16 sm:px-8 lg:px-12">
          <div className="grid w-full items-center gap-10 lg:grid-cols-[1fr_280px]">
            <div>
              <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.24em] text-[#00ff66]">
                <Shield size={18} aria-hidden="true" />
                Personnel Doctrine
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-black uppercase sm:text-6xl">
                Rank Structure
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-[#b6c8bd] sm:text-lg">
                The full 101st Doom Battalion progression path, from a new Clone Recruit
                through enlisted service, NCO leadership, and battalion command.
              </p>
              <dl className="mt-8 grid max-w-3xl grid-cols-2 gap-px bg-[#00ff66]/20 sm:grid-cols-3">
                <div className="bg-[#020806]/90 p-4">
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-[#789486]">Published ranks</dt>
                  <dd className="mt-2 text-2xl font-black text-[#00ff66]">{rankCount}</dd>
                </div>
                <div className="bg-[#020806]/90 p-4">
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-[#789486]">Progression tracks</dt>
                  <dd className="mt-2 text-2xl font-black text-cyan-300">{tracks.length}</dd>
                </div>
                <div className="col-span-2 bg-[#020806]/90 p-4 sm:col-span-1">
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-[#789486]">Primary measures</dt>
                  <dd className="mt-2 text-sm font-bold text-amber-200">TIG · Attendance · Training</dd>
                </div>
              </dl>
            </div>
            <div className="hidden justify-self-end border border-[#00ff66]/25 bg-black/60 p-5 lg:block">
              <Image
                src="/icons/DBLogo.jpg"
                alt="101st Doom Battalion emblem"
                width={240}
                height={240}
                className="aspect-square object-contain"
              />
            </div>
          </div>
        </div>
      </header>

      <nav aria-label="Rank progression sections" className="border-b border-[#00ff66]/20 bg-black/80">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-5 py-4 sm:px-8 lg:px-12">
          {tracks.map((track) => (
            <a
              key={track.id}
              href={`#${track.id}`}
              className="shrink-0 border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#a8b9af] transition hover:border-[#00ff66]/50 hover:text-[#00ff66]"
            >
              {track.label}
            </a>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-12">
        <section className="mb-12 grid gap-px border border-[#00ff66]/20 bg-[#00ff66]/20 md:grid-cols-3">
          <div className="bg-[#031009] p-5">
            <div className="flex items-center gap-3 text-[#00ff66]"><CircleDot size={18} /><strong>TIG</strong></div>
            <p className="mt-2 text-sm leading-6 text-[#8ea397]">Time in Grade is counted from the effective date of the current rank.</p>
          </div>
          <div className="bg-[#031009] p-5">
            <div className="flex items-center gap-3 text-cyan-300"><Users size={18} /><strong>Attendance</strong></div>
            <p className="mt-2 text-sm leading-6 text-[#8ea397]">Attendance thresholds represent the minimum expected operational participation.</p>
          </div>
          <div className="bg-[#031009] p-5">
            <div className="flex items-center gap-3 text-amber-300"><Star size={18} /><strong>Approval</strong></div>
            <p className="mt-2 text-sm leading-6 text-[#8ea397]">Meeting minimum criteria does not replace billet availability or command approval.</p>
          </div>
        </section>

        <div className="space-y-16">
          {tracks.map((track, trackIndex) => {
            const accent = accentClasses[track.accent];
            return (
              <section key={track.id} id={track.id} className="scroll-mt-28">
                <header className={`mb-6 flex flex-col gap-3 border-l-4 ${accent.border} pl-5 sm:flex-row sm:items-end sm:justify-between`}>
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-[0.22em] ${accent.text}`}>{track.eyebrow}</p>
                    <h2 className="mt-2 text-2xl font-black uppercase sm:text-3xl">{track.label}</h2>
                  </div>
                  <div className="text-xs uppercase tracking-[0.16em] text-[#6f8579]">
                    Track {String(trackIndex + 1).padStart(2, "0")} · {track.ranks.length} ranks
                  </div>
                </header>

                <div className="grid gap-4 lg:grid-cols-2">
                  {track.ranks.map((rank, rankIndex) => (
                    <article key={`${rank.name}-${rankIndex}`} className={`relative border ${accent.border} bg-black/65 p-5 sm:p-6`}>
                      <div className="flex items-start gap-4">
                        <div className={`relative grid h-14 w-14 shrink-0 place-items-center border ${accent.border} ${accent.muted} text-sm font-black ${accent.text}`}>
                          {rank.icon ? (
                            <Image
                              src={rank.icon}
                              alt={`${rank.name} insignia`}
                              width={42}
                              height={42}
                              className="h-10 w-10 object-contain [image-rendering:pixelated]"
                            />
                          ) : (
                            rank.abbreviation
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#667c70]">
                            {String(rankIndex + 1).padStart(2, "0")}
                            <ChevronRight size={13} aria-hidden="true" />
                            {track.label}
                          </div>
                          <h3 className="mt-2 text-lg font-black leading-7 sm:text-xl">{rank.name}</h3>
                        </div>
                      </div>

                      <p className="mt-5 text-sm leading-7 text-[#a9bbb0]">{rank.summary}</p>

                      <div className="mt-5 border-t border-white/10 pt-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#758a7e]">Promotion requirements</p>
                        {rank.requirements.length ? (
                          <ul className="mt-3 space-y-2">
                            {rank.requirements.map((requirement) => (
                              <li key={requirement} className="flex gap-3 text-sm leading-6 text-[#d4e1d9]">
                                <CheckCircle2 size={16} className={`mt-1 shrink-0 ${accent.text}`} aria-hidden="true" />
                                <span>{requirement}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-3 text-sm text-[#788e82]">No formal requirement is currently published.</p>
                        )}
                      </div>

                      {rank.note && (
                        <div className="mt-5 flex items-center gap-3 border border-amber-300/25 bg-amber-300/5 p-3 text-xs font-bold uppercase tracking-[0.12em] text-amber-200">
                          <Crown size={16} aria-hidden="true" />
                          {rank.note}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
