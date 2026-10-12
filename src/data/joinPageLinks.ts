export const joinPageLinkDefinitions = [
  {
    key: "main-operations",
    label: "Main Operations Modlist",
    description: "Published mod preset used by Server 1 for Main Operations and training.",
    uploadEnabled: true,
    defaultUrl: "https://cdn.discordapp.com/attachments/1284402204748546114/1471514051950546995/Yoaboa_V2.html?ex=69a44dc1&is=69a2fc41&hm=49e5d6f3aa76a25df6f05c45caa25c409fb46ddf4d09bb255d42f3638bb8a110&",
  },
  {
    key: "fun-operations",
    label: "Fun Operation Modlist",
    description: "Published mod preset used by Server 2.",
    uploadEnabled: true,
    defaultUrl: "https://cdn.discordapp.com/attachments/1284402204748546114/1471514051036188756/Funop_Modlist_V5.html?ex=69a44dc1&is=69a2a4da&hm=00bd71791d9fe0b992652f1059345ec4e48c00210af1a93a972ad094bedd3b5f&",
  },
  {
    key: "unit-whitelist",
    label: "Official Unit Whitelist",
    description: "Approved optional client-side mods for battalion servers.",
    uploadEnabled: false,
    defaultUrl: "https://steamcommunity.com/sharedfiles/filedetails/?id=3150345662",
  },
] as const;

export type JoinPageLinkKey = (typeof joinPageLinkDefinitions)[number]["key"];
export type JoinModlistKey = Extract<JoinPageLinkKey, "main-operations" | "fun-operations">;

export const defaultJoinPageLinks = Object.fromEntries(
  joinPageLinkDefinitions.map((definition) => [definition.key, definition.defaultUrl]),
) as Record<JoinPageLinkKey, string>;

export function isJoinPageLinkKey(value: string): value is JoinPageLinkKey {
  return joinPageLinkDefinitions.some((definition) => definition.key === value);
}

export function isJoinModlistKey(value: string): value is JoinModlistKey {
  return value === "main-operations" || value === "fun-operations";
}
