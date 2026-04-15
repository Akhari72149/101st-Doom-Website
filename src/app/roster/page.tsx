"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { structure } from "@/data/structure";
import { useRouter } from "next/navigation";

type Personnel = {
  id: string;
  rank_id: string | null;
  birth_number: string;
  name: string;
  slotted_position: string;
};

type Rank = {
  id: string;
  name: string;
};

type DisplayMode = "all" | "filled" | "empty";

type StructureRole = {
  role: string;
  slotId: string;
  count: number;
};

type StructureChild = {
  type: "sub-header";
  title: string;
  roles?: StructureRole[];
};

type StructureSection = {
  type: "header";
  title: string;
  children?: StructureChild[];
};

export default function Roster() {
  const router = useRouter();

  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);

  const [openSection, setOpenSection] = useState<number | null>(0);
  const [openSubSections, setOpenSubSections] = useState<string[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("all");

  useEffect(() => {
    async function fetchData() {
      const { data: rankData } = await supabase.from("ranks").select("*");
      setRanks((rankData as Rank[]) || []);

      const { data } = await supabase
        .from("personnel")
        .select("*")
        .order("rank_id", { ascending: true });

      setPersonnel((data as Personnel[]) || []);
    }

    fetchData();
  }, []);

  const getRankName = (rankId: string | null) => {
    const rank = ranks.find((r) => r.id === rankId);
    return rank ? rank.name : "Unranked";
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const matchesSearch = (
    person: Personnel | undefined,
    role: StructureRole,
    subTitle: string,
    sectionTitle: string
  ) => {
    if (!normalizedSearch) return true;

    const fields = [
      person?.name || "",
      person ? getRankName(person.rank_id) : "",
      person?.slotted_position || "",
      role.role || "",
      role.slotId || "",
      subTitle || "",
      sectionTitle || "",
    ]
      .join(" ")
      .toLowerCase();

    return fields.includes(normalizedSearch);
  };

  const slotVisible = (
    person: Personnel | undefined,
    role: StructureRole,
    subTitle: string,
    sectionTitle: string
  ) => {
    const filled = !!person;

    if (displayMode === "filled" && !filled) return false;
    if (displayMode === "empty" && filled) return false;

    return matchesSearch(person, role, subTitle, sectionTitle);
  };

  const getRoleMatchedPeople = (role: StructureRole) => {
    return personnel.filter((person) =>
      person.slotted_position?.startsWith(role.slotId)
    );
  };

  const getRoleVisibleSlots = (
    role: StructureRole,
    subTitle: string,
    sectionTitle: string
  ) => {
    const matchedPeople = getRoleMatchedPeople(role);

    return Array.from({ length: role.count }).map((_, slotIndex) => {
      const person = matchedPeople[slotIndex];
      const visible = slotVisible(person, role, subTitle, sectionTitle);

      return {
        slotIndex,
        person,
        visible,
      };
    });
  };

  const getRoleCounts = (
    role: StructureRole,
    subTitle: string,
    sectionTitle: string
  ) => {
    const visibleSlots = getRoleVisibleSlots(role, subTitle, sectionTitle);
    const renderedSlots = visibleSlots.filter((slot) => slot.visible);
    const filled = renderedSlots.filter((slot) => slot.person).length;
    const empty = renderedSlots.filter((slot) => !slot.person).length;

    return {
      total: renderedSlots.length,
      filled,
      empty,
      visibleSlots: renderedSlots,
    };
  };

  const getSubSectionCounts = (section: StructureSection, child: StructureChild) => {
    const roles = child.roles || [];

    let total = 0;
    let filled = 0;
    let empty = 0;

    roles.forEach((role) => {
      const counts = getRoleCounts(role, child.title, section.title);
      total += counts.total;
      filled += counts.filled;
      empty += counts.empty;
    });

    return { total, filled, empty };
  };

  const getSectionCounts = (section: StructureSection) => {
    const children = section.children || [];

    let total = 0;
    let filled = 0;
    let empty = 0;

    children.forEach((child) => {
      const counts = getSubSectionCounts(section, child);
      total += counts.total;
      filled += counts.filled;
      empty += counts.empty;
    });

    return { total, filled, empty };
  };

  const visibleSections = useMemo(() => {
    return (structure as StructureSection[]).filter((section) => {
      if (section.type !== "header") return false;

      const counts = getSectionCounts(section);
      return counts.total > 0;
    });
  }, [personnel, ranks, searchTerm, displayMode]);

  const expandAll = () => {
    const subKeys: string[] = [];

    (structure as StructureSection[]).forEach((section, sectionIndex) => {
      if (section.type !== "header") return;

      section.children?.forEach((child, childIndex) => {
        if (child.type !== "sub-header") return;
        subKeys.push(`${sectionIndex}-${childIndex}`);
      });
    });

    setOpenSection(-1);
    setOpenSubSections(subKeys);
  };

  const collapseAll = () => {
    setOpenSection(null);
    setOpenSubSections([]);
  };

  const isSectionOpen = (sectionIndex: number) => {
    return openSection === -1 || openSection === sectionIndex;
  };

  const toggleSection = (sectionIndex: number) => {
    if (openSection === -1) {
      setOpenSection(sectionIndex);
      return;
    }

    const nextOpen = openSection === sectionIndex ? null : sectionIndex;
    setOpenSection(nextOpen);

    if (nextOpen !== sectionIndex) {
      setOpenSubSections([]);
    }
  };

  const isSubOpen = (subKey: string) => openSubSections.includes(subKey);

  const toggleSubSection = (subKey: string) => {
    setOpenSubSections((prev) =>
      prev.includes(subKey)
        ? prev.filter((key) => key !== subKey)
        : [...prev, subKey]
    );
  };

  const renderRoleCard = (
    role: StructureRole,
    subTitle: string,
    sectionTitle: string,
    roleIndex: number
  ) => {
    const counts = getRoleCounts(role, subTitle, sectionTitle);

    if (counts.total === 0) return null;

    const status =
      counts.filled === counts.total
        ? "FULL"
        : counts.filled === 0
        ? "VACANT"
        : "PARTIAL";

    return (
      <div
        key={`${role.slotId}-${roleIndex}`}
        className="
          rounded-3xl
          border border-[#00ff66]/15
          bg-black/45
          backdrop-blur-xl
          p-5
          shadow-[0_0_25px_rgba(0,255,100,0.08)]
          transition-all duration-300
          hover:border-[#00ff66]/40
          hover:shadow-[0_0_45px_rgba(0,255,100,0.18)]
        "
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm uppercase tracking-[0.25em] text-[#7b9d88]">
              Role
            </div>
            <div className="mt-1 text-base font-bold tracking-wide text-[#00ff66]">
              {role.role}
            </div>
            <div className="mt-2 text-xs text-[#9eb7a8]">
              {counts.filled}/{counts.total} filled
            </div>
          </div>

          <div
            className={`rounded-full border px-3 py-1 text-[10px] font-bold tracking-[0.22em] ${
              status === "FULL"
                ? "border-[#00ff66]/40 bg-[#00ff66]/10 text-[#00ff66]"
                : status === "PARTIAL"
                ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                : "border-red-400/40 bg-red-400/10 text-red-300"
            }`}
          >
            {status}
          </div>
        </div>

        <div className="space-y-3">
          {counts.visibleSlots.map(({ slotIndex, person }) => (
            <div
              key={slotIndex}
              className={`rounded-2xl border px-4 py-3 transition-all duration-200 ${
                person
                  ? "border-[#00ff66]/20 bg-black/35 hover:border-[#00ff66]/45"
                  : "border-dashed border-white/15 bg-white/[0.03] hover:border-white/25"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {person ? (
                    <>
                      <div className="text-sm font-bold tracking-wide text-[#00ff66]">
                        {getRankName(person.rank_id)}
                      </div>
                      <div className="truncate text-[15px] font-medium text-[#f2fff7]">
                        {person.name}
                      </div>
                      <div className="mt-1 text-xs tracking-wide text-[#8ea595]">
                        {person.slotted_position}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs uppercase tracking-[0.2em] text-[#8b8b8b]">
                        Vacant
                      </div>
                      <div className="mt-1 text-sm font-medium text-[#b4b4b4]">
                        Empty Slot
                      </div>
                      <div className="mt-1 text-xs tracking-wide text-[#777]">
                        {role.slotId}-{slotIndex + 1}
                      </div>
                    </>
                  )}
                </div>

                <div className="shrink-0 text-xs text-[#6c8677]">
                  #{slotIndex + 1}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStructure = () => {
    return (structure as StructureSection[]).map((section, sectionIndex) => {
      if (section.type !== "header") return null;

      const sectionCounts = getSectionCounts(section);
      if (sectionCounts.total === 0) return null;

      const sectionOpen = isSectionOpen(sectionIndex);

      return (
        <section key={sectionIndex} className="mt-10">
          <button
            onClick={() => toggleSection(sectionIndex)}
            className="
              group w-full
              rounded-3xl
              border border-[#00ff66]/25
              bg-black/50
              px-6 py-5
              text-left
              backdrop-blur-xl
              shadow-[0_0_40px_rgba(0,255,100,0.12)]
              transition-all duration-300
              hover:border-[#00ff66]/50
              hover:shadow-[0_0_60px_rgba(0,255,100,0.2)]
            "
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.35em] text-[#79a58d]">
                  Battalion Section
                </div>
                <div className="mt-2 text-2xl font-bold tracking-[0.18em] text-[#00ff66]">
                  {section.title}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-right md:block">
                  <div className="text-xs text-[#8fa999]">
                    {sectionCounts.filled} filled / {sectionCounts.empty} empty
                  </div>
                  <div className="text-sm font-semibold text-[#e9fff1]">
                    {sectionCounts.total} visible slots
                  </div>
                </div>

                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl border border-[#00ff66]/25 bg-[#00ff66]/5 text-[#00ff66] transition-transform duration-300 ${
                    sectionOpen ? "rotate-180" : "rotate-0"
                  }`}
                >
                  ▼
                </div>
              </div>
            </div>
          </button>

          {sectionOpen && (
            <div className="mt-6 space-y-5 border-l border-[#00ff66]/10 pl-4 sm:pl-6">
              {section.children?.map((child, childIndex) => {
                if (child.type !== "sub-header") return null;

                const subKey = `${sectionIndex}-${childIndex}`;
                const subOpen = isSubOpen(subKey);
                const subCounts = getSubSectionCounts(section, child);

                if (subCounts.total === 0) return null;

                return (
                  <div key={subKey}>
                    <button
                      onClick={() => toggleSubSection(subKey)}
                      className="
                        group w-full
                        rounded-2xl
                        border border-[#00ff66]/20
                        bg-black/35
                        px-5 py-4
                        text-left
                        backdrop-blur-md
                        transition-all duration-300
                        hover:border-[#00ff66]/40
                        hover:bg-black/45
                      "
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-lg font-semibold tracking-wide text-[#dffff0]">
                            {child.title}
                          </div>
                          <div className="mt-1 text-xs tracking-[0.18em] text-[#7f9f8d] uppercase">
                            {subCounts.filled} filled • {subCounts.empty} empty •{" "}
                            {subCounts.total} visible
                          </div>
                        </div>

                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-xl border border-[#00ff66]/20 bg-[#00ff66]/5 text-sm text-[#00ff66] transition-transform duration-300 ${
                            subOpen ? "rotate-180" : "rotate-0"
                          }`}
                        >
                          ▼
                        </div>
                      </div>
                    </button>

                    {subOpen && (
                      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                        {child.roles?.map((role, roleIndex) =>
                          renderRoleCard(role, child.title, section.title, roleIndex)
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      );
    });
  };

  return (
    <main
      className="
        min-h-screen
        bg-[radial-gradient(circle_at_top,#012816_0%,#000d08_45%,#000704_100%)]
        text-[#eafff2]
      "
    >
      <div className="mx-auto max-w-[1800px] px-4 py-8 sm:px-6 lg:px-10">
        <button
          onClick={() => router.push("/pcs")}
          className="
            mb-6 rounded-xl border border-[#00ff66]/40 px-5 py-2.5
            font-semibold text-[#00ff66]
            transition-all duration-200
            hover:bg-[#00ff66]/10
            hover:scale-[1.02]
          "
        >
          ← Return to Dashboard
        </button>

        <div className="mb-8">
          <div className="text-xs uppercase tracking-[0.45em] text-[#78a28a]">
            Personnel Command System
          </div>
          <h1
            className="
              mt-3
              text-3xl font-bold tracking-[0.18em] text-[#00ff66]
              drop-shadow-[0_0_18px_rgba(0,255,100,0.45)]
              sm:text-4xl xl:text-5xl
            "
          >
            101ST DOOM BATTALION ROSTER
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#9bb3a5]">
            Battalion structure overview with searchable personnel assignments,
            vacancy tracking, and collapsible unit sections.
          </p>
        </div>

        <div
          className="
            sticky top-4 z-30 mb-8
            rounded-3xl border border-[#00ff66]/20
            bg-black/55
            p-4 backdrop-blur-xl
            shadow-[0_0_35px_rgba(0,255,100,0.08)]
          "
        >
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_auto_auto] xl:items-center">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-[#7fa08e]">
                Search personnel / rank / role / slot
              </label>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, role, rank, slot..."
                className="
                  w-full rounded-2xl border border-[#00ff66]/20
                  bg-black/40 px-4 py-3 text-[#ecfff3]
                  outline-none transition-all duration-200
                  placeholder:text-[#678172]
                  focus:border-[#00ff66]/50
                  focus:shadow-[0_0_20px_rgba(0,255,100,0.12)]
                "
              />
            </div>

            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-[#7fa08e]">
                Display
              </label>
              <div className="flex flex-wrap gap-2">
                {(["all", "filled", "empty"] as DisplayMode[]).map((mode) => {
                  const active = displayMode === mode;

                  return (
                    <button
                      key={mode}
                      onClick={() => setDisplayMode(mode)}
                      className={`rounded-2xl border px-4 py-3 text-sm font-semibold capitalize transition-all duration-200 ${
                        active
                          ? "border-[#00ff66]/45 bg-[#00ff66]/12 text-[#00ff66]"
                          : "border-white/10 bg-white/[0.03] text-[#b8cabe] hover:border-[#00ff66]/25 hover:text-[#e8fff0]"
                      }`}
                    >
                      {mode}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-[#7fa08e]">
                Controls
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={expandAll}
                  className="
                    rounded-2xl border border-[#00ff66]/25 bg-[#00ff66]/6
                    px-4 py-3 text-sm font-semibold text-[#00ff66]
                    transition-all duration-200 hover:bg-[#00ff66]/12
                  "
                >
                  Expand All
                </button>
                <button
                  onClick={collapseAll}
                  className="
                    rounded-2xl border border-white/10 bg-white/[0.03]
                    px-4 py-3 text-sm font-semibold text-[#d4dfd8]
                    transition-all duration-200 hover:border-white/20
                  "
                >
                  Collapse All
                </button>
              </div>
            </div>
          </div>
        </div>

        {visibleSections.length > 0 ? (
          renderStructure()
        ) : (
          <div
            className="
              rounded-3xl border border-white/10 bg-white/[0.03]
              px-6 py-10 text-center
            "
          >
            <div className="text-lg font-semibold text-[#eafff2]">
              No matching roster entries
            </div>
            <div className="mt-2 text-sm text-[#8ea595]">
              Try clearing your search or changing the display filter.
            </div>
          </div>
        )}
      </div>
    </main>
  );
}