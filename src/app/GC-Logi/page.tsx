"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Platoon = {
  id: string;
  name: string;
  tokens: number;
  lives: number;
  vehicles: number;
  sort_order: number;
};

type Asset = {
  id: string;
  category: string;
  name: string;
  token_cost: number;
  inventory: number;
};

type Inventory = {
  asset_id: string;
  in_stock: number;
};

export default function GCLogisticsHub() {
  const router = useRouter();

  const [platoons, setPlatoons] = useState<Platoon[]>([]);
  const [selected, setSelected] = useState<Platoon | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  /* ================= AUTH ================= */

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
      }
    };

    checkAuth();
  }, []);

  /* ================= FETCH DATA ================= */

  const fetchData = async () => {
    const { data: platoonData } = await supabase
      .from("platoons")
      .select("*")
      .order("sort_order", { ascending: true });

    const { data: assetData } = await supabase
      .from("hq_assets")
      .select("*")
      .order("category");

    setPlatoons(platoonData || []);
    setAssets(assetData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  /* ================= LOAD PLATOON INVENTORY ================= */

  const loadInventory = async (platoonId: string) => {
    const { data } = await supabase
      .from("platoon_asset_inventory")
      .select("asset_id, in_stock")
      .eq("platoon_id", platoonId);

    const map: Record<string, number> = {};

    (data || []).forEach((row: any) => {
      map[row.asset_id] = row.in_stock;
    });

    setInventory(map);
  };

  const selectPlatoon = (p: Platoon) => {
    setSelected(p);
    loadInventory(p.id);
  };

  /* ================= BUY ASSET ================= */

  const buyAsset = async (asset: Asset) => {
    if (!selected) return;
    if (selected.tokens < asset.token_cost) {
      alert("Not enough tokens");
      return;
    }

    const newTokenBalance = selected.tokens - asset.token_cost;

    // Deduct tokens
    await supabase
      .from("platoons")
      .update({ tokens: newTokenBalance })
      .eq("id", selected.id);

    // Reduce global asset stock
    await supabase
      .from("hq_assets")
      .update({ inventory: asset.inventory - 1 })
      .eq("id", asset.id);

    // Update platoon inventory
    const existing = inventory[asset.id] || 0;

    await supabase.from("platoon_asset_inventory").upsert([
      {
        platoon_id: selected.id,
        asset_id: asset.id,
        in_stock: existing + 1,
      },
    ]);

    // Log transaction
    await supabase.from("token_transactions").insert([
      {
        platoon_id: selected.id,
        action: "BUY_ASSET",
        amount: asset.token_cost,
        asset_id: asset.id,
        created_at: new Date().toISOString(),
      },
    ]);

    // Refresh
    fetchData();
    loadInventory(selected.id);
  };

  /* ================= LOADING ================= */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-[#00ff66]">
        Loading Logistics...
      </div>
    );
  }

  /* ================= GROUP ASSETS BY CATEGORY ================= */

  const grouped = assets.reduce((acc: any, asset) => {
    if (!acc[asset.category]) acc[asset.category] = [];
    acc[asset.category].push(asset);
    return acc;
  }, {});

  /* ================= UI ================= */

  return (
    <div className="min-h-screen flex text-white bg-[radial-gradient(circle_at_center,#001f11_0%,#000a06_100%)]">

      {/* ================= LEFT — PLATOONS ================= */}

      <div className="w-[300px] border-r border-[#00ff66]/30 p-6">
        <h2 className="text-xl text-[#00ff66] mb-6">Platoons</h2>

        {platoons.map((p) => (
          <div
            key={p.id}
            onClick={() => selectPlatoon(p)}
            className={`p-4 mb-3 border rounded-xl cursor-pointer transition ${
              selected?.id === p.id
                ? "border-[#00ff66] bg-[#00ff66]/10"
                : "border-[#00ff66]/30 hover:border-[#00ff66]"
            }`}
          >
            <div className="font-bold">{p.name}</div>
            <div className="text-sm text-gray-400">
              Tokens: {p.tokens}
            </div>
          </div>
        ))}
      </div>

      {/* ================= CENTER — ASSET MARKET ================= */}

      <div className="flex-1 p-10 overflow-y-auto">

        {!selected ? (
          <div className="text-gray-400">
            Select a platoon to manage assets.
          </div>
        ) : (
          Object.keys(grouped).map((category) => (
            <div key={category} className="mb-12">
              <h3 className="text-[#00ff66] text-2xl mb-4">
                {category}
              </h3>

              <div className="grid md:grid-cols-2 gap-6">
                {grouped[category].map((asset: Asset) => (
                  <div
                    key={asset.id}
                    className="border border-[#00ff66]/30 bg-black/50 p-6 rounded-xl"
                  >
                    <div className="text-lg font-semibold">
                      {asset.name}
                    </div>

                    <div className="text-sm text-gray-400 mt-1">
                      Cost: {asset.token_cost} Tokens
                    </div>

                    <div className="text-sm text-gray-400">
                      Global Stock: {asset.inventory}
                    </div>

                    <div className="text-sm text-gray-400">
                      Platoon Stock: {inventory[asset.id] || 0}
                    </div>

                    <button
                      onClick={() => buyAsset(asset)}
                      disabled={
                        selected.tokens < asset.token_cost ||
                        asset.inventory <= 0
                      }
                      className="mt-4 px-4 py-2 border border-[#00ff66] rounded-lg hover:bg-[#00ff66] hover:text-black transition disabled:opacity-30"
                    >
                      Purchase
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

      </div>
    </div>
  );
}