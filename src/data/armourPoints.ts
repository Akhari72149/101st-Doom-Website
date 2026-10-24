export const armourRankPoints: Record<string, { points: number; unrestricted?: boolean }> = {
  CR:{points:0},"CR-C":{points:0},CT:{points:0},PTC:{points:20},PSC:{points:20},PFC:{points:20},CST:{points:20},
  VCT:{points:32},CSP:{points:32},CTS:{points:32},LCP:{points:32},CP:{points:32},
  CSC:{points:38},CPS:{points:38},CVC:{points:38},CMC:{points:38},CFC:{points:38},LCS:{points:38},CS:{points:38},
  CSS:{points:70},CGS:{points:70},CMS:{points:70},CFS:{points:70},CSM:{points:70},SSM:{points:140},BSM:{points:0},
  CE:{points:140},
  "clone 2nd lieutenant":{points:140},"clone 1st lieutenant":{points:0},"clone captain":{points:0,unrestricted:true},
  "cmaj.":{points:0,unrestricted:true},"clone commander":{points:0,unrestricted:true},
  "clone battalion commander":{points:0,unrestricted:true},BC:{points:0,unrestricted:true},
  CXC:{points:0},CX:{points:20},CVX:{points:32},CXX:{points:32},CXT:{points:32},CXP:{points:32},
  CXS:{points:38},"CX-S":{points:38},CXSS:{points:70},CXMS:{points:70},CXM:{points:70},"CX-M":{points:70},
  CXO:{points:0,unrestricted:true},
};

export type ArmourRankPointConfig = { points: number; unrestricted?: boolean };
export type ArmourRankAllocation = {
  points: number;
  unrestricted: boolean;
  configured: boolean;
  breakdown: Array<{ rank_name: string; points: number }>;
};

const standardArmourRoute = [
  ["CR"], ["CR-C"], ["CT"], ["PTC"], ["PSC"], ["PFC"], ["CST", "SCT"],
  ["VCT", "CVT"], ["CSP"], ["CTS"], ["LCP"], ["CP"], ["CSC", "CPS"],
  ["CVC"], ["CMC"], ["CFC"], ["LCS"], ["CS"], ["CSS"], ["CGS"], ["CMS"],
  ["CFS"], ["CSM"], ["SSM"], ["BSM"], ["CE", "Clone Ensign"],
  ["Clone 2nd Lieutenant"], ["Clone 1st Lieutenant"], ["Clone Captain"], ["CMaj."],
  ["Clone Commander"], ["Clone Battalion Commander", "BC"],
];

const normaliseRank = (value: string) => value.trim().toLowerCase();

const pilotStandardEquivalents: Record<string, string> = {
  sct: "CST",
  cvt: "VCT",
  cps: "CSC",
  cxc: "CT",
  "cx-c": "CT",
  cx: "PSC",
  csx: "CST",
  cvx: "VCT",
  "cx-v": "VCT",
  cxx: "CSP",
  "cx-x": "CSP",
  cxt: "CTS",
  "cx-t": "CTS",
  cxp: "CP",
  "cx-p": "CP",
  cxs: "CS",
  "cx-s": "CS",
  cxss: "CSS",
  "cx-ss": "CSS",
  cxms: "CGS",
  "cx-ms": "CGS",
  cxm: "CSM",
  "cx-m": "CSM",
  cxo: "CSM",
};

export function getArmourStandardEquivalent(rankName: string | null | undefined) {
  return pilotStandardEquivalents[normaliseRank(String(rankName || ""))] || null;
}

export function getArmourRankAllocation(
  rankName: string | null | undefined,
  configuredValues: Record<string, ArmourRankPointConfig> = armourRankPoints,
): ArmourRankAllocation {
  const currentName = String(rankName || "").trim();
  if (!currentName) return { points: 0, unrestricted: false, configured: false, breakdown: [] };

  const values = new Map(Object.entries(configuredValues).map(([name, value]) => [normaliseRank(name), value]));
  const currentKey = normaliseRank(currentName);
  const currentConfig = values.get(currentKey);
  const allocationKey = normaliseRank(getArmourStandardEquivalent(currentName) || currentName);
  const allocationConfig = values.get(allocationKey);
  const route = standardArmourRoute;
  const currentStage = route.findIndex((stage) =>
    stage.some((name) => normaliseRank(name) === allocationKey));

  if (currentStage < 0) {
    return {
      points: currentConfig?.points || 0,
      unrestricted: Boolean(currentConfig?.unrestricted),
      configured: Boolean(currentConfig),
      breakdown: currentConfig && currentConfig.points > 0 ? [{ rank_name: currentName, points: currentConfig.points }] : [],
    };
  }

  const breakdown = route.slice(0, currentStage + 1).flatMap((stage) => {
    const candidates = stage.flatMap((name) => {
      const value = values.get(normaliseRank(name));
      return value ? [{ rank_name: name, points: value.points }] : [];
    });
    if (!candidates.length) return [];
    const award = candidates.reduce((best, candidate) => candidate.points > best.points ? candidate : best);
    return award.points > 0 ? [award] : [];
  });

  return {
    points: breakdown.reduce((total, entry) => total + entry.points, 0),
    unrestricted: Boolean(currentConfig?.unrestricted),
    configured: Boolean(allocationConfig),
    breakdown,
  };
}

