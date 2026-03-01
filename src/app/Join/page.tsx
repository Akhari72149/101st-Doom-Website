"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSearchParams } from "next/navigation";





export default function HowToJoinPage() {
  const router = useRouter();
  const [detailsOpen, setDetailsOpen] = useState(false);







  const joinLinks = [
    {
      label: "Fill Out Recruitment Form",
      href: "https://docs.google.com/forms/d/e/1FAIpQLSeQVc_mA5TAiMdcpBJxiCXdd2jc0Nh1GahJmF2-eoUQf-Q4VQ/viewform",
    },
    {
      label: "Join Our Discord",
      href: "https://discord.gg/dZhRghrDfX",
    },
    {
      label: "Download TeamSpeak",
      href: "https://files.teamspeak-services.com/releases/client/3.6.2/TeamSpeak3-Client-win64-3.6.2.exe",
    },
    {
      label: "Connect to TeamSpeak",
      href: "ts3server://199.33.118.13",
    },
  ];

  function MOSDropdown({
  title,
  short,
  children,
}: {
  title: string;
  short: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-black/60 border border-[#00ff66]/30 rounded-2xl overflow-hidden">

      {/* Header (Clickable) */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left p-6 flex justify-between items-center hover:bg-black/70 transition"
      >
        <div>
          <h3 className="text-xl text-[#00ff66]">{title}</h3>
          <p className="text-gray-400 text-sm mt-1">{short}</p>
        </div>

        <span
          className={`text-[#00ff66] text-xl transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        >
          ▼
        </span>
      </button>

      {/* Dropdown Content */}
      <div
        className={`transition-all duration-500 overflow-hidden ${
          open ? "max-h-[3000px] opacity-100 p-6" : "max-h-0 opacity-0"
        }`}
      >
        {children}
      </div>

    </div>
  );
}

  return (
    
    <div className="relative min-h-screen text-white font-orbitron flex justify-center">

      {/* FIXED BACKGROUND */}
<div className="fixed inset-0 -z-10">
  <div
    className="absolute inset-0 bg-center bg-cover opacity-20"
    style={{ backgroundImage: "url('/background/bg.jpg')" }}
  />
  <div className="absolute inset-0 bg-gradient-to-b from-black/90 to-black/70" />
</div>

      <div className="relative z-10 w-full max-w-5xl p-10">

        {/* Title */}
        <h1 className="text-5xl md:text-6xl text-[#00ff66] tracking-[0.4em] text-center mb-10">
          HOW TO JOIN
        </h1>

        {/* ================= MAIN JOIN BOX ================= */}
        <div className="bg-black/60 border border-[#00ff66]/30 rounded-2xl p-8 shadow-xl">

          <h2 className="text-2xl text-[#00ff66] mb-4">
            101st Doom Battalion
          </h2>

          <div className="text-gray-300 leading-relaxed space-y-4">

            <p>
              We are an Arma 3 Starsim Unit based around the 101st Doom Battalion.
            </p>

            <p>
              To join, please complete the recruitment form below as well as download
              Teamspeak and join our Discord. Once you have TS installed and filled
              out the form, hit the Connect to Teamspeak button to connect and ping
              <span className="text-[#FFD700]"> NA or EU Recruiter</span> in{" "}
              <span className="text-[#00ff66]">newcomers-chat</span>.
            </p>

            <p>
              If you are a part of <span className="text-[#00ff66]">GARC</span> looking
              to transfer, please speak to your COC to get the transfer paperwork completed.
            </p>

            <p>
              If you are a returning member, please ping a Senior Recruiter to get
              yourself processed.
            </p>

          </div>

          {/* Requirements */}
          <div className="mt-8 mb-8">
            <h3 className="text-lg text-[#00ff66] mb-3">
              Requirements to Join the 101st
            </h3>

            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Own a legal copy of Arma 3</li>
              <li>Minimum of 15yrs old</li>
              <li>Not part of another Arma 3 Starsim Unit</li>
            </ul>
          </div>

          {/* Buttons */}
          <div className="grid md:grid-cols-2 gap-6">
            {joinLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                className="px-6 py-4 text-center rounded-xl border border-[#00ff66]/40
                           hover:bg-[#00ff66] hover:text-black hover:scale-105
                           transition-all duration-300"
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* Back Button */}
          <div className="mt-6 text-center">
            <button
              onClick={() => router.push("/")}
              className="px-8 py-3 border border-[#00ff66] rounded-lg
                         text-[#00ff66] hover:bg-[#00ff66]
                         hover:text-black hover:scale-105 transition-all"
            >
              Return Home
            </button>
          </div>

        </div>

       {/* ================= COLLAPSIBLE MORE DETAILS SECTION ================= */}
<div className="mt-32 w-full">

  {/* Clickable Header */}
  <button
    onClick={() => setDetailsOpen(!detailsOpen)}
    className="w-full flex justify-between items-center bg-black/60 border border-[#00ff66]/30 rounded-2xl p-6 shadow-xl hover:bg-black/70 transition-all"
  >
    <h2 className="text-3xl text-[#00ff66]">
      Full Overview
    </h2>

    <span
      className={`text-[#00ff66] text-2xl transition-transform duration-300 ${
        detailsOpen ? "rotate-180" : "rotate-0"
      }`}
    >
      ▼
    </span>
  </button>

  {/* Collapsible Content */}
  <div
    className={`overflow-hidden transition-all duration-500 ${
      detailsOpen ? "max-h [5000px] opacity-100 mt-6" : "max-h-0 opacity-0"
    }`}
  >
    <div className="bg-black/60 border border-[#00ff66]/30 rounded-2xl p-10 shadow-xl space-y-16">

      {/* ================= Detailed Joining Process ================= */}

      {/* ================= Modlists & Whitelist Section ================= */}
<div> 
  <h2 className="text-3xl text-[#00ff66] mb-6">
    Required Modlists & Unit Whitelist
  </h2>

  <div className="text-gray-300 space-y-6 leading-relaxed">

    <p>
      All members are required to download and properly load the official unit modlists
      before attending operations.
    </p>

    <p>
      Server 4 operates off the Main Operation Modlist - Server 4 is also keyed, if you have any mods outside the modlist or unit whitelist, you cannot get in.
    </p>

    <p>
      Server 1 operates off theFun Operation Modlist </p>

    <p>
      Server 2, 3 and 5 operates off the Training Server Modlist
    </p>

    <p>
      Server 6 operates off the FOTM modlist which varies every 2 months, Jan & Feb, March & April etc.
    </p>
    
    <p/>

    <div className="space-y-4">

      <a
        href="https://cdn.discordapp.com/attachments/1284402204748546114/1471514051950546995/Yoaboa_V2.html?ex=69a44dc1&is=69a2fc41&hm=49e5d6f3aa76a25df6f05c45caa25c409fb46ddf4d09bb255d42f3638bb8a110&"
        target="_blank"
        className="block text-[#00ff66] underline hover:text-white transition"
      >
        Main Operations Modlist
      </a>

      <a
        href="https://cdn.discordapp.com/attachments/1284402204748546114/1471514051463876649/Training_Server_Modlist_V2.html?ex=69a44dc1&is=69a2fc41&hm=aefc731a0722aa326446839465e28a8fb57ba1c899d9d8a67900c7efcd2431b0&"
        target="_blank"
        className="block text-[#00ff66] underline hover:text-white transition"
      >
        Training Modlist
      </a>

      <a
        href="https://cdn.discordapp.com/attachments/1284402204748546114/1471514051036188756/Funop_Modlist_V5.html?ex=69a44dc1&is=69a2fc41&hm=00bd71791d9fe0b992652f1059345ec4e48c00210af1a93a972ad094bedd3b5f&"
        target="_blank"
        className="block text-[#00ff66] underline hover:text-white transition"
      >
        Fun Operation Modlist
      </a>

      <a
        href="https://cdn.discordapp.com/https://cdn.discordapp.com/attachments/983174143400869898/1464716029312630987/101st_FOTM_40k_Rubicon.html?ex=69a3f65a&is=69a2a4da&hm=afb618de63df40618b068742e8af922f4d356dc14ec4a91018104ce5c9d9aae3&/1284402204748546114/1471514051036188756/Funop_Modlist_V5.html?ex=69a44dc1&is=69a2fc41&hm=00bd71791d9fe0b992652f1059345ec4e48c00210af1a93a972ad094bedd3b5f&"
        target="_blank"
        className="block text-[#00ff66] underline hover:text-white transition"
      >
        FOTM Modlist (WH 40k)
      </a>



    </div>

    <p>
      Ensure your mods are updated prior to loading into server, check server-information in discord for recently updated mods.
    </p>

    {/* FAQ LINK */}
<div className="mt-4">
  <a
    href="/faq"
    className="text-[#00ff66] underline hover:text-white transition"
  >
    Need Help With Mods? Visit the FAQ Page
  </a>
</div>

    {/* ================= WHITELIST SECTION ================= */}

    <div className="mt-6">
      <h3 className="text-2xl text-[#00ff66] mb-3">
        Unit Whitelist
      </h3>

      <p className="mb-3">
        List of approved client-side mods that can be ran on our servers - do not load any mod not in the above modlists or unit whitelist.
      </p>

      <a
        href="https://steamcommunity.com/sharedfiles/filedetails/?id=3150345662"
        target="_blank"
        className="block text-[#00ff66] underline hover:text-white transition"
      >
        Official Unit Whitelist
      </a>
    </div>

  </div>
</div>
      <div>
        <h2 className="text-3xl text-[#00ff66] mb-6">
          Detailed Joining Process
        </h2>

        <div className="text-gray-300 space-y-6 leading-relaxed">

          <p>
            After contacting a Recruiter, you will be assigned to an available staff member
            who will conduct a short introductory interview.
          </p>

          <div>
            <p className="mb-2">In this session, we will:</p>

            <ul className="list-disc list-inside space-y-2">
              <li>Review unit operations and expectations</li>
              <li>Explain certifications and training requirements</li>
              <li>Go over rank structure and progression</li>
              <li>Introduce available modlists</li>
              <li>Explain the whitelist process</li>
              <li>
                Collect and verify your in-game name, contact information,
                and Discord/TeamSpeak details for official processing
              </li>
            </ul>
          </div>

        </div>
      </div>

{/* ================= What Now Section ================= */}
<div>
  <h2 className="text-3xl text-[#00ff66] mb-6">
    What Now?
  </h2>

  <div className="text-gray-300 space-y-6 leading-relaxed">

    <p>
      After completing recruitment and being accepted as a{" "}
      <span className="text-[#00ff66]">CR</span>,
      your progression begins.
    </p>

    <div>
      <p className="mb-2">
        To rank up from <span className="text-[#00ff66]">CR</span> to
        <span className="text-[#00ff66]"> CR-C</span> and eventually
        <span className="text-[#00ff66]"> CT</span>, you must:
      </p>

      <ul className="list-disc list-inside space-y-3">
        <li>
          Schedule and complete a{" "}
          <span className="text-[#FFD700]">
            Basic Combat Training (BCT)
          </span>{" "}
          with a Drill Instructor.
        </li>

        <li>
          Attend at least{" "}
          <span className="text-[#00ff66]">4 official operations</span>.
          <br />
          At least{" "}
          <span className="text-[#00ff66]">1 must be a Main Operation</span>.
        </li>

        <li>
          All operations must be logged using the official form:
          <br />
          <a
            href="https://forms.gle/FfdMqc41XvyYjAZT9"
            target="_blank"
            className="text-[#00ff66] underline hover:text-white transition"
          >
            Operation Attendance Form
          </a>
        </li>
      </ul>

      <p className="mt-4">
        Completing <span className="text-[#00ff66]">either</span> requirement
        promotes you to <span className="text-[#00ff66]">CR-C</span>.
        <br />
        Completing <span className="text-[#00ff66]">both</span> promotes you to
        <span className="text-[#00ff66]"> CT</span>.
      </p>

    </div>

{/* ================= Platoon & Detachment Slot Section ================= */}

<div className="mt-6">
  <p className="mb-4">
    Upon reaching <span className="text-[#00ff66]">CT</span>, members
    become eligible to be slotted into one of our three platoons.
    Platoon schedules and Main Operation times are listed below:
  </p>

  <ul className="list-disc list-inside space-y-2">
    <li>
      <span className="text-[#00ff66]">
        Tomahawk 1 – Sunday at 3PM EST
      </span>
    </li>

    <li>
      <span className="text-[#00ff66]">
        Claymore 2 – Friday at 7PM EST
      </span>
    </li>

    <li>
      <span className="text-[#00ff66]">
        Broadsword 3 – Saturday at 9PM EST
      </span>
    </li>
  </ul>

  <div className="mt-6">
    <p className="mb-2">
      Members who wish to pursue airborne specialization may apply for
      assignment to our detachment:
    </p>

    <ul className="list-disc list-inside space-y-2">
      <li>
        <span className="text-[#00ff66]">Dagger – Airborne Detachment</span>
      </li>
    </ul>

    <p className="mt-2">
      <span className="text-[#00ff66]">Requirement:</span> Must hold the rank
      of <span className="text-[#00ff66]">CT</span>.
    </p>

    <p className="mt-2">
      To progress through the Dagger application program, members must remain
      slotted for <span className="text-[#00ff66]">30 days</span> or remain
      in a reserved status for <span className="text-[#00ff66]">60 days</span>.
    </p>
  </div>
</div>

{/* ================= MOS SECTION (Dropdown Cards) ================= */}

<div className="mt-10">
  <h2 className="text-3xl text-[#00ff66] mb-6">
    Military Occupational Specialties (MOS)
  </h2>

  <p className="mb-6 text-gray-300 leading-relaxed">
    Members who reach <span className="text-[#00ff66]">CT</span> may apply for
    specialized MOS roles. These roles require additional training and leadership approval.
  </p>

  <div className="space-y-6">

    {/* ================= MEDIC ================= */}
    <MOSDropdown
      title="Medic"
      short="Provides battlefield medical support and casualty stabilization."
    >
      <p className="text-gray-300 mb-4">
        The Medic MOS is responsible for battlefield casualty care,
        stabilization of injured personnel, and ensuring operational survivability.
      </p>

      <p className="mb-2">
        <span className="text-[#00ff66]">Requirements:</span>
      </p>

      <ul className="list-disc list-inside text-gray-300 space-y-2">
        <li>Hold the <span className="text-[#F50000]"> CLS </span> Qual, attainable at <span className="text-[#00ff66]">CR-C</span></li>
        <li>Complete 4 operations running <span className="text-[#F50000]"> CLS </span> while being shadowed by a CM+  </li>
        <li>Complete the <span className="text-[#F50000]"> CM-C </span> test</li>
      </ul>
    </MOSDropdown>

    {/* ================= RTO ================= */}
    <MOSDropdown
      title="RTO"
      short="Handles radio communications and command coordination."
    >
      <p className="text-gray-300 mb-4">
        The RTO MOS manages tactical communications, relays command orders,
        and coordinates between platoons during operations.
      </p>

      <p className="mb-2">
        <span className="text-[#00ff66]">Requirements:</span>
      </p>

      <ul className="list-disc list-inside text-gray-300 space-y-2">
        <li>Hold the <span className="text-[#464646]"> RTO </span> Qual, attainable at <span className="text-[#00ff66]">CR-C</span></li>
        <li>Complete 4 operations running <span className="text-[#464646]"> RTO </span> while being shadowed by a CI+, 1 operation must be a Main Operation</li>
        <li>Complete the <span className="text-[#464646]"> CIC </span> Test</li>
      </ul>
    </MOSDropdown>

 {/* ================= HAMMER ================= */}
<MOSDropdown
  title="Hammer – Aviation"
  short="Provides air support, transport, reconnaissance, and aviation operations."
>
  <p className="text-gray-300 mb-4">
    The Hammer MOS operates and coordinates aviation assets,
    including transport, close air support, and reconnaissance missions.
  </p>

  <p className="mb-2">
    <span className="text-[#00ff66]">Requirements:</span>
  </p>

  <ul className="list-disc list-inside text-gray-300 space-y-2">
    <li>
      Hold the <span className="text-[#464646]"> RTO </span> qual and be at-least{" "}
      <span className="text-[#00ff66]">CR-C</span> to begin Phase 1
    </li>
    <li>
      Hold the <span className="text-[#F50000]"> CLS </span> qual to progress beyond Phase 1
    </li>
    <li>Complete all phases in the Hammer Training Academy</li>
    <li>
      Complete the <span className="text-[#F7B628]"> CX-C </span> Test
    </li>
  </ul>

  {/* NEW SIGNUP LINE */}
  <p className="mt-6 text-gray-300">
    Ready to begin? Apply to the Hammer Training Academy here:
  </p>

  <a
    href="https://forms.gle/asN18FgMVuvo6SVH8"
    target="_blank"
    className="inline-block mt-2 text-[#00ff66] underline hover:text-white transition"
  >
    Hammer MOS Application Form
  </a>
</MOSDropdown>

  </div>
</div>

{/* ================= Certifications ================= */}
<div>
  <h2 className="text-3xl text-[#00ff66] mb-6">
    Certifications
  </h2>

  <div className="text-gray-300 space-y-6 leading-relaxed">

    <p>
      Certifications unlock specialized roles and responsibilities within the unit.
      They allow members to expand their capabilities and take on more operational duties.
    </p>

    <div>
      <p className="mb-2">
        <span className="text-[#00ff66]">At CR-C</span>, members unlock:
      </p>

      <ul className="list-disc list-inside space-y-2">
        <li>RTO Qualification</li>
        <li>CLS (Combat Life Saver) Qualification</li>
      </ul>
    </div>

    <div>
      <p className="mb-2">
        <span className="text-[#00ff66]">At CT</span>, members unlock access to
        our main roster of weapon certifications.
      </p>

      <p>
        These certifications expand access to higher responsibility roles
        within operations and can lead to operational specializations such as our <span className="text-[#F50000]"> Medical </span>
         or <span className="text-[#464646]"> RTO </span> MOS.
      </p>
    </div>

    <div>
      <p>
        You can view all our available certifications and requirements here:
      </p>

      <a
        href="/certs"
        className="text-[#00ff66] underline hover:text-white transition"
      >
        Certification Overview Page
      </a>
    </div>

  </div>
</div>
        </div>
      </div>

    </div>
  </div>

</div>

      </div>
    </div>
  );
}