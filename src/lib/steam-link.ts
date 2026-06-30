import "server-only";

import { randomBytes, createHash, timingSafeEqual } from "crypto";

export const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";
export const STEAM_LINK_SESSION_COOKIE = "doom_steam_link_session";
export const STEAM_LINK_SESSION_SECONDS = 30 * 60;
export const STEAM_OPENID_NS = "http://specs.openid.net/auth/2.0";
export const STEAM_IDENTIFIER_SELECT =
  "http://specs.openid.net/auth/2.0/identifier_select";

export type SteamProfile = {
  id: string;
  displayName: string | null;
  profileUrl: string | null;
  avatarUrl: string | null;
};

export function getSiteUrl() {
  const siteUrl = process.env.SITE_URL?.trim();

  if (!siteUrl) {
    throw new Error("Missing required environment variable: SITE_URL");
  }

  return siteUrl.replace(/\/+$/, "");
}

export function createOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function constantTimeCompare(a: string, b: string) {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function getSteamCallbackUrl(state: string) {
  const callbackUrl = new URL("/api/steam/link/callback", getSiteUrl());
  callbackUrl.searchParams.set("state", state);
  return callbackUrl.toString();
}

export function getSteamRealm() {
  return new URL(getSiteUrl()).origin;
}

export function getSteamLoginUrl(state: string) {
  const loginUrl = new URL(STEAM_OPENID_ENDPOINT);

  loginUrl.searchParams.set("openid.ns", STEAM_OPENID_NS);
  loginUrl.searchParams.set("openid.mode", "checkid_setup");
  loginUrl.searchParams.set("openid.identity", STEAM_IDENTIFIER_SELECT);
  loginUrl.searchParams.set("openid.claimed_id", STEAM_IDENTIFIER_SELECT);
  loginUrl.searchParams.set("openid.return_to", getSteamCallbackUrl(state));
  loginUrl.searchParams.set("openid.realm", getSteamRealm());

  return loginUrl.toString();
}

export function getSteamCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STEAM_LINK_SESSION_SECONDS,
  };
}

export function getExpiredSteamCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}

function requireOpenIdValue(params: URLSearchParams, key: string, expected: string) {
  return params.get(key) === expected;
}

export async function verifySteamOpenIdResponse(
  params: URLSearchParams,
  expectedReturnTo: string,
) {
  const claimedId = params.get("openid.claimed_id") || "";
  const identity = params.get("openid.identity") || "";

  if (
    !requireOpenIdValue(params, "openid.ns", STEAM_OPENID_NS) ||
    !requireOpenIdValue(params, "openid.mode", "id_res") ||
    !requireOpenIdValue(params, "openid.op_endpoint", STEAM_OPENID_ENDPOINT) ||
    !requireOpenIdValue(params, "openid.return_to", expectedReturnTo) ||
    !constantTimeCompare(params.get("openid.return_to") || "", expectedReturnTo) ||
    !constantTimeCompare(identity, claimedId)
  ) {
    throw new Error("Invalid Steam OpenID response");
  }

  const match = claimedId.match(
    /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/,
  );

  if (!match || identity !== claimedId) {
    throw new Error("Invalid Steam claimed identity");
  }

  const verification = new URLSearchParams();

  for (const [key, value] of params.entries()) {
    if (key.startsWith("openid.")) {
      verification.set(key, value);
    }
  }

  verification.set("openid.mode", "check_authentication");

  const response = await fetch(STEAM_OPENID_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: verification.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Steam OpenID verification failed");
  }

  const body = await response.text();

  if (!/(^|\n)is_valid:true(\n|$)/.test(body)) {
    throw new Error("Steam OpenID response was not valid");
  }

  return match[1];
}

export async function getSteamPublicProfile(steamId: string): Promise<SteamProfile> {
  const fallbackProfileUrl = `https://steamcommunity.com/profiles/${steamId}`;
  const apiKey = process.env.STEAM_WEB_API_KEY?.trim();

  if (!apiKey) {
    return {
      id: steamId,
      displayName: null,
      profileUrl: fallbackProfileUrl,
      avatarUrl: null,
    };
  }

  try {
    const url = new URL(
      "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/",
    );
    url.searchParams.set("key", apiKey);
    url.searchParams.set("steamids", steamId);

    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Steam profile lookup failed");
    }

    const data = (await response.json()) as {
      response?: {
        players?: Array<{
          steamid?: string;
          personaname?: string;
          profileurl?: string;
          avatarfull?: string;
          avatarmedium?: string;
        }>;
      };
    };

    const player = data.response?.players?.find((entry) => entry.steamid === steamId);

    if (!player) {
      throw new Error("Steam profile not found");
    }

    return {
      id: steamId,
      displayName: player.personaname || null,
      profileUrl: player.profileurl || fallbackProfileUrl,
      avatarUrl: player.avatarfull || player.avatarmedium || null,
    };
  } catch {
    return {
      id: steamId,
      displayName: null,
      profileUrl: fallbackProfileUrl,
      avatarUrl: null,
    };
  }
}
