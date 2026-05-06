"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { structure } from "@/data/structure";
import { useRouter } from "next/navigation";

type Personnel = {
  id: string;
  name: string;
  rank_id: string | null;
  slotted_position: string | null;
  status: string | null;
  mos: string | null;
};

type Rank = {
  id: string;
  name: string;
  rank_level: number;
};

type StructureRole = {
  role: string;
  slotId: string;
  discordRoleIds?: string[];
};

type StructureChild = {
  type?: string;
  title: string;
  roles?: StructureRole[];
};

type StructureSection = {
  type?: string;
  title: string;
  children?: StructureChild[];
};

type SlotOccupant = {
  id: string;
  name: string;
  rank_id: string | null;
};

type ResolvedSlotPath = {
  header: string;
  subHeader: string;
  roleLabel: string;
};

type MosType = "medic" | "rto" | null;

const MEDIC_MOS_RANKS = ["CM-C", "CM", "CM-V", "CM-T", "CM-P", "CM-S", "CM-SM"];
const RTO_MOS_RANKS = ["CI-C", "CI", "CI-V", "CI-T", "CI-P", "CI-S", "CI-SM"];

const todayDateInput = () => new Date().toISOString().split("T")[0];

export default function PositionEditor() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Personnel | null>(null);

  const [selectedHeader, setSelectedHeader] = useState("");
  const [selectedSubHeader, setSelectedSubHeader] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [selectedRankId, setSelectedRankId] = useState("");
  const [rankChangedAt, setRankChangedAt] = useState(todayDateInput());

  const [selectedMosType, setSelectedMosType] = useState<MosType>(null);
  const [selectedMosValue, setSelectedMosValue] = useState("");

  const [personSearch, setPersonSearch] = useState("");
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);

  const [processedByName, setProcessedByName] = useState("Unknown");

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const typedStructure = structure as StructureSection[];

  const broadcastWebsiteAction = async (payload: any) => {
    try {
      await fetch("/api/website-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("Failed to broadcast website action:", error);
    }
  };

  useEffect(() => {
    const checkAccess = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) {
        router.replace("/");
        return;
      }

      const roleList = roles?.map((r) => r.role) || [];
      const allowedRoles = ["admin", "nco", "di"];

      if (!roleList.some((role) => allowedRoles.includes(role))) {
        router.replace("/");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();

      setProcessedByName(profile?.display_name || user.email || "Unknown");
      setLoadingAuth(false);
    };

    checkAccess();
  }, [router]);

  const fetchData = async () => {
    setLoadingData(true);

    const { data: personnelData, error: personnelError } = await supabase
      .from("personnel")
      .select("id, name, rank_id, slotted_position, status, mos")
      .order("name", { ascending: true });

    const { data: rankData, error: rankError } = await supabase
      .from("ranks")
      .select("id, name, rank_level")
      .order("rank_level", { ascending: true });

    if (personnelError || rankError) {
      setErrorMessage("Failed to load personnel or ranks.");
      setLoadingData(false);
      return;
    }

    const activePersonnel = (personnelData || []).filter((person) => {
      const status = (person.status || "").trim().toLowerCase();
      return status !== "retired" && status !== "removed";
    });

    setPersonnel((activePersonnel as Personnel[]) || []);
    setRanks((rankData as Rank[]) || []);
    setLoadingData(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(""), 3000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  useEffect(() => {
    if (!selectedPerson) return;

    const updated = personnel.find((p) => p.id === selectedPerson.id);
    if (!updated) return;

    setSelectedPerson(updated);
    setSelectedRankId(updated.rank_id || "");

    const currentMos = updated.mos || "";

    if (MEDIC_MOS_RANKS.includes(currentMos)) {
      setSelectedMosType("medic");
      setSelectedMosValue(currentMos);
    } else if (RTO_MOS_RANKS.includes(currentMos)) {
      setSelectedMosType("rto");
      setSelectedMosValue(currentMos);
    } else {
      setSelectedMosType(null);
      setSelectedMosValue(currentMos);
    }
  }, [personnel, selectedPerson?.id]);

  const headers = useMemo(
    () => typedStructure.map((section) => section.title),
    [typedStructure]
  );

  const subHeaders = useMemo(() => {
    const section = typedStructure.find((s) => s.title === selectedHeader);
    return section?.children?.map((child) => child.title) || [];
  }, [typedStructure, selectedHeader]);

  const roles = useMemo(() => {
    const section = typedStructure.find((s) => s.title === selectedHeader);
    const sub = section?.children?.find((c) => c.title === selectedSubHeader);
    return sub?.roles || [];
  }, [typedStructure, selectedHeader, selectedSubHeader]);

  const getRankName = (rankId: string | null) => {
    const rank = ranks.find((r) => r.id === rankId);
    return rank ? rank.name : "Unranked";
  };

  const getRoleDisplayLabel = (
    targetRole: StructureRole,
    roleList: StructureRole[]
  ) => {
    const sameRoleEntries = roleList.filter((r) => r.role === targetRole.role);

    if (sameRoleEntries.length <= 1) return targetRole.role;

    const index = sameRoleEntries.findIndex(
      (r) => r.slotId === targetRole.slotId
    );

    if (index === -1) return targetRole.role;

    return `${targetRole.role} ${index + 1}`;
  };

  const formatSlotToBillet = (slotId: string | null) => {
    if (!slotId) return "Unassigned";

    for (const section of typedStructure) {
      for (const sub of section.children || []) {
        const subRoles = sub.roles || [];

        for (const role of subRoles) {
          if (role.slotId === slotId) {
            return `${section.title} — ${sub.title} — ${getRoleDisplayLabel(
              role,
              subRoles
            )}`;
          }
        }
      }
    }

    return slotId;
  };

  const resolveSlotPath = (slotId: string | null): ResolvedSlotPath | null => {
    if (!slotId) return null;

    for (const section of typedStructure) {
      for (const sub of section.children || []) {
        const subRoles = sub.roles || [];

        for (const role of subRoles) {
          if (role.slotId === slotId) {
            return {
              header: section.title,
              subHeader: sub.title,
              roleLabel: getRoleDisplayLabel(role, subRoles),
            };
          }
        }
      }
    }

    return null;
  };

  const selectedSlotPath = useMemo(
    () => resolveSlotPath(selectedSlotId || null),
    [selectedSlotId]
  );

  const currentSlotPath = useMemo(
    () => resolveSlotPath(selectedPerson?.slotted_position || null),
    [selectedPerson]
  );

  const slotOccupants = useMemo(() => {
    const map = new Map<string, SlotOccupant>();

    for (const person of personnel) {
      if (!person.slotted_position) continue;

      map.set(person.slotted_position, {
        id: person.id,
        name: person.name,
        rank_id: person.rank_id,
      });
    }

    return map;
  }, [personnel]);

  const selectedSlotOccupant = useMemo(() => {
    if (!selectedSlotId) return null;
    return slotOccupants.get(selectedSlotId) || null;
  }, [slotOccupants, selectedSlotId]);

  const filteredPersonnel = useMemo(() => {
    const search = personSearch.trim().toLowerCase();

    return personnel.filter((p) => {
      const label = `${getRankName(p.rank_id)} ${p.name}`.toLowerCase();
      const billet = formatSlotToBillet(p.slotted_position).toLowerCase();
      const mos = (p.mos || "").toLowerCase();

      return label.includes(search) || billet.includes(search) || mos.includes(search);
    });
  }, [personnel, personSearch, ranks]);

  const hasPositionChange =
    !!selectedPerson && selectedSlotId !== (selectedPerson.slotted_position || "");

  const hasRankChange =
    !!selectedPerson && selectedRankId !== (selectedPerson.rank_id || "");

  const hasMosChange =
    !!selectedPerson && selectedMosValue !== (selectedPerson.mos || "");

  const hasAnyChanges = hasPositionChange || hasRankChange || hasMosChange;

  const isReplacingAnotherPerson =
    !!selectedPerson &&
    !!selectedSlotOccupant &&
    selectedSlotOccupant.id !== selectedPerson.id;

  const currentMosOptions =
    selectedMosType === "medic"
      ? MEDIC_MOS_RANKS
      : selectedMosType === "rto"
      ? RTO_MOS_RANKS
      : [];

  const selectPerson = (person: Personnel) => {
    const currentPath = resolveSlotPath(person.slotted_position);

    setSelectedPerson(person);
    setSelectedRankId(person.rank_id || "");
    setSelectedSlotId(person.slotted_position || "");
    setSelectedHeader(currentPath?.header || "");
    setSelectedSubHeader(currentPath?.subHeader || "");
    setPersonSearch(`${getRankName(person.rank_id)} ${person.name}`);
    setShowPersonDropdown(false);
    setRankChangedAt(todayDateInput());
    setErrorMessage("");
    setSuccessMessage("");

    const currentMos = person.mos || "";

    if (MEDIC_MOS_RANKS.includes(currentMos)) {
      setSelectedMosType("medic");
      setSelectedMosValue(currentMos);
    } else if (RTO_MOS_RANKS.includes(currentMos)) {
      setSelectedMosType("rto");
      setSelectedMosValue(currentMos);
    } else {
      setSelectedMosType(null);
      setSelectedMosValue(currentMos);
    }
  };

const syncRankHistoryDate = async (
  personnelId: string,
  oldRankId: string | null,
  newRankId: string | null,
  changedAtDate: string
) => {
  if (!newRankId || !changedAtDate) return;

  const changedAt = `${changedAtDate}T12:00:00+00:00`;

  const { data: personRow, error: personError } = await supabase
    .from("personnel")
    .select("discord_id")
    .eq("id", personnelId)
    .maybeSingle();

  if (personError || !personRow?.discord_id) {
    setErrorMessage(
      `Rank updated, but failed to get Discord ID for rank history.`
    );
    return;
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from("rank_history")
    .update({
      changed_at: changedAt,
    })
    .eq("personnel_id", personnelId)
    .eq("old_rank_id", oldRankId)
    .eq("new_rank_id", newRankId)
    .is("changed_at", null)
    .select("id, changed_at");

  if (updateError) {
    setErrorMessage(
      `Rank updated, but failed to update rank history date: ${updateError.message}`
    );
    return;
  }

  if (updatedRows && updatedRows.length > 0) {
    return;
  }

  const { error: insertError } = await supabase.from("rank_history").insert({
    personnel_id: personnelId,
    discord_id: personRow.discord_id,
    old_rank_id: oldRankId,
    new_rank_id: newRankId,
    changed_at: changedAt,
  });

  if (insertError) {
    setErrorMessage(
      `Rank updated, but failed to insert rank history date: ${insertError.message}`
    );
  }
};

  const updatePosition = async () => {
    if (!selectedPerson || !selectedSlotId) {
      setErrorMessage("Select a position first.");
      return;
    }

    setProcessing(true);
    setErrorMessage("");
    setSuccessMessage("");

    const oldSlot = selectedPerson.slotted_position;
    const currentOccupant = slotOccupants.get(selectedSlotId);
    const newSlotLabel = formatSlotToBillet(selectedSlotId);

    if (currentOccupant && currentOccupant.id !== selectedPerson.id) {
      const { error: clearOccupantError } = await supabase
        .from("personnel")
        .update({ slotted_position: null })
        .eq("id", currentOccupant.id);

      if (clearOccupantError) {
        setProcessing(false);
        setErrorMessage(
          "Failed to clear existing occupant: " + clearOccupantError.message
        );
        return;
      }

      await supabase.functions.invoke("sync-slot-roles", {
        body: {
          personnelId: currentOccupant.id,
          slotId: null,
          oldSlotId: selectedSlotId,
          forceDefaultRole: true,
        },
      });

      await broadcastWebsiteAction({
        action: "POSITION_UNASSIGNED",
        target_personnel_id: currentOccupant.id,
        processedBy: processedByName,
        slotLabel: newSlotLabel,
        slotSection: selectedSlotPath?.subHeader || selectedSlotPath?.header || "N/A",
      });
    }

    const { error } = await supabase
      .from("personnel")
      .update({
        slotted_position: selectedSlotId,
      })
      .eq("id", selectedPerson.id);

    if (error) {
      setProcessing(false);
      setErrorMessage("Update failed: " + error.message);
      return;
    }

    await supabase.functions.invoke("sync-slot-roles", {
      body: {
        personnelId: selectedPerson.id,
        slotId: selectedSlotId,
        oldSlotId: oldSlot,
        forceDefaultRole: false,
      },
    });

    await broadcastWebsiteAction({
      action: "POSITION_ASSIGNED",
      target_personnel_id: selectedPerson.id,
      processedBy: processedByName,
      slotLabel: newSlotLabel,
      slotSection: selectedSlotPath?.subHeader || selectedSlotPath?.header || "N/A",
    });

    await fetchData();
    setProcessing(false);
    setSuccessMessage(
      currentOccupant && currentOccupant.id !== selectedPerson.id
        ? "Position updated successfully. Previous occupant was removed from the slot."
        : "Position updated successfully."
    );
  };

  const updateRank = async () => {
    if (!selectedPerson) {
      setErrorMessage("Select a person first.");
      return;
    }

    if (!rankChangedAt) {
      setErrorMessage("Select the date the rank change occurred.");
      return;
    }

    setProcessing(true);
    setErrorMessage("");
    setSuccessMessage("");

    const oldRankId = selectedPerson.rank_id;
    const oldRankName = getRankName(oldRankId);
    const newRankName = selectedRankId ? getRankName(selectedRankId) : "Unranked";

    const { error } = await supabase
      .from("personnel")
      .update({
        rank_id: selectedRankId || null,
      })
      .eq("id", selectedPerson.id);

    if (error) {
      setProcessing(false);
      setErrorMessage("Rank update failed: " + error.message);
      return;
    }

await syncRankHistoryDate(
  selectedPerson.id,
  oldRankId,
  selectedRankId || null,
  rankChangedAt
);

    await supabase.functions.invoke("discord-rank-sync", {
      body: {
        personnelId: selectedPerson.id,
        oldRankId,
        newRankId: selectedRankId || null,
      },
    });

    await broadcastWebsiteAction({
      action: "RANK_CHANGED",
      target_personnel_id: selectedPerson.id,
      processedBy: processedByName,
      oldRankName,
      rankName: newRankName,
    });

    await fetchData();
    setProcessing(false);
    setSuccessMessage("Rank updated successfully.");
  };

  const updateMos = async () => {
    if (!selectedPerson) {
      setErrorMessage("Select a person first.");
      return;
    }

    if (selectedMosType && !selectedMosValue) {
      setErrorMessage("Select an MOS rank before saving.");
      return;
    }

    setProcessing(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase
      .from("personnel")
      .update({
        mos: selectedMosValue || null,
      })
      .eq("id", selectedPerson.id);

    if (error) {
      setProcessing(false);
      setErrorMessage("MOS update failed: " + error.message);
      return;
    }

    await fetchData();
    setProcessing(false);
    setSuccessMessage(
      selectedMosValue ? "MOS updated successfully." : "MOS cleared successfully."
    );
  };

  const clearMosSelection = () => {
    setSelectedMosType(null);
    setSelectedMosValue("");
  };

  const unassignPosition = async () => {
    if (!selectedPerson) return;

    setProcessing(true);
    setErrorMessage("");
    setSuccessMessage("");

    const oldSlot = selectedPerson.slotted_position;
    const oldSlotPath = resolveSlotPath(oldSlot);
    const oldSlotLabel = formatSlotToBillet(oldSlot);

    const { error } = await supabase
      .from("personnel")
      .update({ slotted_position: null })
      .eq("id", selectedPerson.id);

    if (error) {
      setProcessing(false);
      setErrorMessage("Unassign failed: " + error.message);
      return;
    }

    await supabase.functions.invoke("sync-slot-roles", {
      body: {
        personnelId: selectedPerson.id,
        slotId: null,
        oldSlotId: oldSlot,
        forceDefaultRole: true,
      },
    });

    await broadcastWebsiteAction({
      action: "POSITION_UNASSIGNED",
      target_personnel_id: selectedPerson.id,
      processedBy: processedByName,
      slotLabel: oldSlotLabel,
      slotSection: oldSlotPath?.subHeader || oldSlotPath?.header || "N/A",
    });

    await fetchData();
    setSelectedSlotId("");
    setSelectedHeader("");
    setSelectedSubHeader("");
    setProcessing(false);
    setSuccessMessage("Position removed successfully.");
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#00ff66] bg-black">
        Checking permissions...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_center,#001f11_0%,#000000_100%)] text-white">
      <div className="border-b border-[#00ff66]/15 bg-black/30 backdrop-blur-md">
        <div className="px-6 md:px-10 py-6 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <button
              onClick={() => router.push("/pcs")}
              className="mb-4 px-4 py-2 rounded-lg border border-[#00ff66]/40 text-[#00ff66] font-semibold hover:bg-[#00ff66]/10 transition"
            >
              ← Return to Dashboard
            </button>

            <h1 className="text-4xl font-bold text-[#00ff66]">
              Slotting Management
            </h1>
            <p className="text-sm text-gray-400 mt-2">
              Assign ranks, MOS titles and billets through a visual command layout.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-[280px]">
            <div className="rounded-2xl border border-[#00ff66]/20 bg-black/40 px-4 py-3">
              <div className="text-xs text-gray-400 uppercase tracking-[0.2em]">
                Active Personnel
              </div>
              <div className="text-2xl font-bold text-[#00ff66] mt-1">
                {personnel.length}
              </div>
            </div>

            <div className="rounded-2xl border border-[#00ff66]/20 bg-black/40 px-4 py-3">
              <div className="text-xs text-gray-400 uppercase tracking-[0.2em]">
                Changes
              </div>
              <div
                className={`text-2xl font-bold mt-1 ${
                  hasAnyChanges ? "text-cyan-400" : "text-gray-500"
                }`}
              >
                {hasAnyChanges ? "Pending" : "None"}
              </div>
            </div>

            <div className="rounded-2xl border border-[#00ff66]/20 bg-black/40 px-4 py-3">
              <div className="text-xs text-gray-400 uppercase tracking-[0.2em]">
                System State
              </div>
              <div
                className={`text-2xl font-bold mt-1 ${
                  processing
                    ? "text-yellow-400"
                    : loadingData
                    ? "text-cyan-400"
                    : "text-[#00ff66]"
                }`}
              >
                {processing ? "Working" : loadingData ? "Loading" : "Ready"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {(errorMessage || successMessage) && (
        <div className="px-6 md:px-10 pt-6">
          {errorMessage && (
            <div className="mb-3 rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-red-300">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="rounded-2xl border border-[#00ff66]/40 bg-[#00ff66]/10 px-5 py-4 text-[#7dffae]">
              {successMessage}
            </div>
          )}
        </div>
      )}

      <div className="px-6 md:px-10 py-8 grid grid-cols-1 2xl:grid-cols-[360px_minmax(0,1fr)_360px] gap-6">
        <div className="rounded-3xl border border-[#00ff66]/20 bg-black/40 backdrop-blur-md p-6 space-y-5 h-fit">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-gray-400 mb-2">
              Personnel Lookup
            </div>
            <h2 className="text-2xl font-semibold text-[#00ff66]">
              Select Person
            </h2>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Search by name, rank, billet, or MOS..."
              className="w-full px-4 py-3 rounded-2xl bg-black/60 border border-[#00ff66]/30 text-[#00ff66] outline-none focus:border-[#00ff66]"
              value={personSearch}
              onFocus={() => setShowPersonDropdown(true)}
              onChange={(e) => {
                setPersonSearch(e.target.value);
                setShowPersonDropdown(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowPersonDropdown(false);

                if (
                  e.key === "Enter" &&
                  filteredPersonnel.length > 0 &&
                  showPersonDropdown
                ) {
                  selectPerson(filteredPersonnel[0]);
                }
              }}
            />

            {showPersonDropdown && (
              <div className="absolute w-full mt-2 bg-black/90 border border-[#00ff66]/30 rounded-2xl max-h-96 overflow-y-auto z-50 shadow-[0_0_30px_rgba(0,255,102,0.08)]">
                {filteredPersonnel.length === 0 ? (
                  <div className="px-4 py-4 text-gray-400">No matches found.</div>
                ) : (
                  filteredPersonnel.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`w-full text-left px-4 py-4 border-b border-[#00ff66]/10 last:border-b-0 hover:bg-[#00ff66]/10 transition ${
                        selectedPerson?.id === p.id ? "bg-[#00ff66]/10" : ""
                      }`}
                      onClick={() => selectPerson(p)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-[#00ff66]">
                            {getRankName(p.rank_id)} {p.name}
                          </div>
                          <div className="text-sm text-gray-400 mt-1">
                            {formatSlotToBillet(p.slotted_position)}
                          </div>
                          {p.mos && (
                            <div className="text-xs text-cyan-300 mt-2">
                              MOS: {p.mos}
                            </div>
                          )}
                        </div>

                        {p.slotted_position ? (
                          <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300 border border-cyan-400/30 rounded-full px-2 py-1">
                            Slotted
                          </div>
                        ) : (
                          <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500 border border-gray-600 rounded-full px-2 py-1">
                            Unassigned
                          </div>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#00ff66]/15 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-gray-400 mb-3">
              Selected Personnel
            </div>

            {selectedPerson ? (
              <div className="space-y-3">
                <div>
                  <div className="text-xl font-semibold text-[#00ff66]">
                    {getRankName(selectedPerson.rank_id)} {selectedPerson.name}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    {selectedPerson.status || "Active"}
                  </div>
                </div>

                <div className="rounded-xl border border-[#00ff66]/10 bg-black/30 p-3">
                  <div className="text-xs text-gray-400 uppercase tracking-[0.18em]">
                    Current Billet
                  </div>
                  <div className="mt-2 text-sm text-white">
                    {formatSlotToBillet(selectedPerson.slotted_position)}
                  </div>
                </div>

                <div className="rounded-xl border border-[#00ff66]/10 bg-black/30 p-3">
                  <div className="text-xs text-gray-400 uppercase tracking-[0.18em]">
                    Current Rank
                  </div>
                  <div className="mt-2 text-sm text-white">
                    {getRankName(selectedPerson.rank_id)}
                  </div>
                </div>

                <div className="rounded-xl border border-[#00ff66]/10 bg-black/30 p-3">
                  <div className="text-xs text-gray-400 uppercase tracking-[0.18em]">
                    Current MOS
                  </div>
                  <div className="mt-2 text-sm text-white">
                    {selectedPerson.mos || "None"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-400 text-sm">
                Choose a person to begin editing.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-[#00ff66]/20 bg-black/40 backdrop-blur-md p-6">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-6">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-gray-400 mb-2">
                  Command Actions
                </div>
                <h2 className="text-2xl font-semibold text-[#00ff66]">
                  Rank, MOS & Position Console
                </h2>
              </div>

              {hasAnyChanges && (
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-300">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                  Unsaved Changes
                </div>
              )}
            </div>

            {!selectedPerson ? (
              <div className="rounded-2xl border border-[#00ff66]/15 bg-black/30 p-8 text-gray-400">
                Select a person from the left panel to open the editing console.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-2xl border border-[#00ff66]/15 bg-black/30 p-5">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.22em] text-gray-400 mb-1">
                        Rank Assignment
                      </div>
                      <div className="text-lg text-[#00ff66] font-semibold">
                        {getRankName(selectedPerson.rank_id)} →{" "}
                        {selectedRankId ? getRankName(selectedRankId) : "Unranked"}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_220px_auto] gap-4">
                    <select
                      className="p-3 rounded-xl bg-black/60 border border-[#00ff66]/30 text-[#00ff66] outline-none focus:border-[#00ff66]"
                      value={selectedRankId}
                      onChange={(e) => setSelectedRankId(e.target.value)}
                    >
                      <option value="">-- Select Rank --</option>
                      {ranks.map((rank) => (
                        <option key={rank.id} value={rank.id}>
                          {rank.name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="date"
                      value={rankChangedAt}
                      onChange={(e) => setRankChangedAt(e.target.value)}
                      className="p-3 rounded-xl bg-black/60 border border-[#00ff66]/30 text-[#00ff66] outline-none focus:border-[#00ff66]"
                    />

                    <button
                      onClick={updateRank}
                      disabled={!hasRankChange || processing}
                      className={`px-6 py-3 rounded-xl font-semibold transition ${
                        !hasRankChange || processing
                          ? "border border-[#00ff66]/15 text-gray-500 cursor-not-allowed"
                          : "bg-gradient-to-r from-[#00ff66] to-[#00cc44] text-black hover:scale-[1.02]"
                      }`}
                    >
                      {processing ? "Saving..." : "Commit Rank Change"}
                    </button>
                  </div>

                  <p className="mt-3 text-xs text-gray-400">
                    The selected date is written into{" "}
                    <span className="text-cyan-300">rank_history.changed_at</span>.
                  </p>
                </div>

                <div className="rounded-2xl border border-cyan-400/20 bg-black/30 p-5 space-y-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-gray-400 mb-1">
                      MOS Assignment
                    </div>
                    <div className="text-lg text-cyan-300 font-semibold">
                      {selectedPerson.mos || "None"} → {selectedMosValue || "None"}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMosType((prev) =>
                          prev === "medic" ? null : "medic"
                        );
                        setSelectedMosValue("");
                      }}
                      className={`px-4 py-2 rounded-xl border transition ${
                        selectedMosType === "medic"
                          ? "border-cyan-400 bg-cyan-400/10 text-cyan-300"
                          : "border-[#00ff66]/20 bg-black/30 text-gray-300 hover:border-cyan-400/40"
                      }`}
                    >
                      Medic
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMosType((prev) =>
                          prev === "rto" ? null : "rto"
                        );
                        setSelectedMosValue("");
                      }}
                      className={`px-4 py-2 rounded-xl border transition ${
                        selectedMosType === "rto"
                          ? "border-cyan-400 bg-cyan-400/10 text-cyan-300"
                          : "border-[#00ff66]/20 bg-black/30 text-gray-300 hover:border-cyan-400/40"
                      }`}
                    >
                      RTO
                    </button>

                    <button
                      type="button"
                      onClick={clearMosSelection}
                      className="px-4 py-2 rounded-xl border border-red-500/40 text-red-300 hover:bg-red-500/10 transition"
                    >
                      Clear Selection
                    </button>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto_auto] gap-4">
                    <select
                      className="w-full p-3 rounded-xl bg-black/60 border border-cyan-400/30 text-cyan-300 outline-none focus:border-cyan-400 disabled:text-gray-500 disabled:border-gray-700"
                      value={selectedMosValue}
                      onChange={(e) => setSelectedMosValue(e.target.value)}
                      disabled={!selectedMosType}
                    >
                      <option value="">
                        {selectedMosType
                          ? `-- Select ${selectedMosType.toUpperCase()} MOS Rank --`
                          : "-- Select Medic or RTO First --"}
                      </option>
                      {currentMosOptions.map((mosRank) => (
                        <option key={mosRank} value={mosRank}>
                          {mosRank}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={updateMos}
                      disabled={
                        processing ||
                        !hasMosChange ||
                        (!!selectedMosType && !selectedMosValue)
                      }
                      className={`px-6 py-3 rounded-xl font-semibold transition ${
                        processing ||
                        !hasMosChange ||
                        (!!selectedMosType && !selectedMosValue)
                          ? "border border-cyan-400/15 text-gray-500 cursor-not-allowed"
                          : "bg-gradient-to-r from-cyan-400 to-cyan-500 text-black hover:scale-[1.02]"
                      }`}
                    >
                      {processing ? "Saving..." : "Save MOS"}
                    </button>

                    <button
                      onClick={async () => {
                        setSelectedMosType(null);
                        setSelectedMosValue("");
                        if ((selectedPerson.mos || "") !== "") {
                          setTimeout(() => updateMos(), 0);
                        }
                      }}
                      disabled={processing || !selectedPerson.mos}
                      className={`px-6 py-3 rounded-xl border transition ${
                        processing || !selectedPerson.mos
                          ? "border-red-500/20 text-red-400/40 cursor-not-allowed"
                          : "border-red-500 text-red-300 hover:bg-red-500/10"
                      }`}
                    >
                      Clear MOS
                    </button>
                  </div>

                  <div className="rounded-xl border border-cyan-400/10 bg-black/30 p-3 text-sm text-gray-400">
                    Selecting Medic or RTO only changes the available MOS rank list.
                    Saving writes the selected MOS rank into the personnel MOS column.
                  </div>
                </div>

                <div className="rounded-2xl border border-[#00ff66]/15 bg-black/30 p-5 space-y-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-gray-400 mb-1">
                      Position Routing
                    </div>
                    <div className="text-lg text-[#00ff66] font-semibold">
                      Select Command Path
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <select
                      className="w-full p-3 rounded-xl bg-black/60 border border-[#00ff66]/30 text-[#00ff66] outline-none focus:border-[#00ff66]"
                      value={selectedHeader}
                      onChange={(e) => {
                        setSelectedHeader(e.target.value);
                        setSelectedSubHeader("");
                        setSelectedSlotId("");
                      }}
                    >
                      <option value="">-- Select Header --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>

                    <select
                      className="w-full p-3 rounded-xl bg-black/60 border border-[#00ff66]/30 text-[#00ff66] outline-none focus:border-[#00ff66]"
                      value={selectedSubHeader}
                      onChange={(e) => {
                        setSelectedSubHeader(e.target.value);
                        setSelectedSlotId("");
                      }}
                      disabled={!selectedHeader}
                    >
                      <option value="">-- Select Sub Header --</option>
                      {subHeaders.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedHeader && selectedSubHeader && (
                    <div className="space-y-3 pt-2">
                      <div className="text-sm text-gray-400">
                        Available roles for{" "}
                        <span className="text-cyan-300">
                          {selectedHeader} — {selectedSubHeader}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
                        {roles.map((role) => {
                          const occupant = slotOccupants.get(role.slotId);
                          const isSelected = selectedSlotId === role.slotId;
                          const occupiedByAnother =
                            occupant && occupant.id !== selectedPerson.id;
                          const displayRole = getRoleDisplayLabel(role, roles);

                          return (
                            <button
                              key={role.slotId}
                              type="button"
                              onClick={() => setSelectedSlotId(role.slotId)}
                              className={`text-left rounded-2xl border p-4 transition ${
                                isSelected
                                  ? occupiedByAnother
                                    ? "border-red-500 bg-red-500/10"
                                    : "border-cyan-400 bg-cyan-400/10"
                                  : occupiedByAnother
                                  ? "border-red-500/30 bg-black/30 hover:border-red-400/60"
                                  : occupant?.id === selectedPerson.id
                                  ? "border-[#00ff66] bg-[#00ff66]/10 hover:border-[#00ff66]"
                                  : "border-[#00ff66]/20 bg-black/30 hover:border-[#00ff66]/50"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="font-semibold text-white">
                                  {displayRole}
                                </div>

                                {occupant ? (
                                  <div
                                    className={`text-[10px] uppercase tracking-[0.18em] rounded-full px-2 py-1 border ${
                                      occupant.id === selectedPerson.id
                                        ? "text-[#00ff66] border-[#00ff66]/40"
                                        : "text-red-300 border-red-400/40"
                                    }`}
                                  >
                                    {occupant.id === selectedPerson.id
                                      ? "Current"
                                      : "Occupied"}
                                  </div>
                                ) : (
                                  <div className="text-[10px] uppercase tracking-[0.18em] rounded-full px-2 py-1 border text-cyan-300 border-cyan-400/30">
                                    Open
                                  </div>
                                )}
                              </div>

                              <div className="mt-3 text-sm text-gray-400">
                                {selectedHeader} — {selectedSubHeader}
                              </div>

                              <div className="mt-3 text-sm">
                                {occupant ? (
                                  <span
                                    className={
                                      occupant.id === selectedPerson.id
                                        ? "text-[#7dffae]"
                                        : "text-red-300"
                                    }
                                  >
                                    {getRankName(occupant.rank_id)} {occupant.name}
                                  </span>
                                ) : (
                                  <span className="text-gray-500">
                                    No current occupant
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-[#00ff66]/15 bg-black/30 p-5">
                  <div className="text-xs uppercase tracking-[0.22em] text-gray-400 mb-1">
                    Position Actions
                  </div>
                  <div className="text-lg text-[#00ff66] font-semibold mb-4">
                    {selectedPerson.slotted_position ? "Reassignment" : "Assignment"}
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <button
                      onClick={updatePosition}
                      disabled={!selectedSlotId || !hasPositionChange || processing}
                      className={`px-6 py-3 rounded-xl font-semibold transition ${
                        !selectedSlotId || !hasPositionChange || processing
                          ? "border border-[#00ff66]/15 text-gray-500 cursor-not-allowed"
                          : isReplacingAnotherPerson
                          ? "border border-red-500 text-red-300 hover:bg-red-500/10"
                          : "bg-gradient-to-r from-[#00ff66] to-[#00cc44] text-black hover:scale-[1.02]"
                      }`}
                    >
                      {processing
                        ? "Saving..."
                        : selectedPerson.slotted_position
                        ? "Reassign Position"
                        : "Assign Position"}
                    </button>

                    {selectedPerson.slotted_position && (
                      <button
                        onClick={unassignPosition}
                        disabled={processing}
                        className={`px-6 py-3 rounded-xl border transition ${
                          processing
                            ? "border-red-500/20 text-red-400/40 cursor-not-allowed"
                            : "border-red-500 text-red-400 hover:bg-red-500/10"
                        }`}
                      >
                        {processing ? "Working..." : "Remove From Slot"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-[#00ff66]/20 bg-black/40 backdrop-blur-md p-6 space-y-5 h-fit">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-gray-400 mb-2">
              Live Preview
            </div>
            <h2 className="text-2xl font-semibold text-[#00ff66]">
              Assignment Summary
            </h2>
          </div>

          {!selectedPerson ? (
            <div className="rounded-2xl border border-[#00ff66]/15 bg-black/30 p-6 text-gray-400">
              Preview data will appear here once a person is selected.
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-[#00ff66]/15 bg-black/30 p-4 space-y-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-gray-400 mb-1">
                    Name
                  </div>
                  <div className="text-white font-semibold">
                    {getRankName(selectedPerson.rank_id)} {selectedPerson.name}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-gray-400 mb-1">
                    Rank Change
                  </div>
                  <div className={hasRankChange ? "text-cyan-300" : "text-gray-400"}>
                    {getRankName(selectedPerson.rank_id)} →{" "}
                    {selectedRankId ? getRankName(selectedRankId) : "Unranked"}
                  </div>
                  {hasRankChange && (
                    <div className="text-xs text-gray-500 mt-1">
                      Effective date: {rankChangedAt || "Not selected"}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-gray-400 mb-1">
                    MOS Change
                  </div>
                  <div className={hasMosChange ? "text-cyan-300" : "text-gray-400"}>
                    {selectedPerson.mos || "None"} → {selectedMosValue || "None"}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-gray-400 mb-1">
                    Position Change
                  </div>
                  <div
                    className={hasPositionChange ? "text-cyan-300" : "text-gray-400"}
                  >
                    {formatSlotToBillet(selectedPerson.slotted_position)} →{" "}
                    {selectedSlotId
                      ? formatSlotToBillet(selectedSlotId)
                      : "Unassigned"}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#00ff66]/15 bg-black/30 p-4 space-y-3">
                <div className="text-xs uppercase tracking-[0.18em] text-gray-400">
                  New Slot Breakdown
                </div>

                {selectedSlotPath ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-400">Header</span>
                      <span className="text-white">{selectedSlotPath.header}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-400">Sub Header</span>
                      <span className="text-white">
                        {selectedSlotPath.subHeader}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-400">Role</span>
                      <span className="text-white">{selectedSlotPath.roleLabel}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">
                    No target slot selected.
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[#00ff66]/15 bg-black/30 p-4 space-y-3">
                <div className="text-xs uppercase tracking-[0.18em] text-gray-400">
                  Slot Status
                </div>

                {!selectedSlotId ? (
                  <div className="text-gray-500 text-sm">No slot selected.</div>
                ) : selectedSlotOccupant ? (
                  <div className="space-y-2">
                    <div
                      className={`font-semibold ${
                        selectedSlotOccupant.id === selectedPerson.id
                          ? "text-[#7dffae]"
                          : "text-red-300"
                      }`}
                    >
                      {selectedSlotOccupant.id === selectedPerson.id
                        ? "Currently occupied by selected person"
                        : "Currently occupied by another person"}
                    </div>
                    <div className="text-sm text-white">
                      {getRankName(selectedSlotOccupant.rank_id)}{" "}
                      {selectedSlotOccupant.name}
                    </div>
                  </div>
                ) : (
                  <div className="text-cyan-300 text-sm">
                    Slot is open and available.
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[#00ff66]/15 bg-black/30 p-4 space-y-3">
                <div className="text-xs uppercase tracking-[0.18em] text-gray-400">
                  Action Outcome
                </div>

                <div className="space-y-2 text-sm">
                  <div className={hasRankChange ? "text-cyan-300" : "text-gray-500"}>
                    {hasRankChange ? "✔ Rank change pending" : "— No rank change"}
                  </div>

                  <div className={hasMosChange ? "text-cyan-300" : "text-gray-500"}>
                    {hasMosChange ? "✔ MOS change pending" : "— No MOS change"}
                  </div>

                  <div
                    className={hasPositionChange ? "text-cyan-300" : "text-gray-500"}
                  >
                    {hasPositionChange
                      ? "✔ Position change pending"
                      : "— No position change"}
                  </div>

                  <div className="text-gray-400">
                    {hasPositionChange
                      ? "Discord role sync will run"
                      : "No slot sync needed"}
                  </div>

                  {isReplacingAnotherPerson && (
                    <div className="text-red-300">
                      Warning: this slot is currently occupied by another person.
                    </div>
                  )}
                </div>
              </div>

              {currentSlotPath && (
                <div className="rounded-2xl border border-[#00ff66]/15 bg-black/30 p-4 space-y-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-gray-400">
                    Current Slot Path
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-400">Header</span>
                      <span className="text-white">{currentSlotPath.header}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-400">Sub Header</span>
                      <span className="text-white">
                        {currentSlotPath.subHeader}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-400">Role</span>
                      <span className="text-white">{currentSlotPath.roleLabel}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}