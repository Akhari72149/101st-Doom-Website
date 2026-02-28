"use client";

import { useRouter } from "next/navigation";

export default function FAQPage() {
  const router = useRouter();

  const faqs = [
    {
      question: "How do I install the modlists?",
      answer:
        "Click the modlist link, subscribe or download the preset, then open your Arma 3 launcher, go to Mods, and load the preset before joining the server.",
    },
    {
      question: "Mods are missing or not loading?",
      answer:
        "Ensure Steam Workshop subscriptions are complete, restart your launcher, verify files, and re-download the modlist if necessary.",
    },
    {
      question: "I get kicked for mod mismatch.",
      answer:
        "Double check that you are running the correct server modlist and that all are up to date. Remove any extra mods that are not included in the official list and repair any that updated recently.",
    },
    {
      question: "How do I switch between modlists?",
      answer:
        "Open your Arma Launcher → Go to Presets → Select the correct preset for the server you are joining.",
    },
    {
      question: "Where do I report technical issues?",
      answer:
        "Create a new Thread in #tech-support with as much info as possible, possibly with screenshots and someone will assist as soon as they can.",
    },
  ];

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

        <h1 className="text-5xl md:text-6xl text-[#00ff66] tracking-[0.4em] text-center mb-10">
          FAQ
        </h1>

        <div className="bg-black/60 border border-[#00ff66]/30 rounded-2xl p-10 shadow-xl space-y-8">

          {faqs.map((item, index) => (
            <div key={index} className="border-b border-[#00ff66]/20 pb-6">
              <h2 className="text-xl text-[#00ff66] mb-2">
                {item.question}
              </h2>
              <p className="text-gray-300 leading-relaxed">
                {item.answer}
              </p>
            </div>
          ))}

          {/* Back Button */}
          <div className="pt-6 text-center">
            <button
              onClick={() => router.push("/Join")}
              className="px-8 py-3 border border-[#00ff66] rounded-lg
                         text-[#00ff66] hover:bg-[#00ff66]
                         hover:text-black hover:scale-105 transition-all"
            >
              Back to Recruitment
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