const armourRankProgression: Record<string, number> = {
  CR:0,"CR-C":0,CT:0,PTC:0,PSC:0,PFC:0,CXC:0,"CX-C":0,CX:0,
  CST:10,SCT:10,CSX:10,VCT:20,CVX:20,"CX-V":20,CSP:30,CXX:30,"CX-X":30,CTS:40,CXT:40,"CX-T":40,LCP:50,
  CP:60,CXP:60,"CX-P":60,CSC:70,CPS:70,CVC:80,CMC:90,CFC:100,LCS:110,
  CS:120,CXS:120,"CX-S":120,CSS:130,CXSS:130,"CX-SS":130,CGS:140,CXMS:140,"CX-MS":140,
  CMS:150,CFS:160,CSM:170,CXM:170,"CX-M":170,SSM:180,
  CE:190,"Clone Ensign":190,"Clone 2nd Lieutenant":200,"Clone 1st Lieutenant":210,
  "Clone Captain":220,"CMaj.":230,"Clone Commander":240,"Clone Battalion Commander":250,BC:250,CXO:250,
};

const armourRequirementLevel: Record<string, number> = { "CST+":10,"VCT+":20,"CTS+":40,"CP+":60,"CS+":120,"CSM+":170,"SSM+":180,"Clone 2nd Lieutenant+":200 };
const commandRanks = new Set(["Clone Captain","CMaj.","Clone Commander","Clone Battalion Commander","BC","CXO"]);

export function meetsArmourRankRequirement(rankName: string | null | undefined, requirement: string | null | undefined, unrestricted = false) {
  if (unrestricted || !requirement) return true;
  const rank = String(rankName || "").trim();
  if (requirement === "Authorised command ranks") return commandRanks.has(rank);
  const requiredLevel = armourRequirementLevel[requirement];
  return requiredLevel !== undefined && (armourRankProgression[rank] ?? -1) >= requiredLevel;
}

export const armourPointSourcePreview = [
  ["certification-trainer","Certification Trainer","S-Shop appointment",10],
  ["certification-lead","Certification Lead","S-Shop appointment",20],
  ["zeus","Zeus","S-Shop appointment",10],["senior-zeus","Senior Zeus","S-Shop appointment",20],
  ["mission-builder","Mission Builder","S-Shop appointment",30],["senior-mission-builder","Senior Mission Builder","S-Shop appointment",50],
  ["media-team-member","Media Team Member","S-Shop appointment",10],["media-team-manager","Media Team Manager","S-Shop appointment",20],
  ["media-team-lead","Media Team Lead","S-Shop appointment",30],["gc-flex-zeus","GC Flex Zeus","C-Shop appointment",20],
  ["gc-zeus","GC Zeus","C-Shop appointment",40],["gc-team-manager","GC Team Manager","C-Shop appointment",50],
  ["gc-lead","GC Lead","C-Shop appointment",60],["mod-team-member","Mod Team Member","C-Shop appointment",30],
  ["mod-team-manager","Mod Team Manager","C-Shop appointment",40],["mod-team-lead","Mod Team Lead","C-Shop appointment",50],
  ["recruiter","Recruiter","C-Shop appointment",10],["senior-recruiter","Senior Recruiter","C-Shop appointment",20],
  ["recruitment-xo","Recruitment XO","C-Shop appointment",30],["recruitment-lead","Recruitment Lead","C-Shop appointment",40],
  ["drill-instructor","Drill Instructor","C-Shop appointment",10],["drill-instructor-xo","Drill Instructor XO","C-Shop appointment",30],
  ["drill-instructor-lead","Drill Instructor Lead","C-Shop appointment",40],
].map(([id,name,category,points])=>({id:String(id),name:String(name),category:String(category),points:Number(points)}));

export const armourItemPreview = [
  ["initial-helmet","Initial Helmet Custom","Rank equipment",80,"CST+","Initial helmet customisation. Sheet note: 80 points."],
  ["partial-helmet","Partial Helmet Custom (No Visor)","Rank equipment",160,"CP+","Partial helmet customisation without a custom visor. Sheet note: 160 points."],
  ["full-helmet","Full Helmet Custom (No Visor)","Rank equipment",228,"CS+","Full helmet customisation without a custom visor. Sheet note: 228 points."],
  ["full-helmet-visor","Full Helmet Custom with Visor / Partial Armour","Rank equipment",350,"CSM+","Full helmet and visor with partial armour customisation. Sheet note: 350 points."],
  ["officer-package","Full Helmet, Armour, Kama and Partial Pauldron","Rank equipment",420,"Clone 2nd Lieutenant+","Officer customisation package. Sheet note: 420 points."],
  ["full-everything","Full Customisation","Rank equipment",0,"Authorised command ranks","Full armour customisation entitlement."],
  ["custom-visor","Custom Visor","S-Shop",100,"CTS+","One custom visor."],
  ["armour-edits","Armour Edits / Logo or Designs","S-Shop",150,"VCT+","Armour edits, logo, or design work."],
  ["partial-custom-armour","Partial Custom Armour","S-Shop",200,"VCT+","Partial custom armour package."],
  ["custom-armour","Custom Armour","S-Shop",250,"VCT+","Full custom armour package."],
  ["custom-kama","Custom Kama","S-Shop",200,"VCT+","One custom kama."],
  ["custom-pauldron","Custom Pauldron","Rank equipment",0,"SSM+","Custom pauldron unlocked by rank."],
  ["additional-logo","Additional Logo (Complex)","S-Shop",40,null,"Additional complex logo, charged per design."],
  ["additional-design","Additional Design (Simple)","S-Shop",20,null,"Additional simple design, charged per design."],
  ["colour-unlock","Colour Unlock (Non-MOS)","S-Shop",250,"VCT+","Unlock a non-MOS armour colour."],
].map(([id,name,category,point_cost,rank_requirement,description])=>({id:String(id),name:String(name),category:String(category),point_cost:Number(point_cost),rank_requirement:rank_requirement?String(rank_requirement):null,description:String(description)}));
