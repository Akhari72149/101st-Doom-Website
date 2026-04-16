"use client";

import { useEffect, useMemo, useState } from "react";
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
  description?: string | null;
  category?: string | null;
};

type Transaction = {
  id: string;
  action: string;
  amount: number;
  created_at: string;
};

type OwnedAsset = {
  id: string;
  quantity: number;
  asset: {
    id: string;
    name: string;
    token_cost: number;
  } | null;
};

export default function GCLogisticsHub() {
  const router = useRouter();

  const [platoons, setPlatoons] = useState<Platoon[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [ownedAssets, setOwnedAssets] = useState<OwnedAsset[]>([]);
  const [selected, setSelected] = useState<Platoon | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [assetSearch, setAssetSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"shop" | "cart" | "owned">("shop");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [shopUnlocked, setShopUnlocked] = useState(false);
  const [shopPassword, setShopPassword] = useState("");
  const [buyQuantities, setBuyQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const [stats, setStats] = useState({
    totalAssets: 0,
    totalAssetValue: 0,
    tokensSpent: 0,
  });

  const safeQuantity = (value: number) => {
    if (!Number.isFinite(value)) return 1;
    return Math.max(1, Math.floor(value));
  };

  /* ================= PASSWORD UNLOCK ================= */

  const unlockShop = async () => {
    if (!shopPassword.trim()) return;

    const { data, error } = await supabase.rpc("check_shop_password", {
      password_input: shopPassword,
    });

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
    const { data, error } = await supabase
      .from("platoons")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Failed to fetch platoons:", error);
      return;
    }

    setPlatoons((data || []) as Platoon[]);
  };

  const fetchAssets = async (platoonId: string) => {
    if (!platoonId) return;

    const { data: platoonData, error: platoonError } = await supabase
      .from("platoons")
      .select("name")
      .eq("id", platoonId)
      .single();

    if (platoonError) {
      console.error("Failed to fetch platoon access:", platoonError);
      return;
    }

    const platoonName = platoonData?.name?.toLowerCase();

    const isFullAccess =
      platoonName?.includes("company") ||
      platoonName?.includes("blinds basket");

    let query = supabase.from("hq_assets").select("*");

    if (!isFullAccess) {
      query = query.eq("category", "platoon");
    }

    const { data, error } = await query.order("name", { ascending: true });

    if (error) {
      console.error("Failed to fetch assets:", error);
      return;
    }

    setAssets((data || []) as Asset[]);
  };

  const fetchTransactions = async (platoonId: string) => {
    const { data, error } = await supabase
      .from("token_transactions")
      .select("*")
      .eq("platoon_id", platoonId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch transactions:", error);
      return;
    }

    setTransactions((data || []) as Transaction[]);
  };

  const fetchOwnedAssets = async (platoonId: string) => {
    const { data, error } = await supabase
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

    if (error) {
      console.error("Failed to fetch owned assets:", error);
      return;
    }

    const normalized: OwnedAsset[] = (data || []).map((row: any) => ({
      id: row.id,
      quantity: row.quantity,
      asset: Array.isArray(row.asset) ? row.asset[0] || null : row.asset || null,
    }));

    setOwnedAssets(normalized);
  };

  useEffect(() => {
    fetchPlatoons();
  }, []);

  useEffect(() => {
    if (!selected) return;

    const updated = platoons.find((p) => p.id === selected.id);
    if (updated) {
      setSelected(updated);
    }
  }, [platoons, selected]);

  /* ================= STATS ================= */

  useEffect(() => {
    if (!selected) return;

    const totalAssets = ownedAssets.reduce((sum, item) => sum + item.quantity, 0);

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
  }, [ownedAssets, transactions, selected]);

  /* ================= SELECT PLATOON ================= */

  const selectPlatoon = async (p: Platoon) => {
    setCart({});
    setBuyQuantities({});
    setSelected(p);

    await Promise.all([
      fetchTransactions(p.id),
      fetchOwnedAssets(p.id),
      fetchAssets(p.id),
    ]);
  };

  /* ================= CHECKOUT ================= */

  const checkoutCart = async () => {
    if (!selected) return;
    if (Object.keys(cart).length === 0) return;

    const totalCost = Object.entries(cart).reduce((sum, [assetId, qty]) => {
      const asset = assets.find((a) => a.id === assetId);
      return sum + (asset?.token_cost || 0) * qty;
    }, 0);

    if (selected.tokens < totalCost) {
      alert("Not enough tokens to buy everything in the cart.");
      return;
    }

    for (const [assetId, qty] of Object.entries(cart)) {
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) continue;

      if (qty > asset.inventory) {
        alert(`Cannot buy more than available stock for ${asset.name}.`);
        return;
      }
    }

    setLoading(true);

    const { error: tokenError } = await supabase
      .from("platoons")
      .update({ tokens: selected.tokens - totalCost })
      .eq("id", selected.id);

    if (tokenError) {
      console.error("Failed to update platoon tokens:", tokenError);
      alert("Failed to complete purchase.");
      setLoading(false);
      return;
    }

    for (const [assetId, qty] of Object.entries(cart)) {
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) continue;

      const existing = ownedAssets.find((o) => o.asset?.id === assetId);

      if (existing) {
        const { error: updateError } = await supabase
          .from("platoon_assets")
          .update({ quantity: existing.quantity + qty })
          .eq("id", existing.id);

        if (updateError) {
          console.error("Failed to update owned asset:", updateError);
          alert(`Failed while updating ${asset.name}.`);
          setLoading(false);
          return;
        }
      } else {
        const { error: insertError } = await supabase.from("platoon_assets").insert([
          {
            platoon_id: selected.id,
            asset_id: assetId,
            quantity: qty,
          },
        ]);

        if (insertError) {
          console.error("Failed to add owned asset:", insertError);
          alert(`Failed while adding ${asset.name}.`);
          setLoading(false);
          return;
        }
      }
    }

    const { error: logError } = await supabase.from("token_transactions").insert([
      {
        platoon_id: selected.id,
        action: "BUY_ASSET",
        amount: totalCost,
        created_at: new Date().toISOString(),
      },
    ]);

    if (logError) {
      console.error("Failed to log transaction:", logError);
      alert("Purchase completed, but transaction logging failed.");
    }

    setCart({});
    await fetchPlatoons();
    await fetchOwnedAssets(selected.id);
    await fetchTransactions(selected.id);
    setLoading(false);
  };

  /* ================= DERIVED VALUES ================= */

  const cartTotal = useMemo(() => {
    return Object.entries(cart).reduce((sum, [assetId, qty]) => {
      const asset = assets.find((a) => a.id === assetId);
      return sum + (asset?.token_cost || 0) * qty;
    }, 0);
  }, [cart, assets]);

  const cartItemCount = useMemo(() => {
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  }, [cart]);

  const tokensAfterPurchase = selected ? selected.tokens - cartTotal : 0;

  const filteredAssets = useMemo(() => {
    const search = assetSearch.toLowerCase().trim();

    return assets.filter((asset) => {
      const nameMatch = asset.name.toLowerCase().includes(search);
      const descMatch = asset.description?.toLowerCase().includes(search);
      return nameMatch || !!descMatch;
    });
  }, [assets, assetSearch]);

  return (
    <div className="min-h-screen flex text-white bg-[radial-gradient(circle_at_center,#001f11_0%,#000000_100%)]">
      <div className="w-[300px] border-r border-[#00ff66]/30 p-6 space-y-4">
        <button
          onClick={() => router.push("/Galactic-Campaign")}
          className="px-4 py-2 border border-[#00ff66] text-[#00ff66] rounded-xl hover:bg-[#00ff66] hover:text-black transition"
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
                Cart ({cartItemCount})
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
                {!shopUnlocked ? (
                  <div className="space-y-4 max-w-sm">
                    <input
                      type="password"
                      placeholder="Enter shop password"
                      value={shopPassword}
                      onChange={(e) => setShopPassword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") unlockShop();
                      }}
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

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {filteredAssets.map((asset) => {
                        const qty = safeQuantity(buyQuantities[asset.id] || 1);
                        const inCart = cart[asset.id] || 0;
                        const exceedsStock = inCart + qty > asset.inventory;

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
                            {inCart > 0 && (
                              <div className="text-sm text-cyan-400">
                                In Cart: {inCart}
                              </div>
                            )}

                            <input
                              type="number"
                              min={1}
                              max={asset.inventory}
                              value={qty}
                              onChange={(e) =>
                                setBuyQuantities((prev) => ({
                                  ...prev,
                                  [asset.id]: safeQuantity(Number(e.target.value)),
                                }))
                              }
                              className="w-full bg-black border border-[#00ff66]/30 rounded-lg px-2 py-1"
                            />

                            <button
                              onClick={() => {
                                if (asset.inventory <= 0) {
                                  alert("This item is out of stock.");
                                  return;
                                }

                                const nextQty = (cart[asset.id] || 0) + qty;

                                if (nextQty > asset.inventory) {
                                  alert("Cannot add more than available stock.");
                                  return;
                                }

                                setCart((prev) => ({
                                  ...prev,
                                  [asset.id]: nextQty,
                                }));

                                setBuyQuantities((prev) => ({
                                  ...prev,
                                  [asset.id]: 1,
                                }));
                              }}
                              disabled={asset.inventory <= 0 || exceedsStock}
                              className={`w-full px-4 py-2 border rounded-lg transition ${
                                asset.inventory <= 0 || exceedsStock
                                  ? "border-red-500 text-red-400 cursor-not-allowed"
                                  : "border-[#00ff66] hover:bg-[#00ff66] hover:text-black"
                              }`}
                            >
                              {asset.inventory <= 0
                                ? "Out of Stock"
                                : exceedsStock
                                ? "Exceeds Stock"
                                : "Add to Cart"}
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

                      <div
                        className={`text-sm ${
                          tokensAfterPurchase < 0 ? "text-red-400" : "text-gray-400"
                        }`}
                      >
                        Tokens After Purchase: {tokensAfterPurchase}
                      </div>
                    </div>

                    <button
                      onClick={checkoutCart}
                      disabled={tokensAfterPurchase < 0 || loading}
                      className={`mt-4 w-full px-4 py-2 border rounded-lg transition ${
                        tokensAfterPurchase < 0 || loading
                          ? "border-red-500 text-red-400 cursor-not-allowed"
                          : "border-[#00ff66] hover:bg-[#00ff66] hover:text-black"
                      }`}
                    >
                      {loading ? "Processing..." : "Buy"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "owned" && (
              <div className="rounded-2xl border border-[#00ff66]/30 bg-black/50 overflow-hidden p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {ownedAssets.length === 0 ? (
                  <div className="text-gray-400">No assets owned.</div>
                ) : (
                  ownedAssets.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl border border-[#00ff66]/30 bg-black/40 hover:border-[#00ff66]/60 transition space-y-2"
                    >
                      <div className="font-medium text-[#00ff66]">
                        {item.asset?.name || "Unknown Asset"}
                      </div>

                      <div className="text-sm text-gray-300">
                        Quantity:
                        <span className="ml-2 font-bold text-white">
                          {item.quantity}
                        </span>
                      </div>

                      <div className="text-sm text-gray-300">
                        Value:
                        <span className="ml-2 font-bold text-cyan-400">
                          {(item.asset?.token_cost || 0) * item.quantity}
                        </span>
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