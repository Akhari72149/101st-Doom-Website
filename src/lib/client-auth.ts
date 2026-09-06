"use client";

import { supabase } from "@/lib/supabase";

export type AppUser = {
  id: string;
  displayName: string;
  username: string;
  email: string | null;
};

export type AppSession = {
  user: AppUser;
  roles: string[];
  permissions: Record<string, "read" | "edit" | "full">;
  mode: "native" | "supabase";
  mustChangePassword: boolean;
};

const accessWeight = { none: 0, read: 1, edit: 2, full: 3 } as const;

export function hasAppPermission(
  session: AppSession | null,
  key: string,
  required: "read" | "edit" | "full" = "read",
) {
  const level = session?.permissions[key] || "none";
  return accessWeight[level] >= accessWeight[required];
}

export function usesNativeAuth() {
  return process.env.NEXT_PUBLIC_AUTH_BACKEND === "native";
}

export async function getAppAuthHeaders(): Promise<Record<string, string>> {
  if (usesNativeAuth()) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getAppSession(): Promise<AppSession | null> {
  const response = await fetch("/api/app-session", {
    cache: "no-store",
    credentials: "same-origin",
    headers: await getAppAuthHeaders(),
  });
  if (!response.ok) return null;
  return response.json() as Promise<AppSession>;
}

export async function signInToApp(identifier: string, password: string) {
  if (usesNativeAuth()) {
    const response = await fetch("/api/native-auth/sign-in/username", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: identifier.trim().toLowerCase(), password }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      return { error: body?.message || "Invalid username or password" };
    }
    return { error: null };
  }

  const { error } = await supabase.auth.signInWithPassword({ email: identifier.trim(), password });
  return { error: error?.message || null };
}

export async function signOutOfApp() {
  if (usesNativeAuth()) {
    await fetch("/api/native-auth/sign-out", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    return;
  }
  await supabase.auth.signOut();
}
