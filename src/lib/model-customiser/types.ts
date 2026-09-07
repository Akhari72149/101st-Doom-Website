export const PALETTE = ["#002700", "#790000", "#837B0F", "#464646", "#BE6B30"] as const;

export type PaintColour = (typeof PALETTE)[number];
export type EditorMode = "view" | "paint" | "logo";
export type ModelSource = "procedural" | "gltf";

export type UvPoint = { x: number; y: number };

export type PaintZoneDefinition = {
  id: string;
  name: string;
  meshNames: string[];
  baseColour: string;
  uvMask?: string;
};

export type LogoZoneDefinition = {
  id: string;
  name: string;
  meshNames: string[];
  minScale: number;
  maxScale: number;
};

export type ModelDefinition = {
  id: string;
  name: string;
  source: ModelSource;
  modelPath?: string;
  calibrationNotice?: string;
  paintZones: PaintZoneDefinition[];
  logoZones: LogoZoneDefinition[];
  cameraTarget: [number, number, number];
  cameraDistance: number;
};

export type RankModelRule = {
  modelId: string;
  rank: string;
  allowedPaintZones: string[];
  allowedLogoZones: string[];
  colourLimits?: Partial<Record<PaintColour, number>>;
};

export type ApprovedLogo = {
  id: string;
  name: string;
  path: string;
};

export type PaintStroke = {
  id: string;
  type: "stroke";
  zoneId: string;
  colour: PaintColour;
  size: number;
  points: UvPoint[];
};

export type LogoDecal = {
  id: string;
  type: "logo";
  zoneId: string;
  logoId: string;
  position: UvPoint;
  scale: number;
  rotation: number;
};

export type EditorAction = PaintStroke | LogoDecal;

export type CustomiserProject = {
  schemaVersion: 1;
  modelId: string;
  rank: string;
  actions: EditorAction[];
  createdAt: string;
  updatedAt: string;
};

export type ExportView = "front" | "back" | "left" | "right";

