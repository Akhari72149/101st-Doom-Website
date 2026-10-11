export const joinPageLinkDefinitions = [
  {
    key: "main-operations",
    label: "Main Operations Modlist",
    description: "Primary mod preset used for scheduled Main Operations.",
    defaultUrl: "https://cdn.discordapp.com/attachments/1284402204748546114/1471514051950546995/Yoaboa_V2.html?ex=69a44dc1&is=69a2fc41&hm=49e5d6f3aa76a25df6f05c45caa25c409fb46ddf4d09bb255d42f3638bb8a110&",
  },
  {
    key: "training",
    label: "Training Modlist",
    description: "Preset used by the training server and qualification sessions.",
    defaultUrl: "https://cdn.discordapp.com/attachments/1284402204748546114/1471514051463876649/Training_Server_Modlist_V2.html?ex=69a44dc1&is=69a2fc41&hm=aefc731a0722aa326446839465e28a8fb57ba1c899d9d8a67900c7efcd2431b0&",
  },
  {
    key: "fun-operations",
    label: "Fun Operation Modlist",
    description: "Preset used for unscheduled and community-led operations.",
    defaultUrl: "https://cdn.discordapp.com/attachments/1284402204748546114/1471514051036188756/Funop_Modlist_V5.html?ex=69a44dc1&is=69a2a4da&hm=00bd71791d9fe0b992652f1059345ec4e48c00210af1a93a972ad094bedd3b5f&",
  },
  {
    key: "fotm",
    label: "FOTM Modlist (WH 40k)",
    description: "Current featured mod preset for the rotating game mode.",
    defaultUrl: "https://cdn.discordapp.com/attachments/983174143400869898/1464716029312630987/101st_FOTM_40k_Rubicon.html?ex=69a3f65a&is=69a2a4da&hm=afb618de63df40618b068742e8af922f4d356dc14ec4a91018104ce5c9d9aae3&",
  },
  {
    key: "unit-whitelist",
    label: "Official Unit Whitelist",
    description: "Approved optional client-side mods for battalion servers.",
    defaultUrl: "https://steamcommunity.com/sharedfiles/filedetails/?id=3150345662",
  },
] as const;

export type JoinPageLinkKey = (typeof joinPageLinkDefinitions)[number]["key"];

export const defaultJoinPageLinks = Object.fromEntries(
  joinPageLinkDefinitions.map((definition) => [definition.key, definition.defaultUrl]),
) as Record<JoinPageLinkKey, string>;

export function isJoinPageLinkKey(value: string): value is JoinPageLinkKey {
  return joinPageLinkDefinitions.some((definition) => definition.key === value);
}
