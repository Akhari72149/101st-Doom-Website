"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAppAuthHeaders, getAppSession, hasAppPermission } from "@/lib/client-auth";

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
  quantity?: number;
  asset_id?: string | null;
  asset_name?: string | null;
  performed_by?: string | null;
  notes?: string | null;
  created_at: string;
};

type OwnedAsset = {
  id: string;
  quantity: number;
  asset: {
    id: string;
    name: string;
    token_cost: number;
    description?: string | null;
    inventory?: number | null;
    category?: string | null;
  } | null;
};

export default function GCLogisticsHub() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [platoons, setPlatoons] = useState<Platoon[]>([]);
  const [activeTab, setActiveTab] = useState<"shop" | "cart" | "owned">("shop");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [ownedAssets, setOwnedAssets] = useState<OwnedAsset[]>([]);
  const [selected, setSelected] = useState<Platoon | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState(0);
  const [assetSearch, setAssetSearch] = useState("");
  const [stats, setStats] = useState({
    totalAssets: 0,
    totalAssetValue: 0,
    tokensSpent: 0,
  });
  const [cart, setCart] = useState<Record<string, number>>({});
  const [buyQuantities, setBuyQuantities] = useState<Record<string, number>>({});
  const [removeQuantities, setRemoveQuantities] = useState<Record<string, number>>({});

  const clampPositiveInt = (value: number, fallback = 1) => {
    if (!Number.isFinite(value)) return fallback;
    const parsed = Math.floor(value);
    if (parsed < 1) return fallback;
    return parsed;
  };

  const formatDateTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const getTransactionColor = (action: string) => {
    if (action === "ADD_TOKENS") return "text-[#00ff66]";
    if (action === "BUY_ASSET") return "text-cyan-400";
    if (action === "REMOVE_ASSET") return "text-red-400";
    return "text-white";
  };

  /* ================= AUTH ================= */

  useEffect(() => {
    const checkAccess = async () => {
      setErrorMessage("");

      const session = await getAppSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      const hasAccess = session.roles.some((role) => ["akhari", "logistics"].includes(role.toLowerCase())) ||
        hasAppPermission(session, "gc.logistics", "read");

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

  /* ================= FETCH DATA ================= */

  const fetchPlatoons = async () => {
    const response = await fetch("/api/gc-logistics", { cache:"no-store", headers:await getAppAuthHeaders() });
    if (!response.ok) {
      setErrorMessage("Failed to load platoons.");
      return;
    }
    const data=await response.json() as {platoons?:Platoon[]};setPlatoons(data.platoons||[]);
  };

  const fetchAssets = async (platoonId: string) => {
    if (!platoonId) return;

    const response=await fetch(`/api/gc-logistics?platoonId=${encodeURIComponent(platoonId)}`,{cache:"no-store",headers:await getAppAuthHeaders()});
    if(!response.ok){
      setErrorMessage("Failed to load asset shop.");
      return;
    }
    const data=await response.json() as {assets?:Asset[]};setAssets(data.assets||[]);
  };

  const fetchTransactions = async (platoonId: string) => {
    const response=await fetch(`/api/gc-logistics?platoonId=${encodeURIComponent(platoonId)}`,{cache:"no-store",headers:await getAppAuthHeaders()});
    if(!response.ok){
      setErrorMessage("Failed to load transactions.");
      return;
    }
    const data=await response.json() as {transactions?:Transaction[]};setTransactions(data.transactions||[]);
  };

const fetchOwnedAssets = async (platoonId: string) => {
  const response=await fetch(`/api/gc-logistics?platoonId=${encodeURIComponent(platoonId)}`,{cache:"no-store",headers:await getAppAuthHeaders()});
  if(!response.ok){
    setErrorMessage("Failed to load owned assets.");
    return;
  }
  const data=await response.json() as {ownedAssets?:OwnedAsset[]};setOwnedAssets(data.ownedAssets||[]);
};

  const loadPlatoonData = async (platoonId: string) => {
    setLoadingData(true);
    setErrorMessage("");

    await Promise.all([
      fetchTransactions(platoonId),
      fetchOwnedAssets(platoonId),
      fetchAssets(platoonId),
    ]);

    setLoadingData(false);
  };

  useEffect(() => {
    if (!loadingAuth) {
      fetchPlatoons();
    }
  }, [loadingAuth]);

  /* ================= SELECT PLATOON ================= */

  const selectPlatoon = async (p: Platoon) => {
    setCart({});
    setBuyQuantities({});
    setRemoveQuantities({});
    setAssetSearch("");
    setSelected(p);
    await loadPlatoonData(p.id);
  };

  /* ================= ADD TOKENS ================= */

  const addTokens = async () => {
    if (!selected || processingAction) return;

    const validAmount = clampPositiveInt(amount, 0);

    if (validAmount <= 0) {
      setErrorMessage("Enter a valid token amount greater than 0.");
      return;
    }

    setProcessingAction(true);
    setErrorMessage("");

    const response=await fetch("/api/gc-logistics",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json",...(await getAppAuthHeaders())},body:JSON.stringify({action:"addTokens",platoonId:selected.id,amount:validAmount})});
    if(!response.ok){
      setProcessingAction(false);
      setErrorMessage("Failed to add tokens.");
      return;
    }

    setAmount(0);
    await fetchPlatoons();
    await fetchTransactions(selected.id);
    setProcessingAction(false);
  };

  /* ================= CART ================= */

  const addToCart = (asset: Asset) => {
    const qty = clampPositiveInt(buyQuantities[asset.id] || 1, 1);

    if (qty < 1) {
      setErrorMessage("Quantity must be at least 1.");
      return;
    }

    if (asset.inventory > 0 && qty > asset.inventory) {
      setErrorMessage(`Cannot add more than available stock for ${asset.name}.`);
      return;
    }

    setErrorMessage("");

    setCart((prev) => {
      const nextQty = (prev[asset.id] || 0) + qty;

      if (asset.inventory > 0 && nextQty > asset.inventory) {
        setErrorMessage(`Cart total exceeds stock for ${asset.name}.`);
        return prev;
      }

      return {
        ...prev,
        [asset.id]: nextQty,
      };
    });

    setBuyQuantities((prev) => ({
      ...prev,
      [asset.id]: 1,
    }));
  };

  const updateCartQuantity = (assetId: string, nextQty: number) => {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;

    const validQty = Math.max(0, Math.floor(nextQty || 0));

    if (validQty === 0) {
      setCart((prev) => {
        const updated = { ...prev };
        delete updated[assetId];
        return updated;
      });
      return;
    }

    if (asset.inventory > 0 && validQty > asset.inventory) {
      setErrorMessage(`Cannot exceed stock for ${asset.name}.`);
      return;
    }

    setErrorMessage("");

    setCart((prev) => ({
      ...prev,
      [assetId]: validQty,
    }));
  };

  const cartItemCount = useMemo(() => {
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  }, [cart]);

  const cartTotal = useMemo(() => {
    return Object.entries(cart).reduce((sum, [assetId, qty]) => {
      const asset = assets.find((a) => a.id === assetId);
      return sum + (asset?.token_cost || 0) * qty;
    }, 0);
  }, [cart, assets]);

  const checkoutCart = async () => {
    if (!selected || processingAction) return;

    if (Object.keys(cart).length === 0) {
      setErrorMessage("Cart is empty.");
      return;
    }

    if (selected.tokens < cartTotal) {
      setErrorMessage("Not enough tokens to buy everything in the cart.");
      return;
    }

    for (const [assetId, qty] of Object.entries(cart)) {
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) continue;

      if (qty <= 0) {
        setErrorMessage("Cart contains an invalid quantity.");
        return;
      }

      if (asset.inventory > 0 && qty > asset.inventory) {
        setErrorMessage(`Requested quantity exceeds stock for ${asset.name}.`);
        return;
      }
    }

    setProcessingAction(true);
    setErrorMessage("");

    const response=await fetch("/api/gc-logistics",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json",...(await getAppAuthHeaders())},body:JSON.stringify({action:"checkout",platoonId:selected.id,items:Object.entries(cart).map(([assetId,quantity])=>({assetId,quantity}))})});
    if(!response.ok){
      setProcessingAction(false);
      const body=await response.json().catch(()=>null) as {error?:string}|null;setErrorMessage(body?.error||"Failed to complete checkout.");
      return;
    }

    setCart({});
    await fetchPlatoons();
    await loadPlatoonData(selected.id);
    setProcessingAction(false);
  };

  /* ================= REMOVE ASSET ================= */

  const removeAsset = async (owned: OwnedAsset) => {
    if (!selected || processingAction) return;

    const qtyToRemove = clampPositiveInt(removeQuantities[owned.id] || 1, 1);

    if (qtyToRemove > owned.quantity) {
      setErrorMessage("Cannot remove more than owned.");
      return;
    }

    setProcessingAction(true);
    setErrorMessage("");
    const response=await fetch("/api/gc-logistics",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json",...(await getAppAuthHeaders())},body:JSON.stringify({action:"removeAsset",platoonId:selected.id,ownedId:owned.id,quantity:qtyToRemove})});
    if(!response.ok){
      setProcessingAction(false);
      setErrorMessage("Failed to remove owned asset.");
      return;
    }

    setRemoveQuantities((prev) => ({
      ...prev,
      [owned.id]: 1,
    }));

    await fetchOwnedAssets(selected.id);
    await fetchTransactions(selected.id);
    setProcessingAction(false);
  };

  const filteredAssets = useMemo(() => {
    const search = assetSearch.trim().toLowerCase();

    if (!search) return assets;

    return assets.filter((asset) => {
      const nameMatch = asset.name.toLowerCase().includes(search);
      const descMatch = asset.description?.toLowerCase().includes(search);
      const categoryMatch = asset.category?.toLowerCase().includes(search);
      return nameMatch || descMatch || categoryMatch;
    });
  }, [assets, assetSearch]);

  const recentTransactions = transactions.slice(0, 5);

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#00ff66] bg-black">
        Checking Permissions...
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white bg-[radial-gradient(circle_at_center,#001f11_0%,#000000_100%)]">
      <div className="flex flex-col xl:flex-row">
        <div className="xl:w-[320px] xl:min-h-screen xl:sticky xl:top-0 border-r border-[#00ff66]/20 p-6 space-y-4 bg-black/30 backdrop-blur-sm">
          <button
            onClick={() => router.push("/Galactic-Campaign")}
            className="w-full px-4 py-2 border border-[#00ff66] text-[#00ff66] rounded-xl hover:bg-[#00ff66] hover:text-black transition"
          >
            ← Back
          </button>

          <button
            onClick={() => router.push("/GC-Asset-Log")}
            className="w-full px-4 py-2 border border-[#00ff66] text-[#00ff66] rounded-xl hover:bg-[#00ff66] hover:text-black transition"
          >
            View Transaction History
          </button>

          <div className="rounded-2xl border border-[#00ff66]/20 bg-black/40 p-4">
            <h2 className="text-[#00ff66] text-xl mb-3">Platoons</h2>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {platoons.map((p) => (
                <div
                  key={p.id}
                  onClick={() => selectPlatoon(p)}
                  className={`p-4 rounded-xl cursor-pointer transition ${
                    selected?.id === p.id
                      ? "bg-[#00ff66]/15 border border-[#00ff66] shadow-[0_0_20px_rgba(0,255,102,0.12)]"
                      : "border border-[#00ff66]/20 hover:border-[#00ff66]/60 hover:bg-[#00ff66]/5"
                  }`}
                >
                  <div className="font-bold">{p.name}</div>
                  <div className="text-sm text-gray-300 mt-1">Tokens: {p.tokens}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 md:p-10 space-y-8">
          {!selected ? (
            <div className="rounded-2xl border border-[#00ff66]/20 bg-black/40 p-10 text-gray-400">
              Select a platoon to open logistics management.
            </div>
          ) : (
            <>
              {errorMessage && (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 text-red-300 px-5 py-4">
                  {errorMessage}
                </div>
              )}

              <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
                <div className="space-y-6">
                  <div className="p-6 rounded-2xl border border-[#00ff66]/30 bg-black/50">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                      <div>
                        <div className="text-sm uppercase tracking-[0.25em] text-gray-400 mb-2">
                          Logistics Command
                        </div>
                        <h2 className="text-3xl text-[#00ff66] font-bold">
                          {selected.name}
                        </h2>
                        <div className="mt-4 text-lg">
                          Available Tokens:
                          <span className="ml-2 text-[#00ff66] font-bold text-2xl">
                            {selected.tokens}
                          </span>
                        </div>
                      </div>

                      <div className="min-w-[260px] rounded-2xl border border-[#00ff66]/20 bg-black/40 p-4">
                        <div className="text-sm text-gray-400 mb-3">Add Tokens</div>
                        <div className="flex gap-3">
                          <input
                            type="number"
                            min={1}
                            value={amount}
                            onChange={(e) =>
                              setAmount(clampPositiveInt(Number(e.target.value), 0))
                            }
                            className="flex-1 bg-black border border-[#00ff66]/30 rounded-xl px-4 py-2 outline-none focus:border-[#00ff66]"
                          />
                          <button
                            onClick={addTokens}
                            disabled={processingAction}
                            className="px-5 py-2 border border-[#00ff66] rounded-xl hover:bg-[#00ff66] hover:text-black transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processingAction ? "Working..." : "Add"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <div className="p-5 rounded-2xl border border-[#00ff66]/30 bg-black/50">
                      <div className="text-gray-400 text-sm">Total Assets Owned</div>
                      <div className="text-2xl text-[#00ff66] font-bold mt-2">
                        {stats.totalAssets}
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl border border-[#00ff66]/30 bg-black/50">
                      <div className="text-gray-400 text-sm">Total Asset Value</div>
                      <div className="text-2xl text-[#00ff66] font-bold mt-2">
                        {stats.totalAssetValue}
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl border border-[#00ff66]/30 bg-black/50">
                      <div className="text-gray-400 text-sm">Tokens Spent</div>
                      <div className="text-2xl text-red-400 font-bold mt-2">
                        {stats.tokensSpent}
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl border border-[#00ff66]/30 bg-black/50">
                      <div className="text-gray-400 text-sm">Cart Value</div>
                      <div
                        className={`text-2xl font-bold mt-2 ${
                          cartTotal > selected.tokens ? "text-red-400" : "text-cyan-400"
                        }`}
                      >
                        {cartTotal}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#00ff66]/30 bg-black/50 p-4">
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => setActiveTab("shop")}
                        className={`px-4 py-2 rounded-xl border transition ${
                          activeTab === "shop"
                            ? "border-[#00ff66] bg-[#00ff66]/20 text-[#00ff66]"
                            : "border-[#00ff66]/20 hover:border-[#00ff66]/60"
                        }`}
                      >
                        Asset Shop
                      </button>

                      <button
                        onClick={() => setActiveTab("cart")}
                        className={`px-4 py-2 rounded-xl border transition ${
                          activeTab === "cart"
                            ? "border-[#00ff66] bg-[#00ff66]/20 text-[#00ff66]"
                            : "border-[#00ff66]/20 hover:border-[#00ff66]/60"
                        }`}
                      >
                        Cart ({cartItemCount})
                      </button>

                      <button
                        onClick={() => setActiveTab("owned")}
                        className={`px-4 py-2 rounded-xl border transition ${
                          activeTab === "owned"
                            ? "border-[#00ff66] bg-[#00ff66]/20 text-[#00ff66]"
                            : "border-[#00ff66]/20 hover:border-[#00ff66]/60"
                        }`}
                      >
                        Owned Assets
                      </button>
                    </div>
                  </div>

                  {activeTab === "shop" && (
                    <div className="rounded-2xl border border-[#00ff66]/30 bg-black/50 overflow-hidden p-6">
                      <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between mb-5">
                        <input
                          type="text"
                          placeholder="Search by name, description, or category..."
                          value={assetSearch}
                          onChange={(e) => setAssetSearch(e.target.value)}
                          className="w-full lg:max-w-xl bg-black border border-[#00ff66]/30 rounded-xl px-4 py-3 outline-none focus:border-[#00ff66]"
                        />

                        <div className="text-sm text-gray-400">
                          {filteredAssets.length} asset{filteredAssets.length === 1 ? "" : "s"} found
                        </div>
                      </div>

                      {loadingData ? (
                        <div className="text-gray-400">Loading shop...</div>
                      ) : filteredAssets.length === 0 ? (
                        <div className="text-gray-400">No matching assets found.</div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                          {filteredAssets.map((asset) => {
                            const qty = clampPositiveInt(buyQuantities[asset.id] || 1, 1);
                            const cartQty = cart[asset.id] || 0;
                            const subtotal = asset.token_cost * qty;
                            const stockExceeded =
                              asset.inventory > 0 && cartQty + qty > asset.inventory;

                            return (
                              <div
                                key={asset.id}
                                className="p-5 rounded-2xl border border-[#00ff66]/20 bg-black/50 space-y-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="font-bold text-[#00ff66] leading-tight">
                                    {asset.name}
                                  </div>
                                  {asset.category && (
                                    <div className="text-[11px] uppercase tracking-wider text-cyan-300 border border-cyan-400/30 rounded-full px-2 py-1 whitespace-nowrap">
                                      {asset.category}
                                    </div>
                                  )}
                                </div>

                                {asset.description && (
                                  <div className="text-sm text-gray-400 border border-[#00ff66]/10 rounded-xl p-3 bg-black/30 min-h-[72px]">
                                    {asset.description}
                                  </div>
                                )}

                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div className="rounded-xl border border-[#00ff66]/10 p-3 bg-black/30">
                                    <div className="text-gray-400">Cost</div>
                                    <div className="text-[#00ff66] font-bold mt-1">
                                      {asset.token_cost}
                                    </div>
                                  </div>
                                  <div className="rounded-xl border border-[#00ff66]/10 p-3 bg-black/30">
                                    <div className="text-gray-400">Stock</div>
                                    <div
                                      className={`font-bold mt-1 ${
                                        asset.inventory <= 0
                                          ? "text-red-400"
                                          : asset.inventory <= 3
                                          ? "text-yellow-400"
                                          : "text-cyan-400"
                                      }`}
                                    >
                                      {asset.inventory}
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <label className="text-sm text-gray-400">Quantity</label>
                                  <input
                                    type="number"
                                    min={1}
                                    max={asset.inventory > 0 ? asset.inventory : undefined}
                                    value={qty}
                                    onChange={(e) =>
                                      setBuyQuantities((prev) => ({
                                        ...prev,
                                        [asset.id]: clampPositiveInt(Number(e.target.value), 1),
                                      }))
                                    }
                                    className="w-full bg-black border border-[#00ff66]/30 rounded-lg px-3 py-2 outline-none focus:border-[#00ff66]"
                                  />
                                </div>

                                <div className="text-sm text-gray-400">
                                  Subtotal:{" "}
                                  <span className="text-white font-semibold">{subtotal}</span> tokens
                                </div>

                                {cartQty > 0 && (
                                  <div className="text-sm text-cyan-400">
                                    In cart: {cartQty}
                                  </div>
                                )}

                                <button
                                  onClick={() => addToCart(asset)}
                                  disabled={processingAction || asset.inventory <= 0 || stockExceeded}
                                  className="w-full px-4 py-2 border border-[#00ff66] rounded-lg hover:bg-[#00ff66] hover:text-black transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {asset.inventory <= 0
                                    ? "Out of Stock"
                                    : stockExceeded
                                    ? "Exceeds Stock"
                                    : "Add to Cart"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "cart" && (
                    <div className="rounded-2xl border border-[#00ff66]/30 bg-black/50 overflow-hidden p-6">
                      <h3 className="text-xl text-[#00ff66] mb-4">Cart</h3>

                      {Object.keys(cart).length === 0 ? (
                        <div className="text-gray-400">No requisitions queued.</div>
                      ) : (
                        <div className="space-y-4">
                          {Object.entries(cart).map(([assetId, qty]) => {
                            const asset = assets.find((a) => a.id === assetId);
                            if (!asset) return null;

                            return (
                              <div
                                key={assetId}
                                className="rounded-xl border border-[#00ff66]/20 p-4 bg-black/30"
                              >
                                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                                  <div className="space-y-1">
                                    <div className="font-semibold text-[#00ff66]">
                                      {asset.name}
                                    </div>
                                    {asset.description && (
                                      <div className="text-sm text-gray-400 max-w-3xl">
                                        {asset.description}
                                      </div>
                                    )}
                                    <div className="text-sm text-gray-300">
                                      {asset.token_cost} tokens each
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-3">
                                    <input
                                      type="number"
                                      min={1}
                                      max={asset.inventory > 0 ? asset.inventory : undefined}
                                      value={qty}
                                      onChange={(e) =>
                                        updateCartQuantity(
                                          assetId,
                                          Number(e.target.value)
                                        )
                                      }
                                      className="w-24 bg-black border border-[#00ff66]/30 rounded-lg px-3 py-2 outline-none focus:border-[#00ff66]"
                                    />

                                    <div className="min-w-[140px] text-right font-bold text-cyan-400">
                                      {asset.token_cost * qty} tokens
                                    </div>

                                    <button
                                      onClick={() =>
                                        setCart((prev) => {
                                          const newCart = { ...prev };
                                          delete newCart[assetId];
                                          return newCart;
                                        })
                                      }
                                      className="px-3 py-2 border border-red-500 text-red-400 rounded-lg hover:bg-red-500 hover:text-black transition"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          <div className="rounded-xl border border-[#00ff66]/20 bg-black/30 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="space-y-1">
                              <div className="text-gray-400 text-sm">Total Cost</div>
                              <div
                                className={`text-2xl font-bold ${
                                  cartTotal > selected.tokens ? "text-red-400" : "text-[#00ff66]"
                                }`}
                              >
                                {cartTotal} tokens
                              </div>
                              <div className="text-sm text-gray-400">
                                Available: {selected.tokens} tokens
                              </div>
                            </div>

                            <button
                              onClick={checkoutCart}
                              disabled={processingAction || cartTotal > selected.tokens}
                              className="px-6 py-3 border border-[#00ff66] rounded-xl hover:bg-[#00ff66] hover:text-black transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {processingAction ? "Processing..." : "Checkout"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "owned" && (
                    <div className="rounded-2xl border border-[#00ff66]/30 bg-black/50 overflow-hidden p-6">
                      {loadingData ? (
                        <div className="text-gray-400">Loading owned assets...</div>
                      ) : ownedAssets.length === 0 ? (
                        <div className="text-gray-400">No assets recorded for this platoon.</div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                          {ownedAssets.map((item) => {
                            const removeQty = clampPositiveInt(removeQuantities[item.id] || 1, 1);

                            return (
                              <div
                                key={item.id}
                                className="p-4 rounded-xl border border-[#00ff66]/30 bg-black/30 space-y-3"
                              >
                                <div className="font-bold text-[#00ff66]">
                                  {item.asset?.name || "Unknown Asset"}
                                </div>

                                {item.asset?.description && (
                                  <div className="text-sm text-gray-400">
                                    {item.asset.description}
                                  </div>
                                )}

                                <div className="text-sm">
                                  Quantity:{" "}
                                  <span className="text-white font-semibold">
                                    {item.quantity}
                                  </span>
                                </div>

                                <div className="text-sm">
                                  Asset Value:{" "}
                                  <span className="text-cyan-400 font-semibold">
                                    {(item.asset?.token_cost || 0) * item.quantity}
                                  </span>
                                </div>

                                <input
                                  type="number"
                                  min={1}
                                  max={item.quantity}
                                  value={removeQty}
                                  onChange={(e) =>
                                    setRemoveQuantities((prev) => ({
                                      ...prev,
                                      [item.id]: Math.min(
                                        clampPositiveInt(Number(e.target.value), 1),
                                        item.quantity
                                      ),
                                    }))
                                  }
                                  className="w-full bg-black border border-[#00ff66]/30 rounded-lg px-3 py-2 outline-none focus:border-[#00ff66]"
                                />

                                <button
                                  onClick={() => removeAsset(item)}
                                  disabled={processingAction}
                                  className="w-full px-4 py-2 border border-red-500 text-red-400 rounded-lg hover:bg-red-500 hover:text-black transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {processingAction ? "Working..." : "Remove"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="rounded-2xl border border-[#00ff66]/30 bg-black/50 p-5">
                    <div className="text-sm uppercase tracking-[0.2em] text-gray-400 mb-3">
                      Command Summary
                    </div>

                    <div className="space-y-4 text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-400">Selected Platoon</span>
                        <span className="text-white font-semibold text-right">
                          {selected.name}
                        </span>
                      </div>

                      <div className="flex justify-between gap-4">
                        <span className="text-gray-400">Available Tokens</span>
                        <span className="text-[#00ff66] font-bold">
                          {selected.tokens}
                        </span>
                      </div>

                      <div className="flex justify-between gap-4">
                        <span className="text-gray-400">Assets Owned</span>
                        <span className="text-white font-semibold">
                          {stats.totalAssets}
                        </span>
                      </div>

                      <div className="flex justify-between gap-4">
                        <span className="text-gray-400">Cart Items</span>
                        <span className="text-white font-semibold">
                          {cartItemCount}
                        </span>
                      </div>

                      <div className="flex justify-between gap-4">
                        <span className="text-gray-400">Cart Total</span>
                        <span
                          className={`font-bold ${
                            cartTotal > selected.tokens ? "text-red-400" : "text-cyan-400"
                          }`}
                        >
                          {cartTotal}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-[#00ff66]/10">
                        <div className="text-gray-400 mb-2">Status</div>
                        <div
                          className={`font-semibold ${
                            loadingData || processingAction
                              ? "text-yellow-400"
                              : "text-[#00ff66]"
                          }`}
                        >
                          {loadingData
                            ? "Loading platoon data..."
                            : processingAction
                            ? "Processing action..."
                            : "Ready"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#00ff66]/30 bg-black/50 p-5">
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div className="text-sm uppercase tracking-[0.2em] text-gray-400">
                        Recent Activity
                      </div>
                      <button
                        onClick={() => router.push("/GC-Asset-Log")}
                        className="text-xs text-cyan-400 hover:text-cyan-300 transition"
                      >
                        Open Full Log
                      </button>
                    </div>

                    {recentTransactions.length === 0 ? (
                      <div className="text-gray-400 text-sm">
                        No recent transactions recorded.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {recentTransactions.map((tx) => (
                          <div
                            key={tx.id}
                            className="rounded-xl border border-[#00ff66]/15 bg-black/30 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className={`font-semibold ${getTransactionColor(tx.action)}`}>
                                {tx.action.replaceAll("_", " ")}
                              </div>
                              <div className="text-xs text-gray-500 text-right">
                                {formatDateTime(tx.created_at)}
                              </div>
                            </div>

                            {tx.notes && (
                              <div className="text-sm text-gray-300 mt-2 leading-relaxed">
                                {tx.notes}
                              </div>
                            )}

                            <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-3">
                              {typeof tx.quantity === "number" && (
                                <div>Qty: {tx.quantity}</div>
                              )}
                              <div>Amount: {tx.amount}</div>
                              {tx.asset_name && <div>Asset: {tx.asset_name}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
