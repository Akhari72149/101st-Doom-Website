"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
};

type FilterType = "all" | "tokens" | "removed";

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

  useEffect(() => {
    const checkAccess = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const userRoles = data?.map((r) => r.role) || [];

      const hasAccess =
        userRoles.includes("Akhari") ||
        userRoles.includes("logistics") ||
        userRoles.includes("admin");

      if (!hasAccess) {
        router.replace("/GC-Platoon-Logi");
        return;
      }

      setLoadingAuth(false);
    };

    checkAccess();
  }, [router]);

  const fetchTransactions = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("token_transactions")
      .select(`
        id,
        action,
        amount,
        quantity,
        asset_name,
        performed_by,
        notes,
        created_at,
        platoon_id,
        platoon:platoon_id (
          name
        ),
        profile:performed_by (
          display_name
        )
      `)
      .in("action", ["ADD_TOKENS", "REMOVE_ASSET"])
      .order("created_at", { ascending: false });

    if (!error && data) {
      const formatted: TransactionRow[] = data.map((tx: any) => ({
        id: tx.id,
        action: tx.action,
        amount: tx.amount,
        quantity: tx.quantity,
        asset_name: tx.asset_name,
        performed_by: tx.performed_by,
        notes: tx.notes,
        created_at: tx.created_at,
        platoon_id: tx.platoon_id,
        platoon: Array.isArray(tx.platoon) ? tx.platoon[0] ?? null : tx.platoon,
        profile: Array.isArray(tx.profile) ? tx.profile[0] ?? null : tx.profile,
      }));

      setTransactions(formatted);
    } else {
      setTransactions([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!loadingAuth) {
      fetchTransactions();
    }
  }, [loadingAuth]);

  const getActionLabel = (tx: TransactionRow) => {
    switch (tx.action) {
      case "ADD_TOKENS":
        return "Added Tokens";
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
      default:
        return "border-[#00ff66]/30 text-[#00ff66] bg-[#00ff66]/5";
    }
  };

  const getDescription = (tx: TransactionRow) => {
    const actor = tx.profile?.display_name || "Unknown user";
    const platoonName = tx.platoon?.name || "Unknown platoon";

    if (tx.notes) return tx.notes;

    switch (tx.action) {
      case "ADD_TOKENS":
        return `${actor} added ${tx.amount ?? 0} tokens to ${platoonName}`;
      case "REMOVE_ASSET":
        return `${actor} removed ${tx.quantity ?? 0} x ${
          tx.asset_name || "asset"
        } from ${platoonName}`;
      default:
        return `${actor} performed ${tx.action} on ${platoonName}`;
    }
  };

  const escapeRegExp = (value: string) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  const renderHighlightedText = (
    text: string,
    query: string,
    variant: "green" | "red" = "green"
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
      if (filter === "removed" && tx.action !== "REMOVE_ASSET") return false;

      const target = [
        tx.platoon?.name || "",
        tx.action || "",
        tx.asset_name || "",
        tx.profile?.display_name || "",
        tx.notes || "",
        getDescription(tx),
      ]
        .join(" ")
        .toLowerCase();

      return target.includes(search.toLowerCase());
    });
  }, [transactions, filter, search]);

  const groupedTransactions = useMemo(() => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isSameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    const groups: GroupedTransactions[] = [
      { label: "Today", items: [] },
      { label: "Yesterday", items: [] },
      { label: "Older", items: [] },
    ];

    filteredTransactions.forEach((tx) => {
      const txDate = new Date(tx.created_at);

      if (isSameDay(txDate, today)) {
        groups[0].items.push(tx);
      } else if (isSameDay(txDate, yesterday)) {
        groups[1].items.push(tx);
      } else {
        groups[2].items.push(tx);
      }
    });

    return groups.filter((group) => group.items.length > 0);
  }, [filteredTransactions]);

  const stats = useMemo(() => {
    const totalTokensAdded = transactions
      .filter((tx) => tx.action === "ADD_TOKENS")
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const totalAssetsRemoved = transactions
      .filter((tx) => tx.action === "REMOVE_ASSET")
      .reduce((sum, tx) => sum + (Number(tx.quantity) || 0), 0);

    const today = new Date();
    const todayString = today.toDateString();

    const actionsToday = transactions.filter(
      (tx) => new Date(tx.created_at).toDateString() === todayString
    ).length;

    return {
      totalTokensAdded,
      totalAssetsRemoved,
      actionsToday,
    };
  }, [transactions]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#00ff66] bg-black">
        Checking Permissions...
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white bg-[radial-gradient(circle_at_center,#001f11_0%,#000000_100%)] p-8">
      <div className="max-w-[1650px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#00ff66]">
              Logistics Transaction History
            </h1>
            <p className="text-gray-400 mt-2">
              Full audit trail of token additions and removed assets
            </p>
          </div>

          <button
            onClick={() => router.push("/GC-Platoon-Logi")}
            className="px-4 py-2 border border-[#00ff66] text-[#00ff66] rounded-xl hover:bg-[#00ff66] hover:text-black transition"
          >
            ← Back
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-2xl border border-[#00ff66]/25 bg-black/40 p-5 shadow-[0_0_20px_rgba(0,255,102,0.08)]">
            <p className="text-sm uppercase tracking-wide text-gray-400">
              Total Tokens Added
            </p>
            <p className="mt-2 text-3xl font-bold text-[#00ff66]">
              {stats.totalTokensAdded.toLocaleString()}
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

          <div className="rounded-2xl border border-blue-500/25 bg-black/40 p-5 shadow-[0_0_20px_rgba(59,130,246,0.08)]">
            <p className="text-sm uppercase tracking-wide text-gray-400">
              Actions Today
            </p>
            <p className="mt-2 text-3xl font-bold text-blue-400">
              {stats.actionsToday.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6">
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

          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by platoon, user, asset, action..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-black border border-[#00ff66]/30 rounded-xl px-4 py-3 text-white"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-[#00ff66]/30 bg-black/50 overflow-hidden">
          {loading ? (
            <div className="p-8 text-gray-400">Loading transactions...</div>
          ) : groupedTransactions.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-lg text-gray-300">No matching transactions</div>
              <div className="text-sm text-gray-500 mt-2">
                Try adjusting your filters or search
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[75vh]">
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
                          tx.action === "REMOVE_ASSET" ? "red" : "green";

                        return (
                          <React.Fragment key={tx.id}>
                            <tr
                              onClick={() => toggleRow(tx.id)}
                              className="group border-b border-[#00ff66]/10 hover:bg-[#00ff66]/5 transition cursor-pointer"
                            >
                              <td
                                className="px-4 py-4 text-sm text-gray-300"
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
                                    : "text-gray-400"
                                }`}
                              >
                                {tx.action === "ADD_TOKENS" ? tx.amount ?? 0 : "-"}
                              </td>

                              <td
                                className={`px-4 py-4 font-medium ${
                                  tx.action === "REMOVE_ASSET"
                                    ? "text-red-400"
                                    : "text-gray-400"
                                }`}
                              >
                                {tx.action === "REMOVE_ASSET"
                                  ? tx.quantity ?? "-"
                                  : "-"}
                              </td>

                              <td
                                className={`px-4 py-4 ${
                                  tx.action === "REMOVE_ASSET"
                                    ? "text-red-300"
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

                              <td className="px-4 py-4 text-gray-300 max-w-[320px] truncate">
                                {renderHighlightedText(
                                  getDescription(tx),
                                  search,
                                  highlightVariant
                                )}
                              </td>

                              <td className="px-4 py-4">
                                <div
                                  className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={() => copyToClipboard(getDescription(tx))}
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
                                  className="px-6 py-5 border-b border-[#00ff66]/10"
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
                                        {tx.notes || getDescription(tx)}
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
          )}
        </div>
      </div>
    </div>
  );
}