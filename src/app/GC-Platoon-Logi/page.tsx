"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Platoon = {
  id: string;
  name: string;
  tokens: number;
};

export default function ViewAssetsPage() {
  const router = useRouter();

  const [platoons, setPlatoons] = useState<Platoon[]>([]);
  const [selected, setSelected] = useState<Platoon | null>(null);
  const [ownedAssets, setOwnedAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  /* ================= FETCH ================= */

const fetchPlatoons = async () => {
  setLoading(true);

  const { data, error } = await supabase
    .from("platoons")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Error fetching platoons:", error);
    return;
  }

  setPlatoons(data || []);
  setLoading(false);
};

  const fetchOwnedAssets = async (platoonId: string) => {
    const { data, error } = await supabase
      .from("platoon_assets")
      .select(
        `
        id,
        quantity,
        asset:asset_id (
          id,
          name,
          token_cost
        )
      `
      )
      .eq("platoon_id", platoonId);

    if (error) {
      console.error("Error fetching assets:", error);
      return;
    }

    setOwnedAssets(data || []);
  };

  /* ================= INITIAL LOAD ================= */

  useEffect(() => {
    fetchPlatoons();
  }, []);

  /* ================= SELECT PLATOON ================= */

  const selectPlatoon = (p: Platoon) => {
    setSelected(p);
    fetchOwnedAssets(p.id);
  };

  /* ================= UI ================= */

  return (
    <div className="min-h-screen flex text-white bg-[radial-gradient(circle_at_center,#001f11_0%,#000000_100%)]">

      {/* ================= LEFT SIDEBAR ================= */}

      <div className="w-[300px] border-r border-[#00ff66]/30 p-6 space-y-4 bg-black/50">
        <h2 className="text-xl text-[#00ff66]">Platoons</h2>

        {loading && (
          <div className="text-gray-400">Loading platoons...</div>
        )}

        {!loading &&
          platoons.map((p) => (
            <div
              key={p.id}
              onClick={() => selectPlatoon(p)}
              className={`p-4 rounded-xl cursor-pointer transition border ${
              selected?.id === p.id
              ? "bg-[#00ff66]/20 border border-[#00ff66] shadow-[0_0_15px_rgba(0,255,102,0.4)]"
              : "border-[#00ff66]/20 hover:border-[#00ff66]/60 hover:bg-[#00ff66]/5"
              }`}
            >
              <div className="font-bold">{p.name}</div>
              <div className="text-sm">
                Tokens:{" "}
                <span className="text-[#00ff66]">{p.tokens}</span>
              </div>
            </div>
          ))}
      </div>

      {/* ================= MAIN ================= */}

      <div className="flex-1 p-10">
	  <button
            onClick={() => router.push("/Galactic-Campaign")}
            className="px-4 py-2 border border-[#00ff66] text-[#00ff66]"
          >
            ← Back
          </button>
        {!selected ? (
          <div className="text-gray-400">
            Select a platoon to view assets.
          </div>
        ) : (
          <div className="space-y-8">

            {/* TOKEN DISPLAY */}

            <div className="p-6 rounded-2xl border border-[#00ff66]/30 bg-black/50">
              <h2 className="text-2xl text-[#00ff66] mb-4">
                {selected.name}
              </h2>

              <div className="text-xl">
                Tokens:
                <span className="ml-2 text-[#00ff66] font-bold">
                  {selected.tokens}
                </span>
              </div>
            </div>

            {/* OWNED ASSETS */}

            <div className="rounded-2xl border border-[#00ff66]/30 bg-black/50 p-6">
              <h3 className="text-xl text-[#00ff66] mb-4">
                Owned Assets
              </h3>

              {ownedAssets.length === 0 ? (
                <div className="text-gray-400">
                  No assets owned.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {ownedAssets.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl border border-[#00ff66]/20"
                    >
                      <div className="font-bold">
                        {item.asset?.name}
                      </div>

                      <div>
                        Quantity:
                        <span className="ml-2 text-[#00ff66]">
                          {item.quantity}
                        </span>
                      </div>

                      <div className="text-sm text-gray-400">
                        Cost: {item.asset?.token_cost}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}