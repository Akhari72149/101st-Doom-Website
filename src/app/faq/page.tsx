"use client";

import { useRouter } from "next/navigation";
import { useState, useRef } from "react";

export default function FAQPage() {
  const router = useRouter();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const contentRefs = useRef<(HTMLDivElement | null)[]>([]);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const faqs = [
    {
      category: "Installation",
      question: "How do I install the modlists?",
      answer: `
Click the modlist link or subscribe to the preset.

Open your Arma 3 launcher.

Go to Mods and load the preset before joining the server.
      `,
    },
    {
      category: "Installation",
      question: "TFAR Install Plugin wont run",
      answer: `
The plugin needs to be run through the TS3 package installer.

First, find your Teamspeak folder usually inside your appdata local files (windows key + R then type %localappdata% then hit ok.

Find specificaly your Teamspeak 3 Client in the folder that opens, then find in that folder the file named package_inst.exe.

Now you know the filepath, return to the mod plugin installer in your mod folder, right click the .ts_plugin file, and click open wit.

When the tab opens up to chose what to run it with, select more apps ,scroll down to look for more apps on this PC.

Navigate to the Teamspeak 3 Client filepath you just went too, select package_inst.exe and click open, the plugin will now run as it should.
      `,
    },
    {
      category: "Troubleshooting",
      question: "Mods are missing or not loading?",
      answer: `
Ensure Steam Workshop subscriptions are complete.

Restart your launcher.

Verify game files and re-download the modlist if needed.
      `,
    },
    {
      category: "Troubleshooting",
      question: "I get kicked for mod mismatch.",
      answer: `
Double check you're using the correct server modlist.

Remove any extra mods not included in the official list.

Repair mods that updated recently.
      `,
    },
    {
      category: "Server Access",
      question: "How do I switch between modlists?",
      answer: `
Open your Arma Launcher.

Go to Presets.

Select the correct preset for the server you are joining.
      `,
    },
{
  category: "General",
  question: "Where do i find this document?",
  answer: `
Click the button below to head to our document link page.
`,
  link: "/documents",
  linkLabel: "Go to Documents",
},
  ];

  return (
    <div className="relative min-h-screen text-white font-orbitron flex justify-center">
      {/* BACKGROUND */}
      <div className="fixed inset-0 -z-10">
        <div
          className="absolute inset-0 bg-center bg-cover opacity-20"
          style={{ backgroundImage: "url('/background/bg.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/90 to-black/70" />
      </div>

      <div className="relative z-10 w-full max-w-5xl p-10">
        <h1 className="text-5xl md:text-6xl text-[#00ff66] tracking-[0.4em] text-center mb-6">
          FAQ
        </h1>

        {/* INTRO */}
        <p className="text-gray-400 text-center max-w-2xl mx-auto mb-12">
          Having trouble joining? Most common setup issues are solved below.
          If you're still stuck, our team is ready to assist.
        </p>

        <div className="bg-black/60 border border-[#00ff66]/30 rounded-2xl p-10 shadow-xl space-y-10">
          {/* GROUPED FAQS */}
          {["Installation", "Troubleshooting", "Server Access", "General"].map((cat) => (
            <div key={cat}>
              <h2 className="text-2xl text-[#00ff66] mb-6 tracking-wider uppercase">
                {cat}
              </h2>

              {faqs
                .filter((item) => item.category === cat)
                .map((item) => {
                  const globalIndex = faqs.indexOf(item);
                  const isOpen = openIndex === globalIndex;

                  return (
                    <div
                      key={globalIndex}
                      className="border-b border-[#00ff66]/20 pb-4 mb-6"
                    >
                      <button
                        onClick={() => toggleFAQ(globalIndex)}
                        aria-expanded={isOpen}
                        aria-controls={`faq-${globalIndex}`}
                        id={`faq-button-${globalIndex}`}
                        className="w-full text-left flex justify-between items-center text-xl text-[#00ff66]
                                   hover:text-white hover:drop-shadow-[0_0_8px_#00ff66]
                                   transition duration-300"
                      >
                        {item.question}

                        <span
                          className={`text-xl transition-transform duration-300 ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        >
                          ▼
                        </span>
                      </button>

                      <div
                        id={`faq-${globalIndex}`}
                        role="region"
                        aria-labelledby={`faq-button-${globalIndex}`}
                        ref={(el) => {
                          contentRefs.current[globalIndex] = el;
                        }}
                        style={{
                          maxHeight: isOpen
                            ? contentRefs.current[globalIndex]?.scrollHeight +
                              "px"
                            : "0px",
                        }}
                        className="overflow-hidden transition-all duration-300 ease-in-out"
                      >
                        <p className="text-gray-300 leading-relaxed mt-3 whitespace-pre-line">
                          {item.answer}
                          
                        </p>
                        {item.link && (
  <div className="mt-4">
    <a
      href={item.link}
      className="text-[#00ff66] underline hover:text-white transition"
    >
      {item.linkLabel || "Click Here"}
    </a>
  </div>
)}
                      </div>
                    </div>
                  );
                })}
            </div>
          ))}

          {/* SUPPORT CTA */}
          <div className="mt-10 p-6 border border-[#00ff66]/30 rounded-xl text-center">
            <h3 className="text-xl text-[#00ff66] mb-2">
              Still Having Issues?
            </h3>
            <p className="text-gray-400 mb-4">
              Join our tech-support channel on Discord and we’ll help you
              directly.
            </p>

            <a
              href="https://discord.com/channels/445933549816774656/1250482107483160616"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-2 border border-[#00ff66] rounded-lg
                         text-[#00ff66] hover:bg-[#00ff66] hover:text-black
                         hover:shadow-[0_0_12px_#00ff66]
                         transition-all duration-300"
            >
              Go to Support
            </a>
          </div>


          </div>
        </div>
      </div>

  );
}