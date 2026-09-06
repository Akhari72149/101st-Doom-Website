"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAppAuthHeaders, getAppSession, hasAppPermission } from "@/lib/client-auth";

type TransactionRow = {
  id: string;
  action: string;
  amount: number;
  quantity?: number | null;
  asset_name?: string | null;
  performed_by?: string | null;
  notes?: string | null;
  created_at: string;
  platoon_id: string;
  platoon?: {
    name: string;
  } | null;
  profile?: {
    display_name: string;
  } | null;
  description: string;
};

type FilterType = "all" | "tokens" | "purchased" | "removed";

type GroupedTransactions = {
  label: string;
  items: TransactionRow[];
};

export default function GCLogisticsTransactionsPage() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const checkAccess = async () => {
      const session = await getAppSession();

      if (!mounted) return;

      if (!session) {
        router.replace("/login");
        return;
      }

      const hasAccess = session.roles.some((role) => ["akhari", "logistics", "admin"].includes(role.toLowerCase())) ||
        hasAppPermission(session, "gc.asset-log", "read");

      if (!hasAccess) {
        router.replace("/GC-Platoon-Logi");
        return;
      }

      setLoadingAuth(false);
    };

    checkAccess();

    return () => {
      mounted = false;
    };
  }, [router]);

  const buildDescription = (tx: {
    action: string;
    amount?: number | null;
    quantity?: number | null;
    asset_name?: string | null;
    notes?: string | null;
    platoon?: { name: string } | null;
    profile?: { display_name: string } | null;
  }) => {
    const actor = tx.profile?.display_name || "Unknown user";
    const platoonName = tx.platoon?.name || "Unknown platoon";

    if (tx.notes) return tx.notes;

    switch (tx.action) {
      case "ADD_TOKENS":
        return `${actor} added ${tx.amount ?? 0} tokens to ${platoonName}`;
      case "BUY_ASSET":
        return `${actor} bought ${tx.quantity ?? 0} x ${
          tx.asset_name || "asset"
        } for ${platoonName} for ${tx.amount ?? 0} tokens`;
      case "REMOVE_ASSET":
        return `${actor} removed ${tx.quantity ?? 0} x ${
          tx.asset_name || "asset"
        } from ${platoonName}`;
      default:
        return `${actor} performed ${tx.action} on ${platoonName}`;
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    setError(null);

    const response=await fetch("/api/gc-logistics?scope=transactions",{cache:"no-store",headers:await getAppAuthHeaders()});
    if(!response.ok){
      setTransactions([]);
      setError("Failed to load transactions.");
      setLoading(false);
      return;
    }

    const payload=await response.json() as {transactions?:any[]};
    const formatted: TransactionRow[] = (payload.transactions || []).map((tx: any) => {
      const platoon = Array.isArray(tx.platoon) ? tx.platoon[0] ?? null : tx.platoon;
      const profile = Array.isArray(tx.profile) ? tx.profile[0] ?? null : tx.profile;

      const formattedTx: TransactionRow = {
        id: tx.id,
        action: tx.action,
        amount: Number(tx.amount) || 0,
        quantity: tx.quantity,
        asset_name: tx.asset_name,
        performed_by: tx.performed_by,
        notes: tx.notes,
        created_at: tx.created_at,
        platoon_id: tx.platoon_id,
        platoon,
        profile,
        description: "",
      };

      formattedTx.description = buildDescription(formattedTx);

      return formattedTx;
    });

    setTransactions(formatted);
    setLoading(false);
  };

  useEffect(() => {
    if (loadingAuth) return;

    fetchTransactions();

    const interval = setInterval(() => {
      fetchTransactions();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadingAuth]);

  const getActionLabel = (tx: TransactionRow) => {
    switch (tx.action) {
      case "ADD_TOKENS":
        return "Added Tokens";
      case "BUY_ASSET":
        return "Purchased Asset";
      case "REMOVE_ASSET":
        return "Removed Asset";
      default:
        return tx.action;
    }
  };

  const getActionStyle = (action: string) => {
    switch (action) {
      case "REMOVE_ASSET":
        return "border-red-500 text-red-400 bg-red-500/10";
      case "BUY_ASSET":
        return "border-blue-500 text-blue-400 bg-blue-500/10";
      default:
        return "border-[#00ff66]/30 text-[#00ff66] bg-[#00ff66]/5";
    }
  };

  const getExpandedBorderStyle = (action: string) => {
    switch (action) {
      case "REMOVE_ASSET":
        return "border-l-4 border-red-500";
      case "BUY_ASSET":
        return "border-l-4 border-blue-500";
      default:
        return "border-l-4 border-[#00ff66]";
    }
  };

  const getCardBorderStyle = (action: string) => {
    switch (action) {
      case "REMOVE_ASSET":
        return "border-red-500/30";
      case "BUY_ASSET":
        return "border-blue-500/30";
      default:
        return "border-[#00ff66]/25";
    }
  };

  const getAmountTextStyle = (action: string) => {
    switch (action) {
      case "ADD_TOKENS":
        return "text-[#00ff66]";
      case "BUY_ASSET":
        return "text-blue-400";
      case "REMOVE_ASSET":
        return "text-red-400";
      default:
        return "text-gray-300";
    }
  };

  const escapeRegExp = (value: string) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  const renderHighlightedText = (
    text: string,
    query: string,
    variant: "green" | "red" | "blue" = "green"
  ) => {
    if (!query.trim()) return text;

    const regex = new RegExp(`(${escapeRegExp(query.trim())})`, "ig");
    const parts = text.split(regex);

    return parts.map((part, index) => {
      const isMatch = part.toLowerCase() === query.trim().toLowerCase();

      if (!isMatch) return <span key={index}>{part}</span>;

      return (
        <mark
          key={index}
          className={
            variant === "red"
              ? "bg-red-500/20 text-red-300 px-1 rounded"
              : variant === "blue"
              ? "bg-blue-500/20 text-blue-300 px-1 rounded"
              : "bg-[#00ff66]/20 text-[#7dffb2] px-1 rounded"
          }
        >
          {part}
        </mark>
      );
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (seconds < 60) return "Just now";
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;

    return date.toLocaleDateString();
  };

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (filter === "tokens" && tx.action !== "ADD_TOKENS") return false;
      if (filter === "purchased" && tx.action !== "BUY_ASSET") return false;
      if (filter === "removed" && tx.action !== "REMOVE_ASSET") return false;

      const target = [
        tx.platoon?.name || "",
        tx.action || "",
        tx.asset_name || "",
        tx.profile?.display_name || "",
        tx.notes || "",
        tx.description,
      ]
        .join(" ")
        .toLowerCase();

      return target.includes(search.toLowerCase());
    });
  }, [transactions, filter, search]);

  const groupedTransactions = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const groups: GroupedTransactions[] = [
      { label: "Today", items: [] },
      { label: "Yesterday", items: [] },
      { label: "Last 7 Days", items: [] },
      { label: "This Month", items: [] },
      { label: "Older", items: [] },
    ];

    filteredTransactions.forEach((tx) => {
      const txDate = new Date(tx.created_at);

      if (txDate >= startOfToday) {
        groups[0].items.push(tx);
      } else if (txDate >= startOfYesterday && txDate < startOfToday) {
        groups[1].items.push(tx);
      } else if (txDate >= sevenDaysAgo && txDate < startOfYesterday) {
        groups[2].items.push(tx);
      } else if (txDate >= startOfMonth && txDate < sevenDaysAgo) {
        groups[3].items.push(tx);
      } else {
        groups[4].items.push(tx);
      }
    });

    return groups.filter((group) => group.items.length > 0);
  }, [filteredTransactions]);

  const stats = useMemo(() => {
    const totalTokensAdded = filteredTransactions
      .filter((tx) => tx.action === "ADD_TOKENS")
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const totalTokensSpent = filteredTransactions
      .filter((tx) => tx.action === "BUY_ASSET")
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const totalAssetsRemoved = filteredTransactions
      .filter((tx) => tx.action === "REMOVE_ASSET")
      .reduce((sum, tx) => sum + (Number(tx.quantity) || 0), 0);

    const today = new Date();
    const todayString = today.toDateString();

    const actionsToday = filteredTransactions.filter(
      (tx) => new Date(tx.created_at).toDateString() === todayString
    ).length;

    return {
      totalTokensAdded,
      totalTokensSpent,
      totalAssetsRemoved,
      actionsToday,
    };
  }, [filteredTransactions]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const allExpanded =
    filteredTransactions.length > 0 &&
    filteredTransactions.every((tx) => expandedRows[tx.id]);

  const toggleAllRows = () => {
    if (allExpanded) {
      setExpandedRows({});
      return;
    }

    const nextState: Record<string, boolean> = {};
    filteredTransactions.forEach((tx) => {
      nextState[tx.id] = true;
    });
    setExpandedRows(nextState);
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#00ff66] bg-black">
        Checking Permissions...
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white bg-[radial-gradient(circle_at_center,#001f11_0%,#000000_100%)] p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1650px] mx-auto">
        <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#00ff66]">
              Logistics Transaction History
            </h1>
            <p className="text-gray-400 mt-2 text-sm sm:text-base">
              Full audit trail of token additions, asset purchases, and removed assets
            </p>
          </div>

          <button
            onClick={() => router.push("/GC-Platoon-Logi")}
            className="px-4 py-2 border border-[#00ff66] text-[#00ff66] rounded-xl hover:bg-[#00ff66] hover:text-black transition"
          >
            ← Back
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <div className="rounded-2xl border border-[#00ff66]/25 bg-black/40 p-5 shadow-[0_0_20px_rgba(0,255,102,0.08)]">
            <p className="text-sm uppercase tracking-wide text-gray-400">
              Tokens Added
            </p>
            <p className="mt-2 text-3xl font-bold text-[#00ff66]">
              {stats.totalTokensAdded.toLocaleString()}
            </p>
          </div>

          <div className="rounded-2xl border border-blue-500/25 bg-black/40 p-5 shadow-[0_0_20px_rgba(59,130,246,0.08)]">
            <p className="text-sm uppercase tracking-wide text-gray-400">
              Tokens Spent
            </p>
            <p className="mt-2 text-3xl font-bold text-blue-400">
              {stats.totalTokensSpent.toLocaleString()}
            </p>
          </div>

          <div className="rounded-2xl border border-red-500/25 bg-black/40 p-5 shadow-[0_0_20px_rgba(239,68,68,0.08)]">
            <p className="text-sm uppercase tracking-wide text-gray-400">
              Assets Removed
            </p>
            <p className="mt-2 text-3xl font-bold text-red-400">
              {stats.totalAssetsRemoved.toLocaleString()}
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-500/25 bg-black/40 p-5 shadow-[0_0_20px_rgba(34,211,238,0.08)]">
            <p className="text-sm uppercase tracking-wide text-gray-400">
              Actions Today
            </p>
            <p className="mt-2 text-3xl font-bold text-cyan-400">
              {stats.actionsToday.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col xl:flex-row xl:items-center gap-4">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setFilter("all")}
                className={`px-4 py-2 rounded-xl border transition ${
                  filter === "all"
                    ? "border-[#00ff66] bg-[#00ff66]/15 text-[#00ff66] shadow-[0_0_18px_rgba(0,255,102,0.15)]"
                    : "border-[#00ff66]/20 bg-black/40 text-gray-300 hover:border-[#00ff66]/40 hover:text-white"
                }`}
              >
                All
              </button>

              <button
                onClick={() => setFilter("tokens")}
                className={`px-4 py-2 rounded-xl border transition ${
                  filter === "tokens"
                    ? "border-[#00ff66] bg-[#00ff66]/15 text-[#00ff66] shadow-[0_0_18px_rgba(0,255,102,0.15)]"
                    : "border-[#00ff66]/20 bg-black/40 text-gray-300 hover:border-[#00ff66]/40 hover:text-white"
                }`}
              >
                Tokens Added
              </button>

              <button
                onClick={() => setFilter("purchased")}
                className={`px-4 py-2 rounded-xl border transition ${
                  filter === "purchased"
                    ? "border-blue-500 bg-blue-500/10 text-blue-400 shadow-[0_0_18px_rgba(59,130,246,0.12)]"
                    : "border-[#00ff66]/20 bg-black/40 text-gray-300 hover:border-blue-500/40 hover:text-white"
                }`}
              >
                Assets Purchased
              </button>

              <button
                onClick={() => setFilter("removed")}
                className={`px-4 py-2 rounded-xl border transition ${
                  filter === "removed"
                    ? "border-red-500 bg-red-500/10 text-red-400 shadow-[0_0_18px_rgba(239,68,68,0.12)]"
                    : "border-[#00ff66]/20 bg-black/40 text-gray-300 hover:border-red-500/40 hover:text-white"
                }`}
              >
                Assets Removed
              </button>
            </div>

            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search platoon, user, asset, action, notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-black border border-[#00ff66]/30 rounded-xl pl-11 pr-10 py-3 text-white outline-none focus:border-[#00ff66]"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                ⌕
              </span>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition"
                >
                  ×
                </button>
              )}
            </div>

            <button
              onClick={toggleAllRows}
              className="px-4 py-3 rounded-xl border border-[#00ff66]/25 bg-black/40 text-gray-300 hover:border-[#00ff66]/40 hover:text-white transition"
            >
              {allExpanded ? "Collapse All" : "Expand All"}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-gray-400">
              Showing {filteredTransactions.length} transaction
              {filteredTransactions.length === 1 ? "" : "s"}
            </p>

            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
              Auto-refreshing every 30 seconds
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#00ff66]/30 bg-black/50 overflow-hidden">
          {loading ? (
            <div className="p-8 text-gray-400">Loading transactions...</div>
          ) : error ? (
            <div className="p-10 text-center">
              <div className="text-lg text-red-400">{error}</div>
              <div className="text-sm text-gray-500 mt-2">
                Please try refreshing the page or checking Supabase access.
              </div>
            </div>
          ) : groupedTransactions.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-lg text-gray-300">No matching transactions</div>
              <div className="text-sm text-gray-500 mt-2">
                Try adjusting your filters or search
              </div>
            </div>
          ) : (
            <>
              <div className="block lg:hidden">
                {groupedTransactions.map((group) => (
                  <div key={group.label} className="border-t border-[#00ff66]/10 first:border-t-0">
                    <div className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 bg-black/60">
                      {group.label}
                    </div>

                    <div className="p-4 space-y-4">
                      {group.items.map((tx) => {
                        const isExpanded = !!expandedRows[tx.id];
                        const highlightVariant =
                          tx.action === "REMOVE_ASSET"
                            ? "red"
                            : tx.action === "BUY_ASSET"
                            ? "blue"
                            : "green";

                        return (
                          <div
                            key={tx.id}
                            className={`rounded-2xl border bg-black/40 p-4 ${getCardBorderStyle(
                              tx.action
                            )}`}
                          >
                            <button
                              onClick={() => toggleRow(tx.id)}
                              className="w-full text-left"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <span
                                      className={`px-2 py-1 rounded-lg border text-xs ${getActionStyle(
                                        tx.action
                                      )}`}
                                    >
                                      {getActionLabel(tx)}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {formatRelativeTime(tx.created_at)}
                                    </span>
                                  </div>

                                  <div className="text-sm font-semibold text-white">
                                    {renderHighlightedText(
                                      tx.platoon?.name || "Unknown",
                                      search,
                                      highlightVariant
                                    )}
                                  </div>

                                  <div className="mt-1 text-sm text-gray-400">
                                    By{" "}
                                    {renderHighlightedText(
                                      tx.profile?.display_name || "Unknown",
                                      search,
                                      highlightVariant
                                    )}
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <div
                                    className={`text-sm font-semibold ${getAmountTextStyle(
                                      tx.action
                                    )}`}
                                  >
                                    {tx.action === "ADD_TOKENS"
                                      ? `+${tx.amount.toLocaleString()}`
                                      : tx.action === "BUY_ASSET"
                                      ? `-${tx.amount.toLocaleString()}`
                                      : tx.quantity
                                      ? `${tx.quantity}x`
                                      : "-"}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {isExpanded ? "Hide" : "View"}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 text-sm text-gray-300 line-clamp-3">
                                {renderHighlightedText(
                                  tx.description,
                                  search,
                                  highlightVariant
                                )}
                              </div>
                            </button>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                onClick={() => copyToClipboard(tx.description)}
                                className="text-xs px-3 py-1.5 rounded-lg border border-[#00ff66]/20 text-gray-300 hover:border-[#00ff66]/40 hover:text-[#00ff66] transition"
                              >
                                Copy Details
                              </button>
                              <button
                                onClick={() => copyToClipboard(tx.id)}
                                className="text-xs px-3 py-1.5 rounded-lg border border-[#00ff66]/20 text-gray-300 hover:border-[#00ff66]/40 hover:text-[#00ff66] transition"
                              >
                                Copy ID
                              </button>
                            </div>

                            {isExpanded && (
                              <div
                                className={`mt-4 rounded-xl border border-white/5 bg-black/45 p-4 ${getExpandedBorderStyle(
                                  tx.action
                                )}`}
                              >
                                <div className="space-y-4 text-sm">
                                  <div>
                                    <div className="text-[11px] uppercase tracking-[0.2em] text-gray-500 mb-2">
                                      Entry Details
                                    </div>
                                    <div className="space-y-2">
                                      <div className="flex justify-between gap-4">
                                        <span className="text-gray-500">Action</span>
                                        <span className="text-white text-right">
                                          {getActionLabel(tx)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between gap-4">
                                        <span className="text-gray-500">Platoon</span>
                                        <span className="text-white text-right">
                                          {tx.platoon?.name || "Unknown"}
                                        </span>
                                      </div>
                                      <div className="flex justify-between gap-4">
                                        <span className="text-gray-500">Performed By</span>
                                        <span className="text-white text-right">
                                          {tx.profile?.display_name || "Unknown"}
                                        </span>
                                      </div>
                                      <div className="flex justify-between gap-4">
                                        <span className="text-gray-500">Amount</span>
                                        <span className="text-white text-right">
                                          {tx.amount ?? 0}
                                        </span>
                                      </div>
                                      <div className="flex justify-between gap-4">
                                        <span className="text-gray-500">Quantity</span>
                                        <span className="text-white text-right">
                                          {tx.quantity ?? "-"}
                                        </span>
                                      </div>
                                      <div className="flex justify-between gap-4">
                                        <span className="text-gray-500">Asset</span>
                                        <span className="text-white text-right break-all">
                                          {tx.asset_name || "-"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-[11px] uppercase tracking-[0.2em] text-gray-500 mb-2">
                                      Audit Info
                                    </div>
                                    <div className="space-y-2">
                                      <div className="flex justify-between gap-4">
                                        <span className="text-gray-500">Transaction ID</span>
                                        <span className="text-white text-right break-all">
                                          {tx.id}
                                        </span>
                                      </div>
                                      <div className="flex justify-between gap-4">
                                        <span className="text-gray-500">Platoon ID</span>
                                        <span className="text-white text-right break-all">
                                          {tx.platoon_id}
                                        </span>
                                      </div>
                                      <div className="flex justify-between gap-4">
                                        <span className="text-gray-500">Performed By ID</span>
                                        <span className="text-white text-right break-all">
                                          {tx.performed_by || "-"}
                                        </span>
                                      </div>
                                      <div className="flex justify-between gap-4">
                                        <span className="text-gray-500">Timestamp</span>
                                        <span className="text-white text-right">
                                          {new Date(tx.created_at).toLocaleString()}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-[11px] uppercase tracking-[0.2em] text-gray-500 mb-2">
                                      Full Notes
                                    </div>
                                    <div className="text-gray-300 whitespace-pre-wrap">
                                      {tx.notes || tx.description}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden lg:block overflow-x-auto max-h-[75vh]">
                <table className="w-full">
                  <thead className="sticky top-0 z-20 border-b border-[#00ff66]/20 bg-[#03150b]/95 backdrop-blur">
                    <tr className="text-left">
                      <th className="px-4 py-3 text-[#00ff66]">Date</th>
                      <th className="px-4 py-3 text-[#00ff66]">Platoon</th>
                      <th className="px-4 py-3 text-[#00ff66]">Action</th>
                      <th className="px-4 py-3 text-[#00ff66]">Amount</th>
                      <th className="px-4 py-3 text-[#00ff66]">Qty</th>
                      <th className="px-4 py-3 text-[#00ff66]">Asset</th>
                      <th className="px-4 py-3 text-[#00ff66]">Performed By</th>
                      <th className="px-4 py-3 text-[#00ff66]">Details</th>
                      <th className="px-4 py-3 text-[#00ff66] text-right">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {groupedTransactions.map((group) => (
                      <React.Fragment key={group.label}>
                        <tr className="bg-black/70">
                          <td
                            colSpan={9}
                            className="px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-gray-400 border-b border-[#00ff66]/10"
                          >
                            {group.label}
                          </td>
                        </tr>

                        {group.items.map((tx) => {
                          const isExpanded = !!expandedRows[tx.id];
                          const highlightVariant =
                            tx.action === "REMOVE_ASSET"
                              ? "red"
                              : tx.action === "BUY_ASSET"
                              ? "blue"
                              : "green";

                          return (
                            <React.Fragment key={tx.id}>
                              <tr
                                onClick={() => toggleRow(tx.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    toggleRow(tx.id);
                                  }
                                }}
                                tabIndex={0}
                                className="group border-b border-[#00ff66]/10 hover:bg-[#00ff66]/5 transition cursor-pointer outline-none focus:bg-[#00ff66]/5"
                              >
                                <td
                                  className="px-4 py-4 text-sm text-gray-300 whitespace-nowrap"
                                  title={new Date(tx.created_at).toLocaleString()}
                                >
                                  {formatRelativeTime(tx.created_at)}
                                </td>

                                <td className="px-4 py-4">
                                  {renderHighlightedText(
                                    tx.platoon?.name || "Unknown",
                                    search,
                                    highlightVariant
                                  )}
                                </td>

                                <td className="px-4 py-4">
                                  <span
                                    className={`px-2 py-1 rounded-lg border text-sm ${getActionStyle(
                                      tx.action
                                    )}`}
                                  >
                                    {renderHighlightedText(
                                      getActionLabel(tx),
                                      search,
                                      highlightVariant
                                    )}
                                  </span>
                                </td>

                                <td
                                  className={`px-4 py-4 font-medium ${
                                    tx.action === "ADD_TOKENS"
                                      ? "text-[#00ff66]"
                                      : tx.action === "BUY_ASSET"
                                      ? "text-blue-400"
                                      : "text-gray-400"
                                  }`}
                                >
                                  {tx.action === "ADD_TOKENS"
                                    ? `+${tx.amount.toLocaleString()}`
                                    : tx.action === "BUY_ASSET"
                                    ? `-${tx.amount.toLocaleString()}`
                                    : "-"}
                                </td>

                                <td
                                  className={`px-4 py-4 font-medium ${
                                    tx.action === "REMOVE_ASSET" || tx.action === "BUY_ASSET"
                                      ? tx.action === "REMOVE_ASSET"
                                        ? "text-red-400"
                                        : "text-blue-400"
                                      : "text-gray-400"
                                  }`}
                                >
                                  {tx.action === "REMOVE_ASSET" || tx.action === "BUY_ASSET"
                                    ? tx.quantity ?? "-"
                                    : "-"}
                                </td>

                                <td
                                  className={`px-4 py-4 ${
                                    tx.action === "REMOVE_ASSET"
                                      ? "text-red-300"
                                      : tx.action === "BUY_ASSET"
                                      ? "text-blue-300"
                                      : "text-gray-300"
                                  }`}
                                >
                                  {renderHighlightedText(
                                    tx.asset_name || "-",
                                    search,
                                    highlightVariant
                                  )}
                                </td>

                                <td className="px-4 py-4">
                                  {renderHighlightedText(
                                    tx.profile?.display_name || "Unknown",
                                    search,
                                    highlightVariant
                                  )}
                                </td>

                                <td className="px-4 py-4 text-gray-300 max-w-[340px]">
                                  <div className="line-clamp-2">
                                    {renderHighlightedText(
                                      tx.description,
                                      search,
                                      highlightVariant
                                    )}
                                  </div>
                                </td>

                                <td className="px-4 py-4">
                                  <div
                                    className="flex items-center justify-end gap-2 opacity-100 xl:opacity-0 xl:group-hover:opacity-100 transition"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      onClick={() => copyToClipboard(tx.description)}
                                      className="text-xs px-2 py-1 rounded-lg border border-[#00ff66]/20 text-gray-300 hover:border-[#00ff66]/40 hover:text-[#00ff66] transition"
                                    >
                                      Copy Details
                                    </button>
                                    <button
                                      onClick={() => copyToClipboard(tx.id)}
                                      className="text-xs px-2 py-1 rounded-lg border border-[#00ff66]/20 text-gray-300 hover:border-[#00ff66]/40 hover:text-[#00ff66] transition"
                                    >
                                      Copy ID
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {isExpanded && (
                                <tr className="bg-black/35">
                                  <td
                                    colSpan={9}
                                    className={`px-6 py-5 border-b border-[#00ff66]/10 ${getExpandedBorderStyle(
                                      tx.action
                                    )}`}
                                  >
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                      <div className="rounded-xl border border-[#00ff66]/15 bg-black/40 p-4">
                                        <div className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-3">
                                          Entry Details
                                        </div>
                                        <div className="space-y-2 text-sm">
                                          <div>
                                            <span className="text-gray-500">Action:</span>{" "}
                                            <span className="text-white">{getActionLabel(tx)}</span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">Platoon:</span>{" "}
                                            <span className="text-white">
                                              {tx.platoon?.name || "Unknown"}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">Performed By:</span>{" "}
                                            <span className="text-white">
                                              {tx.profile?.display_name || "Unknown"}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">Amount:</span>{" "}
                                            <span className="text-white">{tx.amount ?? 0}</span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">Quantity:</span>{" "}
                                            <span className="text-white">{tx.quantity ?? "-"}</span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">Asset:</span>{" "}
                                            <span className="text-white">
                                              {tx.asset_name || "-"}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="rounded-xl border border-[#00ff66]/15 bg-black/40 p-4">
                                        <div className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-3">
                                          Audit Info
                                        </div>
                                        <div className="space-y-2 text-sm">
                                          <div>
                                            <span className="text-gray-500">Transaction ID:</span>{" "}
                                            <span className="text-white break-all">{tx.id}</span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">Platoon ID:</span>{" "}
                                            <span className="text-white break-all">
                                              {tx.platoon_id}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">Performed By ID:</span>{" "}
                                            <span className="text-white break-all">
                                              {tx.performed_by || "-"}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">Timestamp:</span>{" "}
                                            <span className="text-white">
                                              {new Date(tx.created_at).toLocaleString()}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">ISO Time:</span>{" "}
                                            <span className="text-white break-all">
                                              {new Date(tx.created_at).toISOString()}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="lg:col-span-2 rounded-xl border border-[#00ff66]/15 bg-black/40 p-4">
                                        <div className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-3">
                                          Full Notes
                                        </div>
                                        <div className="text-sm text-gray-300 whitespace-pre-wrap">
                                          {tx.notes || tx.description}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
