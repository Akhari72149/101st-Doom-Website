export const accountRoleTagDefinitions = [
  {
    key: "trainer",
    label: "Trainer",
    className: "border-cyan-400/40 bg-cyan-400/10 text-cyan-300",
  },
  {
    key: "nco",
    label: "NCO",
    className: "border-amber-300/40 bg-amber-300/10 text-amber-200",
  },
  {
    key: "recruiter",
    label: "Recruiter",
    className: "border-violet-400/40 bg-violet-400/10 text-violet-300",
  },
  {
    key: "drill-instructor",
    label: "Drill Instructor",
    className: "border-orange-400/40 bg-orange-400/10 text-orange-300",
  },
  {
    key: "server-maintenance",
    label: "Server Maintenance",
    className: "border-blue-400/40 bg-blue-400/10 text-blue-300",
  },
] as const;

export type AccountRoleTag = (typeof accountRoleTagDefinitions)[number]["key"];

export const accountRoleTagKeys = new Set<string>(
  accountRoleTagDefinitions.map((definition) => definition.key),
);

export function getAccountRoleTagDefinition(tag: string) {
  return accountRoleTagDefinitions.find((definition) => definition.key === tag);
}
