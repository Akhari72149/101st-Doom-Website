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
  const [activeTab, setActiveTab] = useState<"shop" | "cart" | "owned">("shop");
  const [cart, setCart] = useState<Record<string, number>>({});

  const [shopUnlocked, setShopUnlocked] = useState(false);
  const [shopPassword, setShopPassword] = useState("");

  const [buyQuantities, setBuyQuantities] =
    useState<Record<string, number>>({});

  const [shopOpen, setShopOpen] = useState(false);
  const [ownedOpen, setOwnedOpen] = useState(false);

  const [stats, setStats] = useState({
  totalAssets: 0,
  totalAssetValue: 0,
  tokensSpent: 0,
});

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
  /* ================= Stats ================= */

  const calculateStats = () => {
  if (!selected) return;

  // Total assets owned
  const totalAssets = ownedAssets.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  // Total asset value (quantity × token_cost)
  const totalAssetValue = ownedAssets.reduce((sum, item) => {
    return (
      sum +
      item.quantity *
        (item.asset?.token_cost || 0)
    );
  }, 0);

  // Tokens spent from transactions
  const tokensSpent = transactions
    .filter((tx) => tx.action === "BUY_ASSET")
    .reduce((sum, tx) => sum + tx.amount, 0);

  setStats({
    totalAssets,
    totalAssetValue,
    tokensSpent,
  });
};

useEffect(() => {
  calculateStats();
}, [ownedAssets, transactions]);


  /* ================= SELECT PLATOON ================= */

