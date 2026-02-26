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
  const [amount, setAmount] = useState(0);
  const [assetSearch, setAssetSearch] = useState("");

  /* ✅ Per asset quantity */
  const [buyQuantities, setBuyQuantities] =
    useState<Record<string, number>>({});

  /* ✅ Per owned asset remove quantity */
  const [removeQuantities, setRemoveQuantities] =
    useState<Record<string, number>>({});

  const [shopOpen, setShopOpen] = useState(false);
  const [ownedOpen, setOwnedOpen] = useState(false);

  /* ================= AUTH ================= */

  useEffect(() => {
  const checkAccess = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // ❌ Not logged in
    if (!user) {
      router.replace("/login");
      return;
    }

    // Fetch roles
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const userRoles = data?.map((r) => r.role) || [];

    const hasAccess =
      userRoles.includes("admin") ||
      userRoles.includes("logistics");

    // ❌ Logged in but no permission
    if (!hasAccess) {
      router.replace("/GC-Platoon-Logi");
      return;
    }

    // ✅ Allowed
    setLoadingAuth(false);
  };

  checkAccess();
}, [router]);

  /* ================= FETCH DATA ================= */

  const fetchPlatoons = async () => {
    const { data } = await supabase
      .from("platoons")
      .select("*")
      .order("sort_order", { ascending: true });

    setPlatoons(data || []);
  };

  const fetchAssets = async () => {
    const { data } = await supabase.from("hq_assets").select("*");
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
      fetchAssets();
    }
  }, [loadingAuth]);

  /* ================= SELECT PLATOON ================= */

  const selectPlatoon = (p: Platoon) => {
    setSelected(p);
    fetchTransactions(p.id);
    fetchOwnedAssets(p.id);
  };

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
        created_at: new Date().toISOString(),
      },
    ]);

    setAmount(0);
    fetchPlatoons();
    fetchTransactions(selected.id);
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

  /* ================= REMOVE ASSET (WITH QUANTITY) ================= */

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
        created_at: new Date().toISOString(),
      },
    ]);

    setRemoveQuantities((prev) => ({
      ...prev,
      [owned.id]: 1,
    }));

    await fetchOwnedAssets(selected.id);
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

      {/* ================= LEFT ================= */}

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

      {/* ================= CENTER ================= */}

      <div className="flex-1 p-10 space-y-10">

        {!selected ? (
          <div className="text-gray-400">Select a platoon.</div>
        ) : (
          <>
            {/* TOKEN BOX */}
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

              <div className="mt-6 flex gap-4">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) =>
                    setAmount(Number(e.target.value))
                  }
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

            {/* ================= SHOP (RESTORED) ================= */}

            <div className="rounded-2xl border border-[#00ff66]/30 bg-black/50 overflow-hidden">
              <div
                onClick={() => setShopOpen(!shopOpen)}
                className="p-6 flex justify-between cursor-pointer hover:bg-[#00ff66]/10"
              >
                <h3 className="text-xl text-[#00ff66]">
                  Asset Shop
                </h3>
                <span>{shopOpen ? "▲" : "▼"}</span>
              </div>

              {shopOpen && (
                <div className="p-6 border-t border-[#00ff66]/30">
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
                      const qty = buyQuantities[asset.id] || 1;

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
                                [asset.id]: Number(e.target.value),
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
                </div>
              )}
            </div>

            {/* ================= OWNED (WITH QUANTITY REMOVE) ================= */}

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
                    ownedAssets.map((item) => {
                      const removeQty =
                        removeQuantities[item.id] || 1;

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
            </div>

          </>
        )}
      </div>
    </div>
  );
}