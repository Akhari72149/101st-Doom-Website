"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Commander = {
  id: string;
  name: string;
  tokens: number;
};

type Asset = {
  id: string;
  name: string;
  token_cost: number;
  inventory: number;
  category: string; // <-- added category
};

export default function CISLogisticsHub() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [commander, setCommander] = useState<Commander | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [ownedAssets, setOwnedAssets] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"shop" | "cart" | "owned">("shop");

  const [cart, setCart] = useState<Record<string, number>>({});
  const [buyQuantities, setBuyQuantities] = useState<Record<string, number>>({});
  const [removeQuantities, setRemoveQuantities] = useState<Record<string, number>>({});
  const [assetSearch, setAssetSearch] = useState("");
  const [category, setCategory] = useState<"offensive" | "defensive" | "unit">("offensive"); // <-- category state

  const [amount, setAmount] = useState(0);

  const [stats, setStats] = useState({
    totalAssets: 0,
    totalAssetValue: 0,
    tokensSpent: 0,
  });

  /* ================= AUTH ================= */

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const roles = data?.map((r) => r.role) || [];

      if (!roles.includes("Akhari") && !roles.includes("logistics")) {
        router.replace("/Galactic-Campaign");
        return;
      }

      setLoadingAuth(false);
    };

    checkAccess();
  }, [router]);

  /* ================= FETCH DATA ================= */

  const fetchCommander = async () => {
    const { data } = await supabase
      .from("cis_commander")
      .select("*")
      .single();

    setCommander(data);
  };

  const fetchAssets = async () => {
    const { data } = await supabase
      .from("cis_assets")
      .select("*");

    setAssets(data || []);
  };

  const fetchOwnedAssets = async () => {
    const { data } = await supabase
      .from("cis_commander_assets")
      .select(`
        id,
        quantity,
        asset:asset_id (
          id,
          name,
          token_cost
        )
      `);

    setOwnedAssets(data || []);
  };

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from("cis_transactions")
      .select("*")
      .order("created_at", { ascending: false });

    setTransactions(data || []);
  };

  useEffect(() => {
    if (!loadingAuth) {
      fetchCommander();
      fetchAssets();
      fetchOwnedAssets();
      fetchTransactions();
    }
  }, [loadingAuth]);

  /* ================= STATS ================= */

  useEffect(() => {
    const totalAssets = ownedAssets.reduce((sum, a) => sum + a.quantity, 0);

    const totalValue = ownedAssets.reduce((sum, a) => {
      return sum + a.quantity * (a.asset?.token_cost || 0);
    }, 0);

    const tokensSpent = transactions
      .filter((t) => t.action === "BUY_ASSET")
      .reduce((sum, t) => sum + t.amount, 0);

    setStats({
      totalAssets,
      totalAssetValue: totalValue,
      tokensSpent,
    });
  }, [ownedAssets, transactions]);

  /* ================= TOKENS ================= */

  const addTokens = async () => {
    if (!commander || amount <= 0) return;

    await supabase
      .from("cis_commander")
      .update({ tokens: commander.tokens + amount })
      .eq("id", commander.id);

    await supabase.from("cis_transactions").insert([
      {
        action: "ADD_TOKENS",
        amount,
        created_at: new Date().toISOString(),
      },
    ]);

    setAmount(0);

    fetchCommander();
    fetchTransactions();
  };

  /* ================= CART CHECKOUT ================= */

  const checkoutCart = async () => {
    if (!commander) return;

    const totalCost = Object.entries(cart).reduce((sum, [assetId, qty]) => {
      const asset = assets.find((a) => a.id === assetId);
      return sum + (asset?.token_cost || 0) * qty;
    }, 0);

    if (commander.tokens < totalCost) {
      alert("Not enough tokens.");
      return;
    }

    await supabase
      .from("cis_commander")
      .update({ tokens: commander.tokens - totalCost })
      .eq("id", commander.id);

    for (const [assetId, qty] of Object.entries(cart)) {
      const existing = ownedAssets.find((o) => o.asset?.id === assetId);

      if (existing) {
        await supabase
          .from("cis_commander_assets")
          .update({ quantity: existing.quantity + qty })
          .eq("id", existing.id);
      } else {
        await supabase.from("cis_commander_assets").insert([
          {
            asset_id: assetId,
            quantity: qty,
          },
        ]);
      }
    }

    await supabase.from("cis_transactions").insert([
      {
        action: "BUY_ASSET",
        amount: totalCost,
        created_at: new Date().toISOString(),
      },
    ]);

    setCart({});
    fetchCommander();
    fetchOwnedAssets();
    fetchTransactions();
  };

  /* ================= REMOVE ASSET ================= */

  const removeAsset = async (owned: any) => {
    const qty = removeQuantities[owned.id] || 1;

    const newQty = owned.quantity - qty;

    if (newQty > 0) {
      await supabase
        .from("cis_commander_assets")
        .update({ quantity: newQty })
        .eq("id", owned.id);
    } else {
      await supabase
        .from("cis_commander_assets")
        .delete()
        .eq("id", owned.id);
    }

    fetchOwnedAssets();
  };

  /* ================= FILTERED ASSETS ================= */

  const filteredAssets = assets.filter((a) =>
    a.category === category &&
    a.name.toLowerCase().includes(assetSearch.toLowerCase())
  );

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500 bg-black">
        Checking Permissions...
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white bg-[radial-gradient(circle_at_center,#220000_0%,#000000_100%)] p-10">

      <button
        onClick={() => router.push("/Galactic-Campaign")}
        className="mb-8 px-4 py-2 border border-red-500 text-red-500"
      >
        ← Back
      </button>

      <h1 className="text-3xl text-red-500 mb-6">CIS Commander Logistics</h1>

      {commander && (
        <div className="mb-8 p-6 border border-red-500/40 rounded-xl bg-black/50">

          <div className="text-xl">
            Tokens:
            <span className="ml-2 text-red-500 font-bold">
              {commander.tokens}
            </span>
          </div>

          <div className="flex gap-4 mt-4">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="bg-black border border-red-500/40 px-3 py-2 rounded"
            />

            <button
              onClick={addTokens}
              className="px-5 py-2 border border-red-500 hover:bg-red-500 hover:text-black transition"
            >
              Add Tokens
            </button>
          </div>
        </div>
      )}

      {/* DASHBOARD */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="p-6 border border-red-500/40 rounded-xl">
          Total Assets: <span className="text-red-500">{stats.totalAssets}</span>
        </div>

        <div className="p-6 border border-red-500/40 rounded-xl">
          Total Value: <span className="text-red-500">{stats.totalAssetValue}</span>
        </div>

        <div className="p-6 border border-red-500/40 rounded-xl">
          Tokens Spent: <span className="text-red-400">{stats.tokensSpent}</span>
        </div>
      </div>

      {/* CATEGORY & TABS */}
      <div className="flex gap-4 mb-6">
        {/* Categories */}
        <button
          onClick={() => { setActiveTab("shop"); setCategory("offensive"); }}
          className="border border-red-500 px-4 py-2"
        >
          Offensive
        </button>

        <button
          onClick={() => { setActiveTab("shop"); setCategory("defensive"); }}
          className="border border-red-500 px-4 py-2"
        >
          Defensive
        </button>

        <button
          onClick={() => { setActiveTab("shop"); setCategory("unit"); }}
          className="border border-red-500 px-4 py-2"
        >
          Units
        </button>

        {/* Other Tabs */}
        <button
          onClick={() => setActiveTab("cart")}
          className="border border-red-500 px-4 py-2"
        >
          Cart ({Object.keys(cart).length})
        </button>

        

        <button
          onClick={() => setActiveTab("owned")}
          className="border border-red-500 px-4 py-2"
        >
          Owned
        </button>
      </div>

      {/* SHOP */}
      {activeTab === "shop" && (
        <div className="grid grid-cols-3 gap-4">

          {filteredAssets.map((asset) => {
            const qty = buyQuantities[asset.id] || 1;

            return (
              <div key={asset.id} className="p-5 border border-red-500/30 rounded-xl">

                <div className="text-red-500 font-bold">{asset.name}</div>
                <div>Cost: {asset.token_cost}</div>
                <div>Stock: {asset.inventory}</div>

                <input
                  type="number"
                  value={qty}
                  min={1}
                  onChange={(e) =>
                    setBuyQuantities({
                      ...buyQuantities,
                      [asset.id]: Number(e.target.value),
                    })
                  }
                  className="w-full bg-black border border-red-500/30 mt-2 px-2 py-1"
                />

                <button
                  onClick={() =>
                    setCart({
                      ...cart,
                      [asset.id]: (cart[asset.id] || 0) + qty,
                    })
                  }
                  className="w-full mt-3 border border-red-500 py-2 hover:bg-red-500 hover:text-black"
                >
                  Add to Cart
                </button>

              </div>
            );
          })}
        </div>
      )}

      {activeTab === "cart" && (
  <div className="grid grid-cols-1 gap-4">

    {Object.entries(cart).length === 0 && (
      <div className="p-6 border border-red-500/30 rounded-xl text-center">
        Your cart is empty.
      </div>
    )}

    {Object.entries(cart).map(([assetId, qty]) => {
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return null;

      return (
        <div key={assetId} className="p-5 border border-red-500/30 rounded-xl flex justify-between items-center">
          <div>
            <div className="text-red-500 font-bold">{asset.name}</div>
            <div>Cost: {asset.token_cost} × {qty} = {asset.token_cost * qty}</div>
          </div>

          <div className="flex gap-2 items-center">
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) =>
                setCart({
                  ...cart,
                  [assetId]: Number(e.target.value),
                })
              }
              className="w-20 bg-black border border-red-500/30 px-2 py-1 rounded"
            />
            <button
              onClick={() => {
                const newCart = { ...cart };
                delete newCart[assetId];
                setCart(newCart);
              }}
              className="px-3 py-1 border border-red-500 hover:bg-red-500 hover:text-black rounded"
            >
              Remove
            </button>
          </div>
        </div>
      );
    })}

    {Object.entries(cart).length > 0 && (
      <button
        onClick={checkoutCart}
        className="mt-4 px-6 py-3 border border-red-500 hover:bg-red-500 hover:text-black rounded"
      >
        Checkout
      </button>
    )}
  </div>
)}

{activeTab === "owned" && (
  <div className="grid grid-cols-1 gap-4">

    {ownedAssets.length === 0 && (
      <div className="p-6 border border-red-500/30 rounded-xl text-center">
        You don't own any assets yet.
      </div>
    )}

    {ownedAssets.map((owned) => {
      const qtyToRemove = removeQuantities[owned.id] || 1;

      return (
        <div key={owned.id} className="p-5 border border-red-500/30 rounded-xl flex justify-between items-center">
          <div>
            <div className="text-red-500 font-bold">{owned.asset?.name}</div>
            <div>Cost: {owned.asset?.token_cost}</div>
            <div>Quantity: {owned.quantity}</div>
            <div>Total Value: {(owned.asset?.token_cost || 0) * owned.quantity}</div>
          </div>

          <div className="flex gap-2 items-center">
            <input
              type="number"
              min={1}
              value={qtyToRemove}
              onChange={(e) =>
                setRemoveQuantities({
                  ...removeQuantities,
                  [owned.id]: Number(e.target.value),
                })
              }
              className="w-20 bg-black border border-red-500/30 px-2 py-1 rounded"
            />
            <button
              onClick={() => removeAsset(owned)}
              className="px-3 py-1 border border-red-500 hover:bg-red-500 hover:text-black rounded"
            >
              Remove
            </button>
          </div>
        </div>
      );
    })}
  </div>
)}
    </div>
  );
}