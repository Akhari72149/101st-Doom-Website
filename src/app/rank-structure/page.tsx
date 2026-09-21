import type { Metadata } from "next";
import Image from "next/image";
import {
  Shield,
} from "lucide-react";
import RankStructureTabs, { type RankTrack } from "./RankStructureTabs";

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
        abbreviation: "PTC",
        icon: "/rank-icons/clone-trooper-private-third-class.png",
        summary:
          "The first slotted promotion, recognising time in the squad and a demonstrated commitment to the unit.",
        requirements: ["Slotted member", "60 days TIG", "Attendance above 50%"],
      },
      {
        name: "Clone Trooper (Private Second Class)",
        abbreviation: "PSC",
        icon: "/rank-icons/clone-trooper-private-second-class.png",
        summary:
          "The second slotted promotion, recognising continued commitment and growing usefulness to the squad through certifications.",
        requirements: ["Slotted member", "80 days TIG", "Attendance above 50%", "140 days total service"],
      },
      {
        name: "Clone Trooper (Private First Class)",
        abbreviation: "PFC",
        icon: "/rank-icons/clone-trooper-private-first-class.png",
        summary:
          "The final Clone Trooper promotion, awarded for commitment and proven reliability as a team and squad member.",
        requirements: ["Slotted member", "100 days TIG", "Attendance above 50%", "240 days total service"],
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
        requirements: ["Slotted member", "100 days TIG", "Attendance above 70%", "465 days total service"],
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
          "585 days total service",
        ],
      },
      {
        name: "Clone Technical Specialist",
        abbreviation: "CTS",
        icon: "/rank-icons/clone-technical-specialist.png",
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
        icon: "/rank-icons/clone-veteran-corporal.png",
        summary:
          "The second senior Corporal rank, requiring increased attendance and continued support of troopers and the squad leader.",
        requirements: ["Slotted member", "120 days TIG", "Attendance above 70%"],
      },
      {
        name: "Clone Master Corporal",
        abbreviation: "CMC",
        icon: "/rank-icons/clone-master-corporal.png",
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
        icon: "/rank-icons/clone-first-corporal.png",
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
    id: "pilot",
    label: "Hammer Pilot Progression",
    eyebrow: "Hammer MOS",
    accent: "cyan",
    ranks: [
      {
        name: "Clone Ensign Cadet",
        abbreviation: "CXC",
        icon: "/rank-icons/hammer/cxc.png",
        summary:
          "The entry rank for personnel beginning the pilot pathway and serving within an active flight.",
        requirements: ["Complete the Academy Course", "Slotted into a flight"],
      },
      {
        name: "Clone Ensign",
        abbreviation: "CX",
        icon: "/rank-icons/hammer/cx.png",
        summary:
          "A qualified flight member who has completed the core Clone Ensign training pathway.",
        requirements: ["90 days TIG", "Complete the CX Course", "Attendance above 75%"],
      },
      {
        name: "Clone Senior Ensign",
        abbreviation: "CSX",
        icon: "/rank-icons/clone-senior-ensign.png",
        summary:
          "A senior pilot recognised for sustained flight activity, attendance, and broader aviation capability.",
        requirements: [
          "150 days TIG",
          "Attendance above 75%",
          "VTOL qualification",
          "Platoon approval",
        ],
      },
      {
        name: "Clone Veteran Ensign",
        abbreviation: "CVX",
        icon: "/rank-icons/hammer/cxv.png",
        summary:
          "An experienced pilot who has demonstrated consistent operational attendance and earned platoon confidence.",
        requirements: ["120 days TIG", "Attendance above 80%", "Platoon approval"],
      },
      {
        name: "Clone Specialist Ensign",
        abbreviation: "CXX",
        icon: "/rank-icons/hammer/cxx.png",
        summary:
          "A specialist flight rank recognising continued experience and dependable operational participation.",
        requirements: ["125 days TIG", "Attendance above 80%"],
      },
      {
        name: "Clone Ensign Specialist Technician",
        abbreviation: "CXT",
        icon: "/rank-icons/clone-ensign-specialist-technician.png",
        summary:
          "The senior technical pilot rank for highly experienced and consistently active flight personnel.",
        requirements: ["180 days TIG", "Attendance above 90%"],
      },
      {
        name: "Clone Ensign Corporal",
        abbreviation: "CXP",
        icon: "/rank-icons/hammer/cxp.png",
        summary:
          "The pilot Corporal rank, awarded after completing the unit's Corporals Course.",
        requirements: ["Complete the CP Course"],
      },
      {
        name: "Clone Ensign Sergeant",
        abbreviation: "CXS",
        icon: "/rank-icons/hammer/cxs.png",
        summary:
          "The pilot Sergeant rank, awarded after completing the unit's Sergeants Course.",
        requirements: ["Complete the CS Course"],
      },
      {
        name: "Clone Ensign Specialist Sergeant",
        abbreviation: "CXSS",
        icon: "/rank-icons/clone-ensign-specialist-sergeant.png",
        summary:
          "A senior flight Sergeant rank recognising established leadership and reliable attendance.",
        requirements: ["125 days TIG", "Attendance above 75%"],
      },
      {
        name: "Clone Ensign Master Sergeant",
        abbreviation: "CXMS",
        icon: "/rank-icons/hammer/cxsm.png",
        summary:
          "The senior regular flight Sergeant rank, requiring strong attendance and company confidence.",
        requirements: ["145 days TIG", "Attendance above 80%", "Company approval"],
      },
      {
        name: "Clone Flight Sergeant Major",
        abbreviation: "CXM",
        icon: "/rank-icons/hammer/cxm.png",
        summary:
          "The Sergeant Major rank for flight leadership and senior aviation administration.",
        requirements: ["Complete the CSM Course"],
      },
      {
        name: "Clone Squadron Overseer",
        abbreviation: "CXO",
        icon: "/rank-icons/hammer/cxo.png",
        summary:
          "The legacy Squadron Overseer designation held by Akhari.",
        requirements: ["Be Akhari"],
        note: "Legacy rank",
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
        icon: "/rank-icons/clone-lance-sergeant.png",
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
        icon: "/rank-icons/clone-gunnery-sergeant.png",
        summary:
          "The second senior Sergeant rank, requiring increased attendance and continued leadership of troopers and squad activity.",
        requirements: ["Slotted member", "120 days TIG", "Attendance above 70%"],
      },
      {
        name: "Clone Master Sergeant",
        abbreviation: "CMS",
        icon: "/rank-icons/clone-master-sergeant.png",
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
        icon: "/rank-icons/clone-first-sergeant.png",
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
        icon: "/rank-icons/clone-staff-sergeant-major.png",
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
        icon: "/rank-icons/clone-battalion-sergeant-major.png",
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
        icon: "/rank-icons/clone-ensign.png",
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
        icon: "/rank-icons/clone-major.png",
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

export default function RankStructurePage() {
  const rankCount = tracks.reduce((total, track) => total + track.ranks.length, 0);
  const overallTracks = tracks.filter((track) => track.id !== "pilot");
  const mosTracks = tracks.filter((track) => track.id === "pilot");
  const overallRankCount = overallTracks.reduce((total, track) => total + track.ranks.length, 0);
  const mosRankCount = mosTracks.reduce((total, track) => total + track.ranks.length, 0);

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

      <RankStructureTabs
        overallTracks={overallTracks}
        mosTracks={mosTracks}
        overallRankCount={overallRankCount}
        mosRankCount={mosRankCount}
      />
    </main>
  );
}
