"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";

type DocumentItem = {
  label: string;
  href: string;
};

type MosCategory = "Medic" | "RTO" | "Hammer";
type MainTab = "General" | "Certifications" | "MOS" | "CShop";

type DocumentsType = {
  General: DocumentItem[];
  Certifications: DocumentItem[];
  MOS: Record<MosCategory, DocumentItem[]>;
  CShop: DocumentItem[];
};

export default function DocumentsPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] =
    useState<MainTab>("General");

  const [activeMosTab, setActiveMosTab] =
    useState<MosCategory>("Medic");

  const documents: DocumentsType = {
    Certifications: [
      { label: "Certification Overview", href: "/certs" },
      {
        label: "Marksman Operation Manual",
        href: "https://docs.google.com/document/d/1INdLCZWSs9PG9CgccgqN0NO4m3mRFAwiv6_V2u-2nHw/edit?usp=sharing",
      },
      {
        label: "IFV Standard Operating Procedure",
        href: "https://docs.google.com/document/d/1JdcGh0pVZoi4ZwrV8GzJ2gOun2fb5PLHsCtZd33t3wc/edit",
      },
      {
        label: "Drone Operation Manual",
        href: "https://docs.google.com/document/d/10hNiOKNFsHbprXiEq3W8w8Td0I9W43WYUSkJbOTXNg0/edit?tab=t.0",
      },
      {
        label: "IDF Document (Must have the Cert to access)",
        href: "https://discord.com/channels/445933549816774656/856978303520604211/1398743305348448498",
      },
    ],

    MOS: {
      Medic: [
        { label: "Medic Handbook V2", href: "https://docs.google.com/document/d/1kwMBfnKNZhh4EjDtxwT5Hhn1uDa3t7EFKeoEXBO2pYY/edit?usp=sharing" },
        { label: "CLS Shadow Form", href: "https://forms.gle/KcRSkzyLPiEav7bq6" },
      ],
      RTO: [
        { label: "RTO Guide", href: "https://docs.google.com/document/d/109QilDCRANogRFltDDqcu0V1SJ670-G-w-iHIGn5EWo/edit?tab=t.0#heading=h.nfvr9ice89sf" },
        { label: "RTO Advanced Guide", href: "https://docs.google.com/document/d/1g5puYeS3ifNQmnnvvqILOcfAo55VQ113We9gcH1Ez6A/edit?tab=t.0" },
        { label: "Virgil's Cheat Sheet", href: "https://docs.google.com/document/d/1Q4vM6BHcT_GrPaGNExhTw85_gX4Bb0LqgxmQOx9Uams/edit?tab=t.0" },
      ],
      Hammer: [
        { label: "Hammer SOP", href: "https://docs.google.com/document/d/1iRgpcLMDEPJIcPnBUWChFMzFFh1j-IP6O8rl58wOCXU/edit?usp=sharing" },
        { label: "Ride Along Form", href: "https://forms.gle/FYytpLP1BhKXacu3A" },
      ],
    },

    CShop: [
      {
        label: "Mission Builder Documentation",
        href: "https://docs.google.com/document/d/1nllJUj5EOlz6I9yxFSOs8ccsGWb9LWUASCwRMY6AV5M/edit?usp=sharing",
      },
    ],

    General: [
      {
        label: "Unit Rules",
        href: "https://docs.google.com/document/d/15tsyHzBSaqfvB-VcIr-eGbhROFKbX8zjc3_L4fA2ZrQ/edit?usp=sharing",
      },
      {
        label: "WBK Melee Guide",
        href: "https://docs.google.com/document/d/17esv78nonssi2lRVb8ZMcsc2ndfRkRdvUW-3HUpqXFU/edit?usp=sharing",
      },
      {
        label: "Funop Weapon Swap List",
        href: "https://docs.google.com/spreadsheets/d/1myNKpUaGmGu_n3op23Nz-o-WSz0k8D62GPt9fMkhek0/edit?usp=sharing",
      },
      {
        label: "Uniform Guide",
        href: "https://docs.google.com/spreadsheets/d/16kqHxgNW_-KIVhICLAuI5ZXIabJb4EbdnfJtKq5UHJA/edit#gid=462975664",
      },
    ],
  };

  const tabs: { key: MainTab; label: string }[] = [
    { key: "General", label: "General" },
    { key: "Certifications", label: "Certifications" },
    { key: "MOS", label: "MOS" },
    { key: "CShop", label: "C-Shop" },
  ];

  let currentDocuments: DocumentItem[] = [];

  if (activeTab === "MOS") {
    currentDocuments = documents.MOS[activeMosTab];
  } else {
    currentDocuments = documents[activeTab];
  }

  return (
    <div className="relative min-h-screen text-white font-orbitron flex justify-center">

      {/* 🔥 Background Logo + Gradient */}
      <div className="fixed inset-0 -z-10">
        <div
          className="absolute inset-0 bg-center bg-cover opacity-20"
          style={{ backgroundImage: "url('/background/bg.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/90 to-black/70" />
      </div>

      <div className="relative z-10 w-full max-w-5xl p-10">

        <h1 className="text-5xl md:text-6xl
               text-transparent bg-clip-text
               bg-gradient-to-r from-[#00ff66] to-[#00ffaa]
               tracking-[0.4em]
               text-center mb-8
               drop-shadow-[0_0_15px_rgba(0,255,100,0.6)]">
          DOCUMENTS & FORMS
        </h1>

        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="px-6 py-2 border border-[#00ff66] rounded-lg
                       text-[#00ff66] hover:bg-[#00ff66]
                       hover:text-black transition-all duration-300"
          >
            Go Back
          </button>
        </div>

        <div className="bg-black/60 border border-[#00ff66]/30 rounded-2xl p-8 shadow-xl">

          {/* Main Tabs */}
          <div className="flex flex-wrap gap-4 mb-8">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  if (tab.key === "MOS") {
                    setActiveMosTab("Medic");
                  }
                }}
                className={`px-6 py-2 rounded-full border backdrop-blur-sm transition-all duration-300
                 ${
                   activeTab === tab.key
                   ? "bg-[#00ff66] text-black border-[#00ff66] shadow-[0_0_20px_rgba(0,255,100,0.6)]"
                   : "border-[#00ff66]/40 text-[#00ff66] hover:bg-[#00ff66]/10 hover:scale-105"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* MOS Sub Tabs */}
          {activeTab === "MOS" && (
            <div className="flex flex-wrap gap-4 mb-6">
              {(Object.keys(documents.MOS) as MosCategory[]).map((mosTab) => (
                <button
                  key={mosTab}
                  onClick={() => setActiveMosTab(mosTab)}
                  className={`px-4 py-2 rounded-full border backdrop-blur-sm transition-all duration-300
                    ${
                      activeMosTab === mosTab
                        ? "bg-[#00ff66] text-black border-[#00ff66] shadow-[0_0_15px_rgba(0,255,100,0.6)]"
                        : "border-[#00ff66]/40 text-[#00ff66] hover:bg-[#00ff66]/10 hover:scale-105"
                    }`}
                >
                  {mosTab}
                </button>
              ))}
            </div>
          )}

          {/* Documents */}
          <div className="space-y-4">
            {currentDocuments.map((doc, index) => (
              <a
                key={index}
                href={doc.href}
                target="_blank"
                className="block p-5 rounded-2xl border border-[#00ff66]/20
                           bg-black/40 backdrop-blur-md
                           text-[#00ff66]
                           hover:bg-[#00ff66]/10
                           hover:border-[#00ff66]/60
                           hover:scale-[1.03]
                           hover:shadow-[0_0_25px_rgba(0,255,100,0.3)]
                           transition-all duration-300"
              >
                <div className="flex justify-between items-center">
                 <span>{doc.label}</span>
                  <ExternalLink className="w-4 h-4 opacity-60" />
                </div>
              </a>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}