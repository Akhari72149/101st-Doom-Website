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
  sort_order?: number;
};

type Asset = {
  id: string;
  name: string;
  token_cost: number;
  inventory: number;
};

type Transaction = {
  id: string;
  action: string;
  amount: number;
  created_at: string;
};

export default function GCLogisticsHub() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [platoons, setPlatoons] = useState<Platoon[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [ownedAssets, setOwnedAssets] = useState<any[]>([]);
  const [selected, setSelected] = useState<Platoon | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [assetSearch, setAssetSearch] = useState("");

  const [shopUnlocked, setShopUnlocked] = useState(false);
  const [shopPassword, setShopPassword] = useState("");

  const [buyQuantities, setBuyQuantities] =
    useState<Record<string, number>>({});

  const [shopOpen, setShopOpen] = useState(false);
  const [ownedOpen, setOwnedOpen] = useState(false);

  /* ================= PASSWORD UNLOCK ================= */

  const unlockShop = async () => {
  if (!shopPassword) return;

  const { data, error } = await supabase.rpc(
    "check_shop_password",
    { password_input: shopPassword }
  );

  if (error) {
    console.error(error);
    alert("Error verifying password");
    return;
  }

  if (data === true) {
    setShopUnlocked(true);
    setShopPassword("");
  } else {
    alert("Incorrect password");
  }
};

  /* ================= FETCH DATA ================= */

  const fetchPlatoons = async () => {
    const { data } = await supabase
      .from("platoons")
      .select("*")
      .order("sort_order", { ascending: true });

    setPlatoons(data || []);
  };

 const fetchAssets = async (platoonId: string) => {
  if (!platoonId) return;

  const { data: platoonData } = await supabase
    .from("platoons")
    .select("name")
    .eq("id", platoonId)
    .single();

  const platoonName = platoonData?.name?.toLowerCase();

  // ✅ Treat company + blinds basket as full access
  const isFullAccess =
    platoonName?.includes("company") ||
    platoonName?.includes("blinds basket");

  let query = supabase.from("hq_assets").select("*");

  if (!isFullAccess) {
    // Normal platoon → restrict to platoon assets
    query = query.eq("category", "platoon");
  }

  const { data } = await query;
  setAssets(data || []);
};

  const fetchTransactions = async (platoonId: string) => {
    const { data } = await supabase
      .from("token_transactions")
      .select("*")
      .eq("platoon_id", platoonId)
      .order("created_at", { ascending: false });

    setTransactions(data || []);
  };

  const fetchOwnedAssets = async (platoonId: string) => {
    const { data } = await supabase
      .from("platoon_assets")
      .select(`
        id,
        quantity,
        asset:asset_id (
          id,
          name,
          token_cost
        )
      `)
      .eq("platoon_id", platoonId);

    setOwnedAssets(data || []);
  };

  useEffect(() => {
    fetchPlatoons();
  }, []);

  /* ================= SELECT PLATOON ================= */

  const selectPlatoon = (p: Platoon) => {
    setSelected(p);
    fetchTransactions(p.id);
    fetchOwnedAssets(p.id);
    fetchAssets(p.id);
  };

  useEffect(() => {
  if (selected) {
    fetchAssets(selected.id);
  }
}, [selected]);

  /* ================= BUY ASSET ================= */

  const buyAsset = async (asset: Asset) => {
    if (!selected) return;

    const qty = buyQuantities[asset.id] || 1;
    const totalCost = asset.token_cost * qty;

    if (qty <= 0) return;

    if (selected.tokens < totalCost) {
      alert("Not enough tokens");
      return;
    }

    await supabase
      .from("platoons")
      .update({ tokens: selected.tokens - totalCost })
      .eq("id", selected.id);

    const existing = ownedAssets.find(
      (o) => o.asset?.id === asset.id
    );

    if (existing) {
      await supabase
        .from("platoon_assets")
        .update({
          quantity: existing.quantity + qty,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("platoon_assets").insert([
        {
          platoon_id: selected.id,
          asset_id: asset.id,
          quantity: qty,
        },
      ]);
    }

    await supabase.from("token_transactions").insert([
      {
        platoon_id: selected.id,
        action: "BUY_ASSET",
        amount: totalCost,
        created_at: new Date().toISOString(),
      },
    ]);

    setBuyQuantities((prev) => ({
      ...prev,
      [asset.id]: 1,
    }));

    await fetchPlatoons();
    await fetchOwnedAssets(selected.id);
    await fetchTransactions(selected.id);
  };


  const filteredAssets = assets.filter((asset) =>
    asset.name.toLowerCase().includes(assetSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen flex text-white bg-[radial-gradient(circle_at_center,#001f11_0%,#000000_100%)]">
      
      {/* LEFT PANEL */}
      <div className="w-[300px] border-r border-[#00ff66]/30 p-6 space-y-4">
        <button
          onClick={() => router.push("/Galactic-Campaign")}
          className="px-4 py-2 border border-[#00ff66] text-[#00ff66]"
        >
          ← Back
        </button>

        <h2 className="text-[#00ff66] text-xl mb-4">Platoons</h2>

        {platoons.map((p) => (
          <div
            key={p.id}
            onClick={() => selectPlatoon(p)}
            className={`p-4 rounded-xl cursor-pointer transition ${
              selected?.id === p.id
                ? "bg-[#00ff66]/20 border border-[#00ff66]"
                : "border border-[#00ff66]/20 hover:border-[#00ff66]/60"
            }`}
          >
            <div className="font-bold">{p.name}</div>
            <div className="text-sm">Tokens: {p.tokens}</div>
          </div>
        ))}
      </div>

      {/* CENTER PANEL */}
      <div className="flex-1 p-10 space-y-10">
        {!selected ? (
          <div className="text-gray-400">Select a platoon.</div>
        ) : (
          <>
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

            {/* ================= ASSET SHOP ================= */}
            <div className="rounded-2xl border border-[#00ff66]/30 bg-black/50 overflow-hidden">
              <div
                onClick={() => setShopOpen(!shopOpen)}
                className="p-6 flex justify-between cursor-pointer hover:bg-[#00ff66]/10"
              >
                <h3 className="text-xl text-[#00ff66]">Asset Shop</h3>
                <span>{shopOpen ? "▲" : "▼"}</span>
              </div>

              {shopOpen && (
                <div className="p-6 border-t border-[#00ff66]/30">
                  {!shopUnlocked ? (
                    <div className="space-y-4 max-w-sm">
                      <input
                        type="password"
                        placeholder="Enter shop password"
                        value={shopPassword}
                        onChange={(e) =>
                          setShopPassword(e.target.value)
                        }
                        className="w-full bg-black border border-[#00ff66]/30 rounded-xl px-4 py-2"
                      />

                      <button
                        onClick={unlockShop}
                        className="w-full px-4 py-2 border border-[#00ff66] rounded-xl hover:bg-[#00ff66] hover:text-black transition"
                      >
                        Unlock Shop
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        placeholder="Search..."
                        value={assetSearch}
                        onChange={(e) =>
                          setAssetSearch(e.target.value)
                        }
                        className="bg-black border border-[#00ff66]/30 rounded-xl px-4 py-2 mb-4"
                      />

                      <div className="grid grid-cols-3 gap-4">
                        {filteredAssets.map((asset) => {
                          const qty =
                            buyQuantities[asset.id] || 1;

                          return (
                            <div
                              key={asset.id}
                              className="p-5 rounded-2xl border border-[#00ff66]/20 bg-black/50 space-y-3"
                            >
                              <div className="font-bold text-[#00ff66]">
                                {asset.name}
                              </div>

                              <div>Cost: {asset.token_cost}</div>
                              <div>Stock: {asset.inventory}</div>

                              <input
                                type="number"
                                min={1}
                                value={qty}
                                onChange={(e) =>
                                  setBuyQuantities({
                                    ...buyQuantities,
                                    [asset.id]: Number(
                                      e.target.value
                                    ),
                                  })
                                }
                                className="w-full bg-black border border-[#00ff66]/30 rounded-lg px-2 py-1"
                              />

                              <button
                                onClick={() => buyAsset(asset)}
                                className="w-full px-4 py-2 border border-[#00ff66] rounded-lg hover:bg-[#00ff66] hover:text-black transition"
                              >
                                Buy
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ================= OWNED ASSETS ================= */}
<div className="rounded-2xl border border-[#00ff66]/30 bg-black/50 overflow-hidden">
  <div
    onClick={() => setOwnedOpen(!ownedOpen)}
    className="p-6 flex justify-between cursor-pointer hover:bg-[#00ff66]/10"
  >
    <h3 className="text-xl text-[#00ff66]">
      Owned Assets
    </h3>
    <span>{ownedOpen ? "▲" : "▼"}</span>
  </div>

  {ownedOpen && (
    <div className="p-6 border-t border-[#00ff66]/30 grid grid-cols-3 gap-4">
      {ownedAssets.length === 0 ? (
        <div className="text-gray-400">
          No assets owned.
        </div>
      ) : (
        ownedAssets.map((item) => (
          <div
            key={item.id}
            className="p-4 rounded-xl border border-[#00ff66]/30 bg-black/40 hover:border-[#00ff66]/60 transition space-y-2"
          >
            <div className="font-medium text-[#00ff66]">
              {item.asset?.name}
            </div>

            <div className="text-sm text-gray-300">
              Quantity:
              <span className="ml-2 font-bold text-white">
                {item.quantity}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  )}
</div>
          </>
        )}
      </div>
    </div>
  );
}