const selectPlatoon = (p: Platoon) => {
  setCart({});
  setBuyQuantities({});
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

  // Checkout system update

  const checkoutCart = async () => {
  if (!selected) return;

  const totalCost = Object.entries(cart).reduce((sum, [assetId, qty]) => {
    const asset = assets.find((a) => a.id === assetId);
    return sum + (asset?.token_cost || 0) * qty;
  }, 0);

  if (selected.tokens < totalCost) {
    alert("Not enough tokens to buy everything in the cart.");
    return;
  }

  await supabase
    .from("platoons")
    .update({ tokens: selected.tokens - totalCost })
    .eq("id", selected.id);

  for (const [assetId, qty] of Object.entries(cart)) {
    const existing = ownedAssets.find((o) => o.asset?.id === assetId);

    if (existing) {
      await supabase
        .from("platoon_assets")
        .update({ quantity: existing.quantity + qty })
        .eq("id", existing.id);
    } else {
      await supabase.from("platoon_assets").insert([
        {
          platoon_id: selected.id,
          asset_id: assetId,
          quantity: qty,
        },
      ]);
    }
  }

  // Log ONE transaction
  await supabase.from("token_transactions").insert([
    {
      platoon_id: selected.id,
      action: "BUY_ASSET",
      amount: totalCost,
      created_at: new Date().toISOString(),
    },
  ]);

  // Refresh UI
  setCart({});
  await fetchPlatoons();
  await fetchOwnedAssets(selected.id);
  await fetchTransactions(selected.id);
};

//ux update

const cartTotal = Object.entries(cart).reduce((sum, [assetId, qty]) => {
  const asset = assets.find((a) => a.id === assetId);
  return sum + (asset?.token_cost || 0) * qty;
}, 0);

const tokensAfterPurchase = selected ? selected.tokens - cartTotal : 0;

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
            <h2 className="text-2xl text-[#00ff66] mb-4">{selected.name}</h2>

            <div className="text-xl">
              Tokens:
              <span className="ml-2 text-[#00ff66] font-bold">{selected.tokens}</span>
            </div>
          </div>

          {/* DASHBOARD STATS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-[#00ff66]/30 bg-black/50">
              <div className="text-gray-400 text-sm">Total Assets Owned</div>
              <div className="text-2xl text-[#00ff66] font-bold">{stats.totalAssets}</div>
            </div>

            <div className="p-6 rounded-2xl border border-[#00ff66]/30 bg-black/50">
              <div className="text-gray-400 text-sm">Total Asset Value</div>
              <div className="text-2xl text-[#00ff66] font-bold">{stats.totalAssetValue}</div>
            </div>

            <div className="p-6 rounded-2xl border border-[#00ff66]/30 bg-black/50">
              <div className="text-gray-400 text-sm">Tokens Spent</div>
              <div className="text-2xl text-red-400 font-bold">{stats.tokensSpent}</div>
            </div>
          </div>

          {/* ================= TABS ================= */}
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => setActiveTab("shop")}
              className={`px-4 py-2 rounded-xl border ${
                activeTab === "shop" ? "border-[#00ff66] bg-[#00ff66]/20" : "border-[#00ff66]/20"
              }`}
            >
              Asset Shop
            </button>

            <button
              onClick={() => setActiveTab("cart")}
              className={`px-4 py-2 rounded-xl border ${
                activeTab === "cart" ? "border-[#00ff66] bg-[#00ff66]/20" : "border-[#00ff66]/20"
              }`}
            >
              Cart ({Object.keys(cart).length})
            </button>

            <button
              onClick={() => setActiveTab("owned")}
              className={`px-4 py-2 rounded-xl border ${
                activeTab === "owned" ? "border-[#00ff66] bg-[#00ff66]/20" : "border-[#00ff66]/20"
              }`}
            >
              Owned Assets
            </button>
          </div>

          {/* ================= TAB CONTENT ================= */}
          {activeTab === "shop" && (
            <div className="rounded-2xl border border-[#00ff66]/30 bg-black/50 overflow-hidden p-6">
              {!shopUnlocked ? (
                <div className="space-y-4 max-w-sm">
                  <input
                    type="password"
                    placeholder="Enter shop password"
                    value={shopPassword}
                    onChange={(e) => setShopPassword(e.target.value)}
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
                    onChange={(e) => setAssetSearch(e.target.value)}
                    className="bg-black border border-[#00ff66]/30 rounded-xl px-4 py-2 mb-4 w-full"
                  />

                  <div className="grid grid-cols-3 gap-4">
                    {filteredAssets.map((asset) => {
                      const qty = buyQuantities[asset.id] || 1;

                      return (
                        <div
                          key={asset.id}
                          className="p-5 rounded-2xl border border-[#00ff66]/20 bg-black/50 space-y-3"
                        >
                          <div className="font-bold text-[#00ff66]">{asset.name}</div>
                          <div>Cost: {asset.token_cost}</div>
                          <div>Stock: {asset.inventory}</div>

                          <input
                            type="number"
                            min={1}
                            value={qty}
                            onChange={(e) =>
                              setBuyQuantities({
                                ...buyQuantities,
                                [asset.id]: Number(e.target.value),
                              })
                            }
                            className="w-full bg-black border border-[#00ff66]/30 rounded-lg px-2 py-1"
                          />

<button
  onClick={() => {
    setCart((prev) => ({
      ...prev,
      [asset.id]: (prev[asset.id] || 0) + qty,
    }));
    setBuyQuantities((prev) => ({ ...prev, [asset.id]: 1 }));
  }}
  className="w-full px-4 py-2 border border-[#00ff66] rounded-lg hover:bg-[#00ff66] hover:text-black transition"
>
  Add to Cart
</button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

{activeTab === "cart" && (
  <div className="rounded-2xl border border-[#00ff66]/30 bg-black/50 overflow-hidden p-6">
    <h3 className="text-xl text-[#00ff66] mb-4">Cart</h3>

    {Object.keys(cart).length === 0 ? (
      <div className="text-gray-400">Cart is empty.</div>
    ) : (
      <div className="space-y-3">
        {Object.entries(cart).map(([assetId, qty]) => {
          const asset = assets.find((a) => a.id === assetId);
          if (!asset) return null;

          return (
            <div
              key={assetId}
              className="flex justify-between items-center border-b border-[#00ff66]/20 py-2"
            >
              <div>
                {asset.name} x {qty} ({asset.token_cost * qty} tokens)
              </div>
              <button
                onClick={() => {
                  setCart((prev) => {
                    const newCart = { ...prev };
                    delete newCart[assetId];
                    return newCart;
                  });
                }}
                className="px-2 py-1 border border-red-500 text-red-400 rounded-lg hover:bg-red-500 hover:text-black transition"
              >
                Remove
              </button>
            </div>
          );
        })}

<div className="mt-4 space-y-1">
  <div className="font-bold text-[#00ff66]">
    Total Cost: {cartTotal} tokens
  </div>

  {selected && (
    <div
      className={`text-sm ${
        tokensAfterPurchase < 0 ? "text-red-400" : "text-gray-400"
      }`}
    >
      Tokens After Purchase: {tokensAfterPurchase}
    </div>
  )}
</div>

<button
  onClick={checkoutCart}
  disabled={tokensAfterPurchase < 0}
  className={`mt-4 w-full px-4 py-2 border rounded-lg transition
  ${
    tokensAfterPurchase < 0
      ? "border-red-500 text-red-400 cursor-not-allowed"
      : "border-[#00ff66] hover:bg-[#00ff66] hover:text-black"
  }`}
>
  Buy
</button>


      </div>
    )}
  </div>
)}

          {activeTab === "owned" && (
            <div className="rounded-2xl border border-[#00ff66]/30 bg-black/50 overflow-hidden p-6 grid grid-cols-3 gap-4">
              {ownedAssets.length === 0 ? (
                <div className="text-gray-400">No assets owned.</div>
              ) : (
                ownedAssets.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-[#00ff66]/30 bg-black/40 hover:border-[#00ff66]/60 transition space-y-2"
                  >
                    <div className="font-medium text-[#00ff66]">{item.asset?.name}</div>

                    <div className="text-sm text-gray-300">
                      Quantity:
                      <span className="ml-2 font-bold text-white">{item.quantity}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  </div>
);
}