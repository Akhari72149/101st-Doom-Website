"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  UserCog,
  X,
} from "lucide-react";
import {
  type PagePermissionAccess,
  type PagePermissionDefinition,
  pagePermissionLevels,
} from "@/data/pagePermissions";
import { getAppAuthHeaders, getAppSession } from "@/lib/client-auth";

type Account = {
  id: string;
  email: string | undefined;
  displayName: string;
  createdAt: string | undefined;
  lastSignInAt: string | undefined;
  bannedUntil: string | undefined;
  disabled: boolean;
  roles: string[];
  permissions: Record<string, PagePermissionAccess>;
  username?: string;
  protected?: boolean;
  mustChangePassword?: boolean;
};

type PermissionResponse = {
  accounts: Account[];
  permissionDefinitions: PagePermissionDefinition[];
  levels: PagePermissionAccess[];
  currentUserId: string | null;
  capabilities?: {
    canManagePermissions: boolean;
    canManageAccounts: boolean;
    canResetPasswords: boolean;
    isSuperUser: boolean;
  };
};

type TemporaryCredential = {
  username: string;
  password: string;
};

const editableLevels = pagePermissionLevels;
const levelWeight: Record<PagePermissionAccess, number> = { none: 0, read: 1, edit: 2, full: 3 };
const protectedDelegationPermissions = new Set([
  "admin.permissions",
  "admin.account-management",
  "admin.account-password-reset",
  "admin.updater",
]);

function formatDate(value: string | undefined) {
  if (!value) return "Never";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function accessClass(level: PagePermissionAccess | undefined) {
  if (level === "full") return "border-[#00ff66]/40 bg-[#00ff66]/10 text-[#00ff66]";
  if (level === "edit") return "border-cyan-400/35 bg-cyan-400/10 text-cyan-300";
  if (level === "read") return "border-amber-300/35 bg-amber-300/10 text-amber-200";
  return "border-white/10 bg-white/[0.03] text-gray-500";
}

function accessLabel(level: PagePermissionAccess) {
  if (level === "none") return "No Access";
  if (level === "read") return "View";
  if (level === "edit") return "Edit";
  return "Full";
}

export default function AdminPermissionsPage() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showDisabled, setShowDisabled] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [definitions, setDefinitions] = useState<PagePermissionDefinition[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState({
    canManagePermissions: false,
    canManageAccounts: false,
    canResetPasswords: false,
    isSuperUser: false,
  });
  const [draftPermissions, setDraftPermissions] = useState<Record<string, PagePermissionAccess>>({});
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [newUsernames, setNewUsernames] = useState("");
  const [createdCredentials, setCreatedCredentials] = useState<TemporaryCredential[]>([]);
  const [skippedAccounts, setSkippedAccounts] = useState<Array<{ username: string; reason: string }>>([]);
  const [resetCredentials, setResetCredentials] = useState<TemporaryCredential | null>(null);
  const [credentialsCopied, setCredentialsCopied] = useState(false);
  const [createError, setCreateError] = useState("");

  const groupedDefinitions = useMemo(() => {
    const groups = new Map<string, PagePermissionDefinition[]>();

    for (const definition of definitions) {
      const entries = groups.get(definition.category) || [];
      entries.push(definition);
      groups.set(definition.category, entries);
    }

    return Array.from(groups.entries()).map(([category, entries]) => ({
      category,
      entries,
    }));
  }, [definitions]);

  const filteredAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return accounts
      .filter((account) => showDisabled || !account.disabled)
      .filter((account) => {
        if (!normalizedQuery) return true;

        return [
          account.email || "",
          account.displayName || "",
          account.username || "",
          account.roles.join(" "),
          account.id,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      });
  }, [accounts, query, showDisabled]);

  const stats = useMemo(() => {
    const disabled = accounts.filter((account) => account.disabled).length;
    const active = accounts.length - disabled;
    const permissioned = accounts.filter((account) =>
      Object.values(account.permissions || {}).some((level) => level && level !== "none"),
    ).length;

    return { active, disabled, permissioned };
  }, [accounts]);

  const currentAccount = useMemo(
    () => accounts.find((account) => account.id === currentUserId) || null,
    [accounts, currentUserId],
  );

  function canSetPermission(
    definition: PagePermissionDefinition,
    option: PagePermissionAccess,
  ) {
    if (!selectedAccount || !capabilities.canManagePermissions) return false;
    if (capabilities.isSuperUser) return true;
    if (selectedAccount.id === currentUserId) return false;
    if (protectedDelegationPermissions.has(definition.key)) return false;
    const callerLevel = currentAccount?.permissions[definition.key] || "none";
    const targetLevel = selectedAccount.permissions[definition.key] || "none";
    return levelWeight[callerLevel] >= levelWeight[targetLevel]
      && levelWeight[callerLevel] >= levelWeight[option];
  }

  async function loadPermissions() {
    setLoading(true);
    setStatus(null);

    const authHeaders = await getAppAuthHeaders();

    const response = await fetch("/api/admin/permissions", {
      headers: authHeaders,
    });

    const body = (await response.json().catch(() => null)) as PermissionResponse | { error?: string } | null;

    if (!response.ok) {
      setStatus((body as { error?: string } | null)?.error || "Failed to load permissions");
      setLoading(false);
      return;
    }

    const payload = body as PermissionResponse;
    setAccounts(payload.accounts || []);
    setDefinitions(payload.permissionDefinitions || []);
    setCurrentUserId(payload.currentUserId || null);
    setCapabilities(payload.capabilities || {
      canManagePermissions: true,
      canManageAccounts: true,
      canResetPasswords: false,
      isSuperUser: false,
    });
    setLoading(false);
  }

  useEffect(() => {
    const checkAccess = async () => {
      const session = await getAppSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      setLoadingAuth(false);
      loadPermissions();
    };

    checkAccess();
  }, [router]);

  function openPermissionModal(account: Account) {
    setSelectedAccount(account);
    setDraftPermissions({ ...(account.permissions || {}) });
    setStatus(null);
  }

  async function runAccountAction(action: "disable" | "enable" | "delete", account: Account) {
    const confirmText =
      action === "delete"
        ? `Soft delete ${account.email || account.displayName || "this account"}?`
        : null;

    if (confirmText && !window.confirm(confirmText)) {
      return;
    }

    setSaving(true);
    setStatus(null);

    const authHeaders = await getAppAuthHeaders();
    const response = await fetch("/api/admin/permissions", {
      method: "PATCH",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        userId: account.id,
      }),
    });

    const body = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setStatus(body?.error || "Account action failed");
      setSaving(false);
      return;
    }

    await loadPermissions();
    setSaving(false);
    setStatus(
      action === "delete"
        ? "Account soft deleted."
        : action === "disable"
          ? "Account disabled."
          : "Account enabled.",
    );
  }

  async function savePermissions() {
    if (!selectedAccount) return;

    setSaving(true);
    setStatus(null);

    const permissionPayload = definitions.map((definition) => ({
      permissionKey: definition.key,
      accessLevel: draftPermissions[definition.key] || "none",
    }));

    const authHeaders = await getAppAuthHeaders();
    const response = await fetch("/api/admin/permissions", {
      method: "PATCH",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "permissions",
        userId: selectedAccount.id,
        permissions: permissionPayload,
      }),
    });

    const body = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setStatus(body?.error || "Failed to save permissions");
      setSaving(false);
      return;
    }

    await loadPermissions();
    setSelectedAccount(null);
    setSaving(false);
    setStatus("Permissions updated.");
  }

  async function createAccount() {
    setSaving(true);
    setStatus(null);
    setCreateError("");
    const response = await fetch("/api/admin/permissions", {
      method: "POST",
      headers: {
        ...(await getAppAuthHeaders()),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usernames: newUsernames.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean),
      }),
    });
    const body = await response.json().catch(() => null) as {
      error?: string;
      created?: Array<{ username: string; temporaryPassword: string }>;
      skipped?: Array<{ username: string; reason: string }>;
    } | null;
    if (!response.ok || !body?.created) {
      setCreateError(body?.error || "Unable to create account");
      setSaving(false);
      return;
    }
    setCreatedCredentials(body.created.map((entry) => ({
      username: entry.username,
      password: entry.temporaryPassword,
    })));
    setSkippedAccounts(body.skipped || []);
    setCredentialsCopied(false);
    setCreateError("");
    await loadPermissions();
    setSaving(false);
  }

  function closeCreateAccount() {
    setShowCreateAccount(false);
    setNewUsernames("");
    setCreatedCredentials([]);
    setSkippedAccounts([]);
    setCredentialsCopied(false);
    setCreateError("");
  }

  async function copyCredentials() {
    if (createdCredentials.length === 0) return;
    try {
      await navigator.clipboard.writeText(
        createdCredentials
          .map((entry) => `Username: ${entry.username}\nTemporary password: ${entry.password}`)
          .join("\n\n"),
      );
      setCredentialsCopied(true);
    } catch {
      setCreateError("Clipboard access was blocked. Select the credentials and copy them manually.");
    }
  }

  async function resetPassword(account: Account) {
    if (!window.confirm(`Reset the password for ${account.displayName || account.username}? Existing sessions will be signed out.`)) return;
    setSaving(true);
    setStatus(null);
    setCredentialsCopied(false);
    const response = await fetch("/api/admin/permissions", {
      method: "PATCH",
      headers: { ...(await getAppAuthHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset-password", userId: account.id }),
    });
    const body = await response.json().catch(() => null) as {
      error?: string;
      username?: string;
      temporaryPassword?: string;
    } | null;
    if (!response.ok || !body?.username || !body.temporaryPassword) {
      setStatus(body?.error || "Password reset failed");
      setSaving(false);
      return;
    }
    setResetCredentials({ username: body.username, password: body.temporaryPassword });
    await loadPermissions();
    setSaving(false);
  }

  async function copyResetCredentials() {
    if (!resetCredentials) return;
    try {
      await navigator.clipboard.writeText(
        `Username: ${resetCredentials.username}\nTemporary password: ${resetCredentials.password}`,
      );
      setCredentialsCopied(true);
    } catch {
      setStatus("Clipboard access was blocked. Select the credentials and copy them manually.");
    }
  }

  if (loadingAuth) {
    return (
      <main className="min-h-screen bg-[#020806] px-6 py-24 text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 text-[#00ff66]">
          <Loader2 className="animate-spin" size={20} />
          Checking access...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020806] px-4 py-10 text-white sm:px-6 lg:px-10">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(0,255,102,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,102,0.035)_1px,transparent_1px)] bg-[size:44px_44px]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(0,255,102,0.11),transparent_32rem)]" />

      <section className="relative mx-auto max-w-7xl">
        <div className="border border-[#00ff66]/20 bg-black/72 p-6 shadow-[0_0_40px_rgba(0,255,102,0.08)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-3 text-[#00ff66]">
                <ShieldCheck size={22} />
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#00ff66]/70">
                  Admin Control
                </span>
              </div>
              <h1 className="text-4xl font-black uppercase tracking-[0.18em] text-[#00ff66] sm:text-5xl">
                Permissions
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-400">
                Manage active login accounts, disable access, and assign page permissions using read,
                edit, or full access levels.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
              {[
                ["Active", stats.active],
                ["Disabled", stats.disabled],
                ["Permissioned", stats.permissioned],
              ].map(([label, value]) => (
                <div key={label} className="border border-[#00ff66]/15 bg-[#00ff66]/5 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-500">
                    {label}
                  </div>
                  <div className="mt-2 text-2xl font-black text-white">{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-[#00ff66]/10 pt-6 lg:flex-row lg:items-center">
            <label className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#00ff66]/70"
                size={18}
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search account, role, or id..."
                className="w-full border border-[#00ff66]/20 bg-black/70 py-3 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-[#00ff66]/60"
              />
            </label>

            <button
              type="button"
              onClick={() => setShowCreateAccount(true)}
              disabled={saving || !capabilities.canManageAccounts}
              title={!capabilities.canManageAccounts ? "Full Account Management permission is required" : undefined}
              className="inline-flex items-center justify-center gap-2 border border-cyan-400/35 bg-cyan-400/10 px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-cyan-300 transition hover:bg-cyan-400/20 disabled:opacity-50"
            >
              <UserPlus size={16} />
              Create Account
            </button>

            <button
              type="button"
              onClick={() => setShowDisabled((value) => !value)}
              className={`inline-flex items-center justify-center gap-2 border px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] transition ${
                showDisabled
                  ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300"
                  : "border-[#00ff66]/20 bg-black/60 text-gray-400 hover:border-[#00ff66]/40 hover:text-[#00ff66]"
              }`}
            >
              <SlidersHorizontal size={16} />
              {showDisabled ? "Showing Disabled" : "Active Only"}
            </button>

            <button
              type="button"
              onClick={loadPermissions}
              disabled={loading || saving}
              className="inline-flex items-center justify-center gap-2 border border-[#00ff66]/35 bg-[#00ff66]/10 px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[#00ff66] transition hover:bg-[#00ff66]/20 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
              Refresh
            </button>
          </div>

          {status && (
            <div className="mt-4 border border-cyan-400/25 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200">
              {status}
            </div>
          )}
        </div>

        <div className="mt-6 border border-[#00ff66]/20 bg-black/72">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_auto] gap-4 border-b border-[#00ff66]/15 px-5 py-4 text-[10px] font-bold uppercase tracking-[0.22em] text-[#00ff66]/70 max-lg:hidden">
            <div>Account</div>
            <div>Roles</div>
            <div>Activity</div>
            <div>Controls</div>
          </div>

          {loading ? (
            <div className="flex items-center gap-3 px-5 py-10 text-gray-400">
              <Loader2 className="animate-spin text-[#00ff66]" size={20} />
              Loading accounts...
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="px-5 py-10 text-gray-500">No matching accounts found.</div>
          ) : (
            <div className="divide-y divide-[#00ff66]/10">
              {filteredAccounts.map((account) => {
                const permissionCount = Object.values(account.permissions || {}).filter(
                  (level) => level && level !== "none",
                ).length;
                const canManageProtected = !account.protected || account.id === currentUserId;
                const isCurrentAccount = account.id === currentUserId;

                return (
                  <article
                    key={account.id}
                    className={`grid gap-4 px-5 py-5 transition lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-center ${
                      account.disabled ? "bg-red-500/[0.04]" : "hover:bg-[#00ff66]/[0.035]"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-bold text-white">
                          {account.displayName || account.email || "Unnamed account"}
                        </h2>
                        {account.disabled && (
                          <span className="border border-red-400/35 bg-red-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-red-300">
                            Disabled
                          </span>
                        )}
                        {account.protected && (
                          <span className="border border-amber-300/35 bg-amber-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200">
                            Super User
                          </span>
                        )}
                        {account.mustChangePassword && (
                          <span className="border border-cyan-400/35 bg-cyan-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300">
                            Password Change Required
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {account.roles.length > 0 ? (
                        account.roles.map((role) => (
                          <span
                            key={role}
                            className="border border-[#00ff66]/20 bg-[#00ff66]/8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#00ff66]"
                          >
                            {role}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-600">No roles</span>
                      )}
                      <span className="border border-cyan-400/20 bg-cyan-400/8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-300">
                        {permissionCount} permissions
                      </span>
                    </div>

                    <div className="text-sm text-gray-400">
                      <div>Created: {formatDate(account.createdAt)}</div>
                      <div className="mt-1">Last login: {formatDate(account.lastSignInAt)}</div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <button
                        type="button"
                        onClick={() => openPermissionModal(account)}
                        disabled={!capabilities.canManagePermissions || !canManageProtected}
                        title={!capabilities.canManagePermissions ? "Full Permissions access is required" : !canManageProtected ? "Only Akhari can edit this account" : undefined}
                        className="inline-flex items-center gap-2 border border-[#00ff66]/35 bg-[#00ff66]/8 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#00ff66] transition hover:bg-[#00ff66]/16 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-gray-600"
                      >
                        <KeyRound size={15} />
                        Permissions
                      </button>
                      <button
                        type="button"
                        onClick={() => void resetPassword(account)}
                        disabled={saving || !capabilities.canResetPasswords || !canManageProtected}
                        title={!capabilities.canResetPasswords ? "Full Password Reset permission is required" : !canManageProtected ? "Only Akhari can reset this account" : undefined}
                        className="inline-flex items-center gap-2 border border-cyan-400/30 bg-cyan-400/8 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-300 transition hover:bg-cyan-400/15 disabled:opacity-50"
                      >
                        <RotateCcw size={15} />
                        Reset Password
                      </button>
                      <button
                        type="button"
                        onClick={() => runAccountAction(account.disabled ? "enable" : "disable", account)}
                        disabled={saving || !capabilities.canManageAccounts || !canManageProtected || isCurrentAccount}
                        title={!capabilities.canManageAccounts ? "Full Account Management permission is required" : !canManageProtected ? "Only Akhari can modify this account" : isCurrentAccount ? "You cannot disable your current account" : undefined}
                        className="inline-flex items-center gap-2 border border-amber-300/30 bg-amber-300/8 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-200 transition hover:bg-amber-300/15 disabled:opacity-50"
                      >
                        <Ban size={15} />
                        {account.disabled ? "Enable" : "Disable"}
                      </button>
                      <button
                        type="button"
                        onClick={() => runAccountAction("delete", account)}
                        disabled={saving || !capabilities.canManageAccounts || !canManageProtected || isCurrentAccount}
                        title={!capabilities.canManageAccounts ? "Full Account Management permission is required" : !canManageProtected ? "Only Akhari can delete this account" : isCurrentAccount ? "You cannot delete your current account" : undefined}
                        className="inline-flex items-center gap-2 border border-red-400/30 bg-red-500/8 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-red-300 transition hover:bg-red-500/15 disabled:opacity-50"
                      >
                        <Trash2 size={15} />
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {selectedAccount && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <section className="max-h-[90vh] w-full max-w-6xl overflow-hidden border border-[#00ff66]/25 bg-[#020806] shadow-[0_0_60px_rgba(0,255,102,0.12)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#00ff66]/15 p-5">
              <div>
                <div className="flex items-center gap-3 text-[#00ff66]">
                  <UserCog size={20} />
                  <span className="text-xs font-bold uppercase tracking-[0.22em]">Account Permissions</span>
                </div>
                <h2 className="mt-3 text-2xl font-black text-white">
                  {selectedAccount.displayName || selectedAccount.email || "Unnamed account"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAccount(null)}
                className="grid h-10 w-10 place-items-center border border-white/10 text-gray-400 transition hover:border-red-400/40 hover:text-red-300"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[64vh] overflow-y-auto p-5">
              <div className="overflow-hidden border border-[#00ff66]/15 bg-black/45">
                <div className="sticky top-0 z-10 grid grid-cols-[minmax(220px,1fr)_auto] items-center gap-4 border-b border-[#00ff66]/15 bg-[#06110d] px-4 py-3">
                  <div className="text-xs font-bold uppercase tracking-[0.22em] text-gray-300">
                    Screen Permissions
                  </div>
                  <div className="hidden grid-cols-4 gap-2 sm:grid">
                    {editableLevels.map((option) => (
                      <div
                        key={option}
                        className={`min-w-24 border px-3 py-2 text-center text-xs font-bold uppercase tracking-[0.12em] ${accessClass(option)}`}
                      >
                        {accessLabel(option)}
                      </div>
                    ))}
                  </div>
                </div>

                {groupedDefinitions.map((group) => (
                  <div key={group.category}>
                    <div className="border-b border-[#00ff66]/10 bg-[#00ff66]/[0.035] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#00ff66]/80">
                      {group.category}
                    </div>

                    {group.entries.map((definition) => {
                      const currentLevel = draftPermissions[definition.key] || "none";

                      return (
                        <div
                          key={definition.key}
                          className="grid gap-3 border-b border-[#00ff66]/10 px-4 py-3 transition last:border-b-0 hover:bg-[#00ff66]/[0.03] sm:grid-cols-[minmax(220px,1fr)_auto] sm:items-center"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-white">{definition.label}</div>
                            <div className="mt-1 text-xs text-gray-500">{definition.pagePath}</div>
                            <p className="mt-1 text-xs leading-5 text-gray-400">{definition.description}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {editableLevels.map((option) => {
                              const selected = currentLevel === option;

                              return (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={() =>
                                    setDraftPermissions((current) => ({
                                      ...current,
                                      [definition.key]: option,
                                    }))
                                  }
                                  disabled={!canSetPermission(definition, option)}
                                  className={`min-w-24 border px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] transition ${
                                    selected
                                      ? `${accessClass(option)} shadow-[0_0_18px_rgba(0,255,102,0.08)]`
                                      : "border-white/10 bg-white/[0.02] text-gray-600 hover:border-[#00ff66]/30 hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-35"
                                  }`}
                                >
                                  {accessLabel(option)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-[#00ff66]/15 p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setSelectedAccount(null)}
                className="border border-white/10 px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-gray-400 transition hover:border-white/20 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePermissions}
                disabled={saving || !capabilities.canManagePermissions}
                className="inline-flex items-center justify-center gap-2 border border-[#00ff66]/40 bg-[#00ff66]/10 px-5 py-3 text-sm font-bold uppercase tracking-[0.14em] text-[#00ff66] transition hover:bg-[#00ff66]/20 disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
                Save Permissions
              </button>
            </div>
          </section>
        </div>
      )}

      {resetCredentials && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <section className="w-full max-w-lg border border-cyan-400/25 bg-[#020806] shadow-[0_0_60px_rgba(34,211,238,0.12)]">
            <div className="flex items-start justify-between gap-4 border-b border-cyan-400/15 p-5">
              <div>
                <div className="flex items-center gap-3 text-cyan-300"><RotateCcw size={20} /><span className="text-xs font-bold uppercase tracking-[0.22em]">Password Reset</span></div>
                <p className="mt-3 text-sm leading-6 text-gray-400">The account has been signed out and must change this password at next login.</p>
              </div>
              <button type="button" onClick={() => setResetCredentials(null)} className="grid h-10 w-10 place-items-center border border-white/10 text-gray-400 transition hover:border-red-400/40 hover:text-red-300"><X size={18} /></button>
            </div>
            <div className="p-5">
              <div className="border border-amber-300/30 bg-amber-300/8 p-4 text-sm leading-6 text-amber-100">
                This temporary password is shown only once. Send it through a secure channel.
              </div>
              <div className="mt-4 border border-cyan-400/15 bg-black/60 p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Username</div>
                <div className="mt-2 break-all font-mono text-base text-white">{resetCredentials.username}</div>
                <div className="mt-5 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Temporary Password</div>
                <div className="mt-2 break-all font-mono text-base text-cyan-300">{resetCredentials.password}</div>
              </div>
              <button type="button" onClick={() => void copyResetCredentials()} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 border border-cyan-400/35 bg-cyan-400/10 px-4 text-sm font-bold uppercase tracking-[0.14em] text-cyan-300 transition hover:bg-cyan-400/20">
                {credentialsCopied ? <CheckCircle2 size={17} /> : <Copy size={17} />}
                {credentialsCopied ? "Credentials Copied" : "Copy Credentials"}
              </button>
            </div>
          </section>
        </div>
      )}

      {showCreateAccount && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <section className="w-full max-w-lg border border-[#00ff66]/25 bg-[#020806] shadow-[0_0_60px_rgba(0,255,102,0.12)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#00ff66]/15 p-5">
              <div>
                <div className="flex items-center gap-3 text-[#00ff66]"><UserPlus size={20} /><span className="text-xs font-bold uppercase tracking-[0.22em]">Create Login Account</span></div>
                <p className="mt-3 text-sm leading-6 text-gray-400">Create a username with a one-time temporary password.</p>
              </div>
              <button type="button" onClick={closeCreateAccount} className="grid h-10 w-10 place-items-center border border-white/10 text-gray-400 transition hover:border-red-400/40 hover:text-red-300"><X size={18} /></button>
            </div>

            <div className="p-5">
              {createError && <div className="mb-4 border border-red-400/35 bg-red-500/10 p-3 text-sm text-red-200">{createError}</div>}
              {createdCredentials.length > 0 || skippedAccounts.length > 0 ? (
                <div>
                  {createdCredentials.length > 0 && (
                    <>
                      <div className="border border-amber-300/30 bg-amber-300/8 p-4 text-sm leading-6 text-amber-100">
                        These temporary passwords are shown only once. Send each one through a secure channel.
                      </div>
                      <div className="mt-4 max-h-80 overflow-y-auto border border-[#00ff66]/15 bg-black/60">
                        {createdCredentials.map((credential) => (
                          <div key={credential.username} className="grid gap-2 border-b border-[#00ff66]/10 p-4 last:border-b-0 sm:grid-cols-[1fr_1.4fr]">
                            <div className="break-all font-mono text-sm text-white">{credential.username}</div>
                            <div className="break-all font-mono text-sm text-[#00ff66]">{credential.password}</div>
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => void copyCredentials()} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 border border-[#00ff66]/35 bg-[#00ff66]/10 px-4 text-sm font-bold uppercase tracking-[0.14em] text-[#00ff66] transition hover:bg-[#00ff66]/20">
                        {credentialsCopied ? <CheckCircle2 size={17} /> : <Copy size={17} />}
                        {credentialsCopied ? "Credentials Copied" : "Copy All Credentials"}
                      </button>
                    </>
                  )}
                  {skippedAccounts.length > 0 && (
                    <div className="mt-4 border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Skipped</div>
                      <div className="mt-3 space-y-2 text-sm text-gray-400">
                        {skippedAccounts.map((entry, index) => (
                          <div key={`${entry.username}-${index}`}><span className="text-white">{entry.username}</span>: {entry.reason}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Usernames</span>
                    <textarea value={newUsernames} onChange={(event) => setNewUsernames(event.target.value)} autoComplete="off" rows={12} placeholder={"Advisor\nAkhari\nArcher\nSix-Ten"}
                      className="mt-2 w-full resize-y border border-[#00ff66]/20 bg-black/70 px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-[#00ff66]/60" />
                  </label>
                  <p className="mt-2 text-xs leading-5 text-gray-500">Enter one per line. Existing accounts are skipped. Usernames use 2-40 letters, numbers, hyphens, underscores, or dots.</p>
                  <button type="button" onClick={() => void createAccount()} disabled={saving || !newUsernames.trim()}
                    className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 border border-[#00ff66]/40 bg-[#00ff66]/15 px-5 font-black uppercase tracking-[0.12em] text-[#00ff66] transition hover:bg-[#00ff66]/25 disabled:cursor-not-allowed disabled:opacity-45">
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <UserPlus size={18} />}
                    Generate Accounts
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
