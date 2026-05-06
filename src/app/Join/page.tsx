"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

function SectionCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-3xl border border-[#00ff66]/20 bg-black/55 p-6 shadow-[0_0_35px_rgba(0,255,100,0.08)] backdrop-blur-xl sm:p-8 ${className}`}
    >
      <h2 className="mb-5 text-2xl font-bold tracking-[0.18em] text-[#00ff66] sm:text-3xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function MOSDropdown({
  title,
  short,
  children,
}: {
  title: string;
  short: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#00ff66]/25 bg-black/55">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-black/70 sm:p-6"
      >
        <div className="min-w-0">
          <h3 className="text-xl font-semibold text-[#00ff66] sm:text-2xl">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-gray-400">{short}</p>
        </div>

        <span
          className={`shrink-0 text-[#00ff66] transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        >
          ▼
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[#00ff66]/15 p-5 text-gray-300 sm:p-6">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TFARSetupBox() {
  const [index, setIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const steps = [
    {
      title: "Step 1 — Download TFAR Beta",
      image: "/tfar/step1.jpg",
      text: "After downloading the modlist, find Task Force Arrowhead Radio Beta in the Arma 3 launcher.",
    },
    {
      title: "Step 2 — Open the Mod Folder",
      image: "/tfar/step2.jpg",
      text: "Click the three dots under the mod image, then choose Open folder in Windows Explorer and confirm the popup.",
    },
    {
      title: "Step 3 — Locate the TeamSpeak Folder",
      image: "/tfar/step3.jpg",
      text: "Navigate into the TFAR mod folder, then open the TeamSpeak folder inside it.",
    },
    {
      title: "Step 4 — Run the Plugin Installer",
      image: "/tfar/step4.jpg",
      text: "Double-click the installer. If you do not see the TeamSpeak icon, check the FAQ section below.",
    },
    {
      title: "Step 5 — Complete Installation",
      image: "/tfar/step5.jpg",
      text: "Make sure TeamSpeak is closed, click Install, then accept any prompts that appear.",
    },
    {
      title: "Step 6 — Confirm Installation",
      image: "/tfar/step6.jpg",
      text: "Open TeamSpeak, go to Tools → Options → Addons, and confirm Task Force Arrowhead Radio appears as an addon.",
    },
  ];

  const next = () => setIndex((prev) => (prev + 1) % steps.length);
  const prev = () => setIndex((prev) => (prev - 1 + steps.length) % steps.length);

  return (
    <>
      <div className="rounded-3xl border border-[#00ff66]/20 bg-black/55 p-6 shadow-[0_0_35px_rgba(0,255,100,0.08)] backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex flex-col gap-2">
          <h2 className="text-3xl font-bold tracking-[0.18em] text-[#00ff66]">
            TFAR Beta Setup Guide
          </h2>
          <p className="text-xs uppercase tracking-[0.28em] text-gray-500">
            Click the image to enlarge
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="block w-full overflow-hidden rounded-2xl border border-[#00ff66]/25 bg-black/40 transition hover:scale-[1.01]"
            >
              <img
                src={steps[index].image}
                alt={steps[index].title}
                className="h-auto w-full"
              />
            </button>

            <button
              type="button"
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-xl border border-[#00ff66]/40 bg-black/80 px-4 py-2 text-[#00ff66] transition hover:bg-[#00ff66] hover:text-black"
            >
              ◀
            </button>

            <button
              type="button"
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl border border-[#00ff66]/40 bg-black/80 px-4 py-2 text-[#00ff66] transition hover:bg-[#00ff66] hover:text-black"
            >
              ▶
            </button>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/35 p-5">
              <div className="text-xs uppercase tracking-[0.22em] text-[#7fa08e]">
                Current Step
              </div>
              <h3 className="mt-2 text-2xl font-semibold text-white">
                {steps[index].title}
              </h3>
              <p className="mt-3 leading-7 text-gray-300">{steps[index].text}</p>
              <p className="mt-4 text-sm text-gray-500">
                Step {index + 1} of {steps.length}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {steps.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`h-3 w-10 rounded-full transition ${
                    i === index ? "bg-[#00ff66]" : "bg-white/15 hover:bg-white/25"
                  }`}
                  aria-label={`Go to step ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="relative w-full max-w-6xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute -top-12 right-0 text-3xl text-[#00ff66] transition hover:scale-110"
            >
              ✕
            </button>

            <img
              src={steps[index].image}
              alt={steps[index].title}
              className="w-full rounded-2xl border border-[#00ff66]/40 shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  );
}

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
      href: "ts3server://157.90.221.162",
    },
  ];

  return (
    <div className="relative min-h-screen overflow-x-hidden text-white">
      <div className="fixed inset-0 -z-10">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: "url('/background/bg.jpg')" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#001f11_0%,#000a06_60%,#000000_100%)]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mb-6 inline-flex items-center rounded-xl border border-[#00ff66]/50 px-4 py-2 font-semibold text-[#00ff66] transition hover:scale-105 hover:bg-[#00ff66]/10"
        >
          ← Return Home
        </button>

        <header className="mb-10 rounded-3xl border border-[#00ff66]/20 bg-black/50 p-8 shadow-[0_0_35px_rgba(0,255,100,0.08)] backdrop-blur-xl sm:p-10">
          <div className="text-xs uppercase tracking-[0.35em] text-[#7da28c]">
            101st Doom Battalion
          </div>
          <h1 className="mt-3 text-4xl font-bold tracking-[0.28em] text-[#00ff66] sm:text-6xl">
            HOW TO JOIN
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-300 sm:text-base">
            Follow the steps below to join the unit, complete recruitment, install the
            required tools, and get set up for operations.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
                Start Here
              </div>
              <div className="mt-2 text-sm text-white">
                Recruitment form, Discord, TeamSpeak
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
                Setup
              </div>
              <div className="mt-2 text-sm text-white">
                Modlists, TFAR Beta, whitelist
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
                Progression
              </div>
              <div className="mt-2 text-sm text-white">
                BCT, operations, slotting, MOS
              </div>
            </div>
          </div>
        </header>

        <div className="space-y-8">
          <SectionCard title="Join Requirements">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4 text-gray-300 leading-7">
                <p>
                  We are an Arma 3 starsim unit based around the 101st Doom Battalion.
                </p>
                <p>
                  To join, complete the recruitment form, download TeamSpeak, and join our
                  Discord. Once TeamSpeak is installed and the form is complete, use the
                  TeamSpeak connect button and ping{" "}
                  <span className="text-[#FFD700]">NA or EU Recruiter</span> in{" "}
                  <span className="text-[#00ff66]">newcomers-chat</span>.
                </p>
                <p>
                  If you are transferring from <span className="text-[#00ff66]">GARC</span>,
                  speak to your chain of command to complete transfer paperwork.
                </p>
                <p>
                  Returning members should ping a Senior Recruiter to be processed.
                </p>
              </div>

              <div className="rounded-2xl border border-[#00ff66]/20 bg-black/35 p-5">
                <h3 className="text-lg font-semibold text-[#00ff66]">Requirements</h3>
                <ul className="mt-4 list-disc space-y-2 pl-5 text-gray-300">
                  <li>Own a legal copy of Arma 3</li>
                  <li>Minimum age of 15</li>
                  <li>Not be part of another Arma 3 starsim unit</li>
                </ul>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
              {joinLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-[#00ff66]/30 bg-black/35 px-5 py-4 text-center font-semibold text-[#eafff2] transition hover:scale-[1.02] hover:border-[#00ff66] hover:bg-[#00ff66] hover:text-black"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </SectionCard>

          <button
            type="button"
            onClick={() => setDetailsOpen((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-3xl border border-[#00ff66]/20 bg-black/55 p-6 text-left shadow-[0_0_35px_rgba(0,255,100,0.08)] backdrop-blur-xl transition hover:bg-black/65"
          >
            <div>
              <h2 className="text-3xl font-bold tracking-[0.18em] text-[#00ff66]">
                Full Overview
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                Expand for the full recruitment, progression, and specialization guide.
              </p>
            </div>

            <span
              className={`text-2xl text-[#00ff66] transition-transform duration-300 ${
                detailsOpen ? "rotate-180" : ""
              }`}
            >
              ▼
            </span>
          </button>

          <AnimatePresence initial={false}>
            {detailsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="mt-6 space-y-8 rounded-3xl border border-[#00ff66]/20 bg-black/55 p-6 shadow-[0_0_35px_rgba(0,255,100,0.08)] backdrop-blur-xl sm:p-8">
                  <SectionCard title="Detailed Joining Process" className="bg-black/35">
                    <div className="space-y-5 text-gray-300 leading-7">
                      <p>
                        After contacting a Recruiter, you will be assigned a staff member who
                        will conduct a short introductory interview.
                      </p>

                      <div>
                        <p className="mb-2 text-white">In this session, we will:</p>
                        <ul className="list-disc space-y-2 pl-5">
                          <li>Review unit operations and expectations</li>
                          <li>Explain certifications and training requirements</li>
                          <li>Go over rank structure and progression</li>
                          <li>Introduce available modlists</li>
                          <li>Explain the whitelist process</li>
                          <li>
                            Collect and verify your in-game name, contact information, and
                            Discord / TeamSpeak details
                          </li>
                        </ul>
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard title="Required Modlists & Unit Whitelist" className="bg-black/35">
                    <div className="space-y-5 text-gray-300 leading-7">
                      <p>
                        All members are required to download and load the official unit
                        modlists before attending operations.
                      </p>
                      <p>
                        Server 4 runs the Main Operation Modlist and is keyed. If you have
                        mods outside the modlist or unit whitelist, you will not be able to
                        connect.
                      </p>
                      <p>Server 1 runs the Fun Operation Modlist.</p>
                      <p>Server 2, 3, and 5 run the Training Server Modlist.</p>
                      <p>
                        Server 6 runs the FOTM modlist, which changes every two months.
                      </p>

                      <div className="space-y-3">
                        <a
                          href="https://cdn.discordapp.com/attachments/1284402204748546114/1471514051950546995/Yoaboa_V2.html?ex=69a44dc1&is=69a2fc41&hm=49e5d6f3aa76a25df6f05c45caa25c409fb46ddf4d09bb255d42f3638bb8a110&"
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-[#00ff66] underline transition hover:border-[#00ff66]/40 hover:text-white"
                        >
                          Main Operations Modlist
                        </a>

                        <a
                          href="https://cdn.discordapp.com/attachments/1284402204748546114/1471514051463876649/Training_Server_Modlist_V2.html?ex=69a44dc1&is=69a2fc41&hm=aefc731a0722aa326446839465e28a8fb57ba1c899d9d8a67900c7efcd2431b0&"
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-[#00ff66] underline transition hover:border-[#00ff66]/40 hover:text-white"
                        >
                          Training Modlist
                        </a>

                        <a
                          href="https://cdn.discordapp.com/attachments/1284402204748546114/1471514051036188756/Funop_Modlist_V5.html?ex=69a44dc1&is=69a2fc41&hm=00bd71791d9fe0b992652f1059345ec4e48c00210af1a93a972ad094bedd3b5f&"
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-[#00ff66] underline transition hover:border-[#00ff66]/40 hover:text-white"
                        >
                          Fun Operation Modlist
                        </a>

                        <a
                          href="https://cdn.discordapp.com/attachments/983174143400869898/1464716029312630987/101st_FOTM_40k_Rubicon.html?ex=69a3f65a&is=69a2a4da&hm=afb618de63df40618b068742e8af922f4d356dc14ec4a91018104ce5c9d9aae3&"
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-[#00ff66] underline transition hover:border-[#00ff66]/40 hover:text-white"
                        >
                          FOTM Modlist (WH 40k)
                        </a>
                      </div>

                      <p>
                        Make sure your mods are updated before connecting to the server.
                        Check the server-information channel in Discord for recent updates.
                      </p>

                      <a href="/faq" className="inline-block text-[#00ff66] underline transition hover:text-white">
                        Need help with mods? Visit the FAQ page
                      </a>

                      <div className="mt-6">
                        <h3 className="text-2xl font-semibold text-[#00ff66]">
                          Unit Whitelist
                        </h3>
                        <p className="mt-3">
                          This is the list of approved client-side mods that may be loaded
                          on our servers. Do not load anything outside the modlists or
                          whitelist.
                        </p>

                        <a
                          href="https://steamcommunity.com/sharedfiles/filedetails/?id=3150345662"
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-block text-[#00ff66] underline transition hover:text-white"
                        >
                          Official Unit Whitelist
                        </a>
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard title="How To Setup TFAR Beta" className="bg-black/35">
                    <TFARSetupBox />
                  </SectionCard>

                  <SectionCard title="What Now?" className="bg-black/35">
                    <div className="space-y-5 text-gray-300 leading-7">
                      <p>
                        After completing recruitment and being accepted as a{" "}
                        <span className="text-[#00ff66]">CR</span>, your progression begins.
                      </p>

                      <div>
                        <p className="mb-2">
                          To rank up from <span className="text-[#00ff66]">CR</span> to{" "}
                          <span className="text-[#00ff66]">CR-C</span> and eventually{" "}
                          <span className="text-[#00ff66]">CT</span>, you must:
                        </p>
                        <ul className="list-disc space-y-3 pl-5">
                          <li>
                            Complete a{" "}
                            <span className="text-[#FFD700]">
                              Basic Combat Training (BCT)
                            </span>{" "}
                            with a Drill Instructor.
                          </li>
                          <li>
                            Attend at least{" "}
                            <span className="text-[#00ff66]">4 official operations</span>,
                            with at least{" "}
                            <span className="text-[#00ff66]">1 Main Operation</span>.
                          </li>
                          <li>
                            Log all operations using the official form:
                            <br />
                            <a
                              href="https://forms.gle/FfdMqc41XvyYjAZT9"
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#00ff66] underline transition hover:text-white"
                            >
                              Operation Attendance Form
                            </a>
                          </li>
                        </ul>

                        <p className="mt-4">
                          Completing <span className="text-[#00ff66]">either</span>{" "}
                          requirement promotes you to <span className="text-[#00ff66]">CR-C</span>.
                          Completing <span className="text-[#00ff66]">both</span> promotes you to{" "}
                          <span className="text-[#00ff66]">CT</span>.
                        </p>
                      </div>

                      <div>
                        <p className="mb-3">
                          Once you reach <span className="text-[#00ff66]">CT</span>, you become
                          eligible for platoon slotting.
                        </p>

                        <ul className="list-disc space-y-2 pl-5">
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
                            Members who want airborne specialization may apply for:
                          </p>
                          <p className="text-[#00ff66]">Dagger – Airborne Detachment</p>
                          <p className="mt-2">
                            Requirement: must hold the rank of{" "}
                            <span className="text-[#00ff66]">CT</span>.
                          </p>
                          <p className="mt-2">
                            To progress through the Dagger application program, members must
                            remain slotted for <span className="text-[#00ff66]">30 days</span>{" "}
                            or remain in a reserved status for{" "}
                            <span className="text-[#00ff66]">60 days</span>.
                          </p>
                        </div>
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard title="Military Occupational Specialties (MOS)" className="bg-black/35">
                    <p className="mb-6 max-w-3xl text-gray-300 leading-7">
                      Members who reach <span className="text-[#00ff66]">CT</span> may apply
                      for specialized MOS roles. These roles require additional training and
                      leadership approval.
                    </p>

                    <div className="space-y-5">
                      <MOSDropdown
                        title="Medic"
                        short="Provides battlefield medical support and casualty stabilization."
                      >
                        <p className="mb-4">
                          The Medic MOS is responsible for battlefield casualty care,
                          stabilization of injured personnel, and ensuring operational
                          survivability.
                        </p>

                        <p className="mb-2">
                          <span className="text-[#00ff66]">Requirements:</span>
                        </p>

                        <ul className="list-disc space-y-2 pl-5">
                          <li>
                            Hold the{" "}
                            <span className="text-[#F50000]">CLS</span> qualification,
                            attainable at <span className="text-[#00ff66]">CR-C</span>
                          </li>
                          <li>
                            Complete 4 operations running{" "}
                            <span className="text-[#F50000]">CLS</span> while shadowed by a
                            CM+
                          </li>
                          <li>
                            Complete the <span className="text-[#F50000]">CM-C</span> test
                          </li>
                        </ul>
                      </MOSDropdown>

                      <MOSDropdown
                        title="RTO"
                        short="Handles radio communications and command coordination."
                      >
                        <p className="mb-4">
                          The RTO MOS manages tactical communications, relays command orders,
                          and coordinates between platoons during operations.
                        </p>

                        <p className="mb-2">
                          <span className="text-[#00ff66]">Requirements:</span>
                        </p>

                        <ul className="list-disc space-y-2 pl-5">
                          <li>
                            Hold the <span className="text-[#464646]">RTO</span> qual,
                            attainable at <span className="text-[#00ff66]">CR-C</span>
                          </li>
                          <li>
                            Complete 4 operations running{" "}
                            <span className="text-[#464646]">RTO</span> while shadowed by a
                            CI+, with 1 Main Operation minimum
                          </li>
                          <li>
                            Complete the <span className="text-[#464646]">CIC</span> test
                          </li>
                        </ul>
                      </MOSDropdown>

                      <MOSDropdown
                        title="Hammer – Aviation"
                        short="Provides air support, transport, reconnaissance, and aviation operations."
                      >
                        <p className="mb-4">
                          The Hammer MOS operates and coordinates aviation assets, including
                          transport, close air support, and reconnaissance missions.
                        </p>

                        <p className="mb-2">
                          <span className="text-[#00ff66]">Requirements:</span>
                        </p>

                        <ul className="list-disc space-y-2 pl-5">
                          <li>
                            Hold the <span className="text-[#464646]">RTO</span> qualification
                            and be at least <span className="text-[#00ff66]">CR-C</span> to
                            begin Phase 1
                          </li>
                          <li>
                            Hold the <span className="text-[#F50000]">CLS</span> qualification
                            to progress beyond Phase 1
                          </li>
                          <li>Complete all phases in the Hammer Training Academy</li>
                          <li>
                            Complete the <span className="text-[#F7B628]">CX-C</span> test
                          </li>
                        </ul>

                        <p className="mt-6">Ready to begin?</p>
                        <a
                          href="https://forms.gle/asN18FgMVuvo6SVH8"
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-[#00ff66] underline transition hover:text-white"
                        >
                          Hammer MOS Application Form
                        </a>
                      </MOSDropdown>
                    </div>
                  </SectionCard>

                  <SectionCard title="Certifications" className="bg-black/35">
                    <div className="space-y-5 text-gray-300 leading-7">
                      <p>
                        Certifications unlock specialized roles and responsibilities within
                        the unit. They allow members to expand their capabilities and take on
                        more operational duties.
                      </p>

                      <div>
                        <p className="mb-2">
                          <span className="text-[#00ff66]">At CR-C</span>, members unlock:
                        </p>
                        <ul className="list-disc space-y-2 pl-5">
                          <li>RTO Qualification</li>
                          <li>CLS (Combat Life Saver) Qualification</li>
                        </ul>
                      </div>

                      <div>
                        <p className="mb-2">
                          <span className="text-[#00ff66]">At CT</span>, members unlock access
                          to our main roster of weapon certifications.
                        </p>
                        <p>
                          These certifications expand access to higher responsibility roles
                          within operations and can lead to operational specializations such
                          as our <span className="text-[#F50000]">Medical</span> or{" "}
                          <span className="text-[#464646]">RTO</span> MOS.
                        </p>
                      </div>

                      <div>
                        <p>
                          You can view all available certifications and requirements here:
                        </p>
                        <a
                          href="/certs"
                          className="inline-block text-[#00ff66] underline transition hover:text-white"
                        >
                          Certification Overview Page
                        </a>
                      </div>
                    </div>
                  </SectionCard>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}