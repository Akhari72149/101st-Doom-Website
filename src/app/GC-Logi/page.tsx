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
  description?: string;
};

type Transaction = {
  id: string;
  action: string;
  amount: number;
  quantity?: number;
  asset_id?: string | null;
  asset_name?: string | null;
  performed_by?: string | null;
  notes?: string | null;
  created_at: string;
};

export default function GCLogisticsHub() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [platoons, setPlatoons] = useState<Platoon[]>([]);
  const [activeTab, setActiveTab] = useState<"shop" | "cart" | "owned">("shop");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [ownedAssets, setOwnedAssets] = useState<any[]>([]);
  const [selected, setSelected] = useState<Platoon | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState(0);
  const [assetSearch, setAssetSearch] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [stats, setStats] = useState({
    totalAssets: 0,
    totalAssetValue: 0,
    tokensSpent: 0,
  });
  const [cart, setCart] = useState<Record<string, number>>({});
  const [buyQuantities, setBuyQuantities] = useState<Record<string, number>>({});
  const [removeQuantities, setRemoveQuantities] = useState<Record<string, number>>({});
  const [shopOpen, setShopOpen] = useState(false);
  const [ownedOpen, setOwnedOpen] = useState(false);

  /* ================= AUTH ================= */

  useEffect(() => {
    const checkAccess = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setCurrentUserId(user.id);

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const userRoles = data?.map((r) => r.role) || [];

      const hasAccess =
        userRoles.includes("Akhari") ||
        userRoles.includes("logistics");

      if (!hasAccess) {
        router.replace("/GC-Platoon-Logi");
        return;
      }

      setLoadingAuth(false);
    };

    checkAccess();
  }, [router]);

  useEffect(() => {
    if (!selected) return;

    const updated = platoons.find((p) => p.id === selected.id);
    if (updated) {
      setSelected(updated);
    }
  }, [platoons, selected]);

  /* ================= STAT CALCS ================= */

  const calculateStats = () => {
    if (!selected) return;

    const totalAssets = ownedAssets.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    const totalAssetValue = ownedAssets.reduce((sum, item) => {
      return sum + item.quantity * (item.asset?.token_cost || 0);
    }, 0);

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
  }, [ownedAssets, transactions, selected]);

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

    const hasFullAccess =
      platoonName?.includes("company") ||
      platoonName?.includes("blinds basket");

    let query = supabase.from("hq_assets").select("*");

    if (!hasFullAccess) {
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
    if (!loadingAuth) {
      fetchPlatoons();
    }
  }, [loadingAuth]);

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

  /* ================= ADD TOKENS ================= */

  const addTokens = async () => {
    if (!selected || amount <= 0) return;

    await supabase
      .from("platoons")
      .update({ tokens: selected.tokens + amount })
      .eq("id", selected.id);

    await supabase.from("token_transactions").insert([
      {
        platoon_id: selected.id,
        action: "ADD_TOKENS",
        amount,
        quantity: 0,
        asset_id: null,
        asset_name: null,
        performed_by: currentUserId,
        notes: `Added ${amount} tokens to ${selected.name}`,
        created_at: new Date().toISOString(),
      },
    ]);

    setAmount(0);
    await fetchPlatoons();
    await fetchTransactions(selected.id);
  };

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
      .update({
        tokens: selected.tokens - totalCost,
      })
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
        quantity: qty,
        asset_id: asset.id,
        asset_name: asset.name,
        performed_by: currentUserId,
        notes: `Bought ${qty} x ${asset.name} for ${selected.name} (${totalCost} tokens)`,
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

  /* ================= CART CHECKOUT ================= */

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
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) continue;

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

      await supabase.from("token_transactions").insert([
        {
          platoon_id: selected.id,
          action: "BUY_ASSET",
          amount: asset.token_cost * qty,
          quantity: qty,
          asset_id: asset.id,
          asset_name: asset.name,
          performed_by: currentUserId,
          notes: `Bought ${qty} x ${asset.name} for ${selected.name} (${asset.token_cost * qty} tokens)`,
          created_at: new Date().toISOString(),
        },
      ]);
    }

    setCart({});
    await fetchPlatoons();
    await fetchOwnedAssets(selected.id);
    await fetchTransactions(selected.id);
  };

  /* ================= REMOVE ASSET ================= */

  const removeAsset = async (owned: any) => {
    if (!selected) return;

    const qtyToRemove = removeQuantities[owned.id] || 1;

    if (qtyToRemove <= 0) return;
    if (qtyToRemove > owned.quantity) {
      alert("Cannot remove more than owned");
      return;
    }

    const newQty = owned.quantity - qtyToRemove;

    if (newQty > 0) {
      await supabase
        .from("platoon_assets")
        .update({ quantity: newQty })
        .eq("id", owned.id);
    } else {
      await supabase
        .from("platoon_assets")
        .delete()
        .eq("id", owned.id);
    }

    await supabase.from("token_transactions").insert([
      {
        platoon_id: selected.id,
        action: "REMOVE_ASSET",
        amount: 0,
        quantity: qtyToRemove,
        asset_id: owned.asset?.id || null,
        asset_name: owned.asset?.name || null,
        performed_by: currentUserId,
        notes: `Removed ${qtyToRemove} x ${owned.asset?.name || "asset"} from ${selected.name}`,
        created_at: new Date().toISOString(),
      },
    ]);

    setRemoveQuantities((prev) => ({
      ...prev,
      [owned.id]: 1,
    }));

    await fetchOwnedAssets(selected.id);
    await fetchTransactions(selected.id);
  };

  const filteredAssets = assets.filter((asset) =>
    asset.name.toLowerCase().includes(assetSearch.toLowerCase())
  );

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#00ff66] bg-black">
        Checking Permissions...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex text-white bg-[radial-gradient(circle_at_center,#001f11_0%,#000000_100%)]">
      <div className="w-[300px] border-r border-[#00ff66]/30 p-6 space-y-4">
        <button
          onClick={() => router.push("/Galactic-Campaign")}
          className="px-4 py-2 border border-[#00ff66] text-[#00ff66]"
        >
          ← Back
        </button>

        <button
          onClick={() => router.push("/GC-Logistics-Transactions")}
          className="w-full px-4 py-2 border border-[#00ff66] text-[#00ff66] rounded-xl hover:bg-[#00ff66] hover:text-black transition"
        >
          View Transaction History
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

      <div className="flex-1 p-10 space-y-10">
        {!selected ? (
          <div className="text-gray-400">Select a platoon.</div>
        ) : (
          <>
            <div className="p-6 rounded-2xl border border-[#00ff66]/30 bg-black/50">
              <h2 className="text-2xl text-[#00ff66] mb-4">{selected.name}</h2>

              <div className="text-xl">
                Tokens:
                <span className="ml-2 text-[#00ff66] font-bold">
                  {selected.tokens}
                </span>
              </div>

              <div className="mt-6 flex gap-4">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="bg-black border border-[#00ff66]/30 rounded-xl px-4 py-2"
                />

                <button
                  onClick={addTokens}
                  className="px-6 py-2 border border-[#00ff66] rounded-xl hover:bg-[#00ff66] hover:text-black transition"
                >
                  Add Tokens
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl border border-[#00ff66]/30 bg-black/50">
                <div className="text-gray-400 text-sm">Total Assets Owned</div>
                <div className="text-2xl text-[#00ff66] font-bold">
                  {stats.totalAssets}
                </div>
              </div>

              <div className="p-6 rounded-2xl border border-[#00ff66]/30 bg-black/50">
                <div className="text-gray-400 text-sm">Total Asset Value</div>
                <div className="text-2xl text-[#00ff66] font-bold">
                  {stats.totalAssetValue}
                </div>
              </div>

              <div className="p-6 rounded-2xl border border-[#00ff66]/30 bg-black/50">
                <div className="text-gray-400 text-sm">Tokens Spent</div>
                <div className="text-2xl text-red-400 font-bold">
                  {stats.tokensSpent}
                </div>
              </div>
            </div>

            <div className="flex gap-4 mb-4">
              <button
                onClick={() => setActiveTab("shop")}
                className={`px-4 py-2 rounded-xl border ${
                  activeTab === "shop"
                    ? "border-[#00ff66] bg-[#00ff66]/20"
                    : "border-[#00ff66]/20"
                }`}
              >
                Asset Shop
              </button>

              <button
                onClick={() => setActiveTab("cart")}
                className={`px-4 py-2 rounded-xl border ${
                  activeTab === "cart"
                    ? "border-[#00ff66] bg-[#00ff66]/20"
                    : "border-[#00ff66]/20"
                }`}
              >
                Cart ({Object.keys(cart).length})
              </button>

              <button
                onClick={() => setActiveTab("owned")}
                className={`px-4 py-2 rounded-xl border ${
                  activeTab === "owned"
                    ? "border-[#00ff66] bg-[#00ff66]/20"
                    : "border-[#00ff66]/20"
                }`}
              >
                Owned Assets
              </button>
            </div>

            {activeTab === "shop" && (
              <div className="rounded-2xl border border-[#00ff66]/30 bg-black/50 overflow-hidden p-6">
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
                        <div className="font-bold text-[#00ff66]">
                          {asset.name}
                        </div>

                        {asset.description && (
                          <div className="text-sm text-gray-400">
                            {asset.description}
                          </div>
                        )}

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
                            setBuyQuantities((prev) => ({
                              ...prev,
                              [asset.id]: 1,
                            }));
                          }}
                          className="w-full px-4 py-2 border border-[#00ff66] rounded-lg hover:bg-[#00ff66] hover:text-black transition"
                        >
                          Add to Cart
                        </button>
                      </div>
                    );
                  })}
                </div>
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

                    <div className="mt-4 font-bold text-[#00ff66]">
                      Total Cost:{" "}
                      {Object.entries(cart).reduce((sum, [assetId, qty]) => {
                        const asset = assets.find((a) => a.id === assetId);
                        return sum + (asset?.token_cost || 0) * qty;
                      }, 0)}{" "}
                      tokens
                    </div>

                    <button
                      onClick={checkoutCart}
                      className="mt-4 w-full px-4 py-2 border border-[#00ff66] rounded-lg hover:bg-[#00ff66] hover:text-black transition"
                    >
                      Checkout
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
                  ownedAssets.map((item) => {
                    const removeQty = removeQuantities[item.id] || 1;

                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl border border-[#00ff66]/30 space-y-3"
                      >
                        <div>{item.asset?.name}</div>
                        <div>Quantity: {item.quantity}</div>

                        <input
                          type="number"
                          min={1}
                          max={item.quantity}
                          value={removeQty}
                          onChange={(e) =>
                            setRemoveQuantities({
                              ...removeQuantities,
                              [item.id]: Number(e.target.value),
                            })
                          }
                          className="w-full bg-black border border-[#00ff66]/30 rounded-lg px-2 py-1"
                        />

                        <button
                          onClick={() => removeAsset(item)}
                          className="w-full px-4 py-2 border border-red-500 text-red-400 rounded-lg hover:bg-red-500 hover:text-black transition"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}