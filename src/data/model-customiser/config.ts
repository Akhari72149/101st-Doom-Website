import type { ApprovedLogo, ModelDefinition, RankModelRule } from "@/lib/model-customiser/types";

export const MODEL_DEFINITIONS: ModelDefinition[] = [
  {
    id: "uv-calibration-armour",
    name: "Armour UV Calibration Rig",
    source: "procedural",
    calibrationNotice:
      "Calibration model active. Add an approved UV-mapped GLB and mesh mapping before production uniform use.",
    cameraTarget: [0, 1.35, 0],
    cameraDistance: 4.6,
    paintZones: [
      { id: "helmet", name: "Helmet", meshNames: ["helmet"], baseColour: "#d7dcda" },
      { id: "chest", name: "Chest plate", meshNames: ["chest"], baseColour: "#d7dcda" },
      { id: "back", name: "Back plate", meshNames: ["back"], baseColour: "#cbd1cf" },
      { id: "left-shoulder", name: "Left shoulder", meshNames: ["left-shoulder"], baseColour: "#d7dcda" },
      { id: "right-shoulder", name: "Right shoulder", meshNames: ["right-shoulder"], baseColour: "#d7dcda" },
      { id: "left-arm", name: "Left arm", meshNames: ["left-arm"], baseColour: "#cbd1cf" },
      { id: "right-arm", name: "Right arm", meshNames: ["right-arm"], baseColour: "#cbd1cf" },
      { id: "left-leg", name: "Left leg", meshNames: ["left-leg"], baseColour: "#cbd1cf" },
      { id: "right-leg", name: "Right leg", meshNames: ["right-leg"], baseColour: "#cbd1cf" },
    ],
    logoZones: [
      { id: "chest", name: "Chest plate", meshNames: ["chest"], minScale: 0.08, maxScale: 0.32 },
      { id: "back", name: "Back plate", meshNames: ["back"], minScale: 0.08, maxScale: 0.36 },
      { id: "left-shoulder", name: "Left shoulder", meshNames: ["left-shoulder"], minScale: 0.06, maxScale: 0.22 },
      { id: "right-shoulder", name: "Right shoulder", meshNames: ["right-shoulder"], minScale: 0.06, maxScale: 0.22 },
    ],
  },
];

export const RANKS = ["CT", "CS", "CSP", "CPL", "SGT", "CSM"] as const;

const shoulderZones = ["left-shoulder", "right-shoulder"];
const armZones = [...shoulderZones, "left-arm", "right-arm"];
const commandZones = ["helmet", "chest", "back", ...armZones, "left-leg", "right-leg"];

export const RANK_MODEL_RULES: RankModelRule[] = [
  { modelId: "uv-calibration-armour", rank: "CT", allowedPaintZones: shoulderZones, allowedLogoZones: [], colourLimits: { "#790000": 4, "#BE6B30": 6 } },
  { modelId: "uv-calibration-armour", rank: "CS", allowedPaintZones: armZones, allowedLogoZones: shoulderZones, colourLimits: { "#790000": 8, "#BE6B30": 10 } },
  { modelId: "uv-calibration-armour", rank: "CSP", allowedPaintZones: ["helmet", ...armZones], allowedLogoZones: shoulderZones, colourLimits: { "#790000": 12, "#837B0F": 12 } },
  { modelId: "uv-calibration-armour", rank: "CPL", allowedPaintZones: ["helmet", "chest", ...armZones], allowedLogoZones: ["chest", ...shoulderZones], colourLimits: { "#790000": 16 } },
  { modelId: "uv-calibration-armour", rank: "SGT", allowedPaintZones: commandZones, allowedLogoZones: ["chest", "back", ...shoulderZones], colourLimits: { "#790000": 22 } },
  { modelId: "uv-calibration-armour", rank: "CSM", allowedPaintZones: commandZones, allowedLogoZones: ["chest", "back", ...shoulderZones] },
];

export const APPROVED_LOGOS: ApprovedLogo[] = [
  { id: "doom-battalion", name: "101st Doom Battalion", path: "/icons/DBLogo.jpg" },
  { id: "dagger", name: "Dagger", path: "/WWA/Dagger.jpg" },
  { id: "hammer", name: "Hammer", path: "/WWA/Hammer.jpg" },
];

export function getRankRule(modelId: string, rank: string) {
  return RANK_MODEL_RULES.find((rule) => rule.modelId === modelId && rule.rank === rank) ?? null;
}

