import type { EditorAction, LogoDecal, PaintColour, PaintStroke, PaintZoneDefinition } from "./types";

export const TEXTURE_SIZE = 1024;
const COVERAGE_SIZE = 256;

function drawStroke(context: CanvasRenderingContext2D, stroke: PaintStroke, size: number) {
  if (stroke.points.length === 0) return;
  context.strokeStyle = stroke.colour;
  context.fillStyle = stroke.colour;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = Math.max(2, stroke.size * size);
  const first = stroke.points[0];
  context.beginPath();
  context.moveTo(first.x * size, first.y * size);
  for (const point of stroke.points.slice(1)) context.lineTo(point.x * size, point.y * size);
  if (stroke.points.length === 1) {
    context.arc(first.x * size, first.y * size, context.lineWidth / 2, 0, Math.PI * 2);
    context.fill();
  } else {
    context.stroke();
  }
}

function loadImage(path: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load approved logo: ${path}`));
    image.src = path;
  });
}

function drawLogo(context: CanvasRenderingContext2D, decal: LogoDecal, image: HTMLImageElement, size: number) {
  const width = decal.scale * size;
  const aspect = image.naturalHeight / Math.max(image.naturalWidth, 1);
  const height = width * aspect;
  context.save();
  context.translate(decal.position.x * size, decal.position.y * size);
  context.rotate((decal.rotation * Math.PI) / 180);
  context.drawImage(image, -width / 2, -height / 2, width, height);
  context.restore();
}

export function createZoneCanvas(zone: PaintZoneDefinition, size = TEXTURE_SIZE) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas 2D is unavailable");
  context.fillStyle = zone.baseColour;
  context.fillRect(0, 0, size, size);
  return canvas;
}

export async function renderZoneCanvas(
  canvas: HTMLCanvasElement,
  zone: PaintZoneDefinition,
  actions: EditorAction[],
  draft: PaintStroke | null,
  logoPaths: Record<string, string>,
) {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = zone.baseColour;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const relevant = [...actions, ...(draft ? [draft] : [])].filter((action) => action.zoneId === zone.id);
  for (const action of relevant) {
    if (action.type === "stroke") {
      drawStroke(context, action, canvas.width);
      continue;
    }
    const path = logoPaths[action.logoId];
    if (!path) continue;
    try {
      drawLogo(context, action, await loadImage(path), canvas.width);
    } catch {
      // A missing approved asset should not prevent paint from rendering.
    }
  }
}

function normaliseHex(hex: string) {
  return hex.replace("#", "").match(/.{2}/g)?.map((part) => Number.parseInt(part, 16)) ?? [0, 0, 0];
}

export function calculateColourCoverage(actions: EditorAction[], zoneIds: string[], colour: PaintColour) {
  const canvas = document.createElement("canvas");
  canvas.width = COVERAGE_SIZE;
  canvas.height = COVERAGE_SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || zoneIds.length === 0) return 0;
  const [red, green, blue] = normaliseHex(colour);
  let painted = 0;
  const total = COVERAGE_SIZE * COVERAGE_SIZE * zoneIds.length;
  for (const zoneId of zoneIds) {
    context.clearRect(0, 0, COVERAGE_SIZE, COVERAGE_SIZE);
    actions
      .filter((action): action is PaintStroke => action.type === "stroke" && action.zoneId === zoneId)
      .forEach((stroke) => drawStroke(context, stroke, COVERAGE_SIZE));
    const pixels = context.getImageData(0, 0, COVERAGE_SIZE, COVERAGE_SIZE).data;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] > 32 && Math.abs(pixels[index] - red) < 8 && Math.abs(pixels[index + 1] - green) < 8 && Math.abs(pixels[index + 2] - blue) < 8) painted += 1;
    }
  }
  return (painted / total) * 100;
}

export function makeActionId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

