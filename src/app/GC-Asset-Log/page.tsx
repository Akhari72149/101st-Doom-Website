"use client";

import { useEffect, useState } from "react";
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

export default function GCLogisticsTransactionsPage() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [search, setSearch] = useState("");

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
        userRoles.includes("logistics");
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
      case "BUY_ASSET":
        return "Bought Asset";
      case "REMOVE_ASSET":
        return "Removed Asset";
      default:
        return tx.action;
    }
  };
  const getActionStyle = (action: string) => {
  switch (action) {
    case "BUY_ASSET":
      return "border-blue-500 text-blue-400 bg-blue-500/10";
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
      case "BUY_ASSET":
        return `${actor} bought ${tx.quantity ?? 0} x ${tx.asset_name || "asset"} for ${platoonName}`;
      case "REMOVE_ASSET":
        return `${actor} removed ${tx.quantity ?? 0} x ${tx.asset_name || "asset"} from ${platoonName}`;
      default:
        return `${actor} performed ${tx.action} on ${platoonName}`;
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
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

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#00ff66] bg-black">
        Checking Permissions...
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white bg-[radial-gradient(circle_at_center,#001f11_0%,#000000_100%)] p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#00ff66]">
              Logistics Transaction History
            </h1>
            <p className="text-gray-400 mt-2">
              Full audit trail of token and asset actions
            </p>
          </div>

          <button
            onClick={() => router.push("/GC-Platoon-Logi")}
            className="px-4 py-2 border border-[#00ff66] text-[#00ff66] rounded-xl hover:bg-[#00ff66] hover:text-black transition"
          >
            ← Back
          </button>
        </div>

        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by platoon, user, asset, action..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black border border-[#00ff66]/30 rounded-xl px-4 py-3 text-white"
          />
        </div>

        <div className="rounded-2xl border border-[#00ff66]/30 bg-black/50 overflow-hidden">
          {loading ? (
            <div className="p-8 text-gray-400">Loading transactions...</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-8 text-gray-400">No transactions found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-[#00ff66]/20 bg-[#00ff66]/5">
                  <tr className="text-left">
                    <th className="px-4 py-3 text-[#00ff66]">Date</th>
                    <th className="px-4 py-3 text-[#00ff66]">Platoon</th>
                    <th className="px-4 py-3 text-[#00ff66]">Action</th>
                    <th className="px-4 py-3 text-[#00ff66]">Amount</th>
                    <th className="px-4 py-3 text-[#00ff66]">Qty</th>
                    <th className="px-4 py-3 text-[#00ff66]">Asset</th>
                    <th className="px-4 py-3 text-[#00ff66]">Performed By</th>
                    <th className="px-4 py-3 text-[#00ff66]">Details</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTransactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-b border-[#00ff66]/10 hover:bg-[#00ff66]/5 transition"
                    >
                      <td className="px-4 py-4 text-sm text-gray-300">
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-4">
                        {tx.platoon?.name || "Unknown"}
                      </td>
                      <td className="px-4 py-4">
                        <span
                        className={`px-2 py-1 rounded-lg border text-sm ${getActionStyle(tx.action)}`}
                        >
                              {getActionLabel(tx)}
                        </span>
                      </td>
                      <td className="px-4 py-4">{tx.amount ?? 0}</td>
                      <td className="px-4 py-4">{tx.quantity ?? "-"}</td>
                      <td className="px-4 py-4">{tx.asset_name || "-"}</td>
                      <td className="px-4 py-4">
                        {tx.profile?.display_name || "Unknown"}
                      </td>
                      <td className="px-4 py-4 text-gray-300">
                        {getDescription(tx)}
                      </td>
                    </tr>
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