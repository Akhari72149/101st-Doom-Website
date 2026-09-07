"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type ElementRef, type ForwardedRef } from "react";
import { Canvas, type ThreeEvent, useThree } from "@react-three/fiber";
import { Grid, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { APPROVED_LOGOS } from "@/data/model-customiser/config";
import { createZoneCanvas, makeActionId, renderZoneCanvas } from "@/lib/model-customiser/paint";
import type {
  EditorAction,
  EditorMode,
  ExportView,
  LogoDecal,
  ModelDefinition,
  PaintColour,
  PaintStroke,
  UvPoint,
} from "@/lib/model-customiser/types";

export type ModelViewerHandle = {
  resetCamera: () => void;
  exportViews: () => Promise<Record<ExportView, string>>;
};

type ViewerProps = {
  model: ModelDefinition;
  mode: EditorMode;
  actions: EditorAction[];
  draft: PaintStroke | null;
  brushColour: PaintColour;
  brushSize: number;
  activeLogoId: string;
  allowedPaintZones: string[];
  allowedLogoZones: string[];
  onDraftChange: (stroke: PaintStroke | null) => boolean;
  onCommitStroke: (stroke: PaintStroke) => void;
  onPlaceLogo: (decal: LogoDecal) => void;
  onRestricted: (zoneId: string) => void;
};

type TextureMap = Record<string, THREE.CanvasTexture>;

function useZoneTextures(model: ModelDefinition, actions: EditorAction[], draft: PaintStroke | null) {
  const textures = useMemo<TextureMap>(() => {
    return Object.fromEntries(
      model.paintZones.map((zone) => {
        const texture = new THREE.CanvasTexture(createZoneCanvas(zone));
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        return [zone.id, texture];
      }),
    );
  }, [model]);

  useEffect(() => {
    let cancelled = false;
    const logoPaths = Object.fromEntries(APPROVED_LOGOS.map((logo) => [logo.id, logo.path]));
    void Promise.all(
      model.paintZones.map(async (zone) => {
        const texture = textures[zone.id];
        if (!(texture.image instanceof HTMLCanvasElement)) return;
        await renderZoneCanvas(texture.image, zone, actions, draft?.zoneId === zone.id ? draft : null, logoPaths);
        if (!cancelled) texture.needsUpdate = true;
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [actions, draft, model.paintZones, textures]);

  useEffect(() => () => Object.values(textures).forEach((texture) => texture.dispose()), [textures]);
  return textures;
}

function uvPoint(event: ThreeEvent<PointerEvent>): UvPoint | null {
  if (!event.uv) return null;
  return { x: THREE.MathUtils.clamp(event.uv.x, 0, 1), y: THREE.MathUtils.clamp(1 - event.uv.y, 0, 1) };
}

function zoneForObject(model: ModelDefinition, object: THREE.Object3D) {
  return model.paintZones.find((zone) => zone.meshNames.includes(object.name))?.id ?? null;
}

function PaintedMaterial({ texture }: { texture: THREE.CanvasTexture }) {
  return <meshStandardMaterial map={texture} roughness={0.72} metalness={0.08} />;
}

function CalibrationArmour({ textures }: { textures: TextureMap }) {
  return (
    <group position={[0, 0.12, 0]}>
      <mesh name="helmet" position={[0, 2.62, 0]} scale={[0.47, 0.39, 0.43]} castShadow>
        <sphereGeometry args={[1, 48, 32]} />
        <PaintedMaterial texture={textures.helmet} />
      </mesh>
      <mesh position={[0, 2.52, 0.38]} scale={[0.34, 0.11, 0.08]}>
        <boxGeometry />
        <meshStandardMaterial color="#111918" metalness={0.2} roughness={0.45} />
      </mesh>
      <mesh name="chest" position={[0, 1.72, 0.18]} scale={[0.7, 0.76, 0.28]} castShadow>
        <boxGeometry args={[1, 1, 1, 4, 4, 4]} />
        <PaintedMaterial texture={textures.chest} />
      </mesh>
      <mesh name="back" position={[0, 1.72, -0.19]} scale={[0.66, 0.72, 0.2]} castShadow>
        <boxGeometry />
        <PaintedMaterial texture={textures.back} />
      </mesh>
      <mesh name="left-shoulder" position={[-0.86, 2.05, 0]} scale={[0.34, 0.31, 0.36]} castShadow>
        <sphereGeometry args={[1, 32, 24]} />
        <PaintedMaterial texture={textures["left-shoulder"]} />
      </mesh>
      <mesh name="right-shoulder" position={[0.86, 2.05, 0]} scale={[0.34, 0.31, 0.36]} castShadow>
        <sphereGeometry args={[1, 32, 24]} />
        <PaintedMaterial texture={textures["right-shoulder"]} />
      </mesh>
      <mesh name="left-arm" position={[-0.88, 1.43, 0]} scale={[0.22, 0.66, 0.22]} castShadow>
        <capsuleGeometry args={[1, 1.4, 16, 24]} />
        <PaintedMaterial texture={textures["left-arm"]} />
      </mesh>
      <mesh name="right-arm" position={[0.88, 1.43, 0]} scale={[0.22, 0.66, 0.22]} castShadow>
        <capsuleGeometry args={[1, 1.4, 16, 24]} />
        <PaintedMaterial texture={textures["right-arm"]} />
      </mesh>
      <mesh position={[0, 0.98, 0]} scale={[0.58, 0.18, 0.28]} castShadow>
        <boxGeometry />
        <meshStandardMaterial color="#26302e" roughness={0.8} />
      </mesh>
      <mesh name="left-leg" position={[-0.34, 0.29, 0]} scale={[0.27, 0.76, 0.29]} castShadow>
        <capsuleGeometry args={[1, 1.3, 16, 24]} />
        <PaintedMaterial texture={textures["left-leg"]} />
      </mesh>
      <mesh name="right-leg" position={[0.34, 0.29, 0]} scale={[0.27, 0.76, 0.29]} castShadow>
        <capsuleGeometry args={[1, 1.3, 16, 24]} />
        <PaintedMaterial texture={textures["right-leg"]} />
      </mesh>
    </group>
  );
}

function ImportedModel({ model, textures }: { model: ModelDefinition; textures: TextureMap }) {
  const gltf = useGLTF(model.modelPath ?? "") as unknown as { scene: THREE.Group };
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  useEffect(() => {
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const zone = model.paintZones.find((candidate) => candidate.meshNames.includes(object.name));
      if (!zone || !object.geometry.attributes.uv) return;
      const material = Array.isArray(object.material) ? object.material[0].clone() : object.material.clone();
      material.map = textures[zone.id];
      material.needsUpdate = true;
      object.material = material;
    });
  }, [model.paintZones, scene, textures]);
  return <primitive object={scene} />;
}

function SceneController({ apiRef, model, mode }: { apiRef: ForwardedRef<ModelViewerHandle>; model: ModelDefinition; mode: EditorMode }) {
  const { camera, gl, scene } = useThree();
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  useImperativeHandle(apiRef, () => ({
    resetCamera() {
      camera.position.set(0, model.cameraTarget[1], model.cameraDistance);
      camera.lookAt(...model.cameraTarget);
      controls.current?.target.set(...model.cameraTarget);
      controls.current?.update();
    },
    async exportViews() {
      const views: Record<ExportView, [number, number, number]> = {
        front: [0, model.cameraTarget[1], model.cameraDistance],
        back: [0, model.cameraTarget[1], -model.cameraDistance],
        left: [-model.cameraDistance, model.cameraTarget[1], 0],
        right: [model.cameraDistance, model.cameraTarget[1], 0],
      };
      const result = {} as Record<ExportView, string>;
      const previousPosition = camera.position.clone();
      const previousQuaternion = camera.quaternion.clone();
      const previousSize = gl.getSize(new THREE.Vector2());
      const previousRatio = gl.getPixelRatio();
      const perspective = camera as THREE.PerspectiveCamera;
      const previousAspect = perspective.aspect;
      const outputSize = window.innerWidth < 700 ? 1400 : 2048;
      gl.setPixelRatio(1);
      gl.setSize(outputSize, outputSize, false);
      perspective.aspect = 1;
      perspective.updateProjectionMatrix();
      for (const [name, position] of Object.entries(views) as [ExportView, [number, number, number]][]) {
        camera.position.set(...position);
        camera.lookAt(...model.cameraTarget);
        gl.render(scene, camera);
        result[name] = gl.domElement.toDataURL("image/png");
      }
      camera.position.copy(previousPosition);
      camera.quaternion.copy(previousQuaternion);
      perspective.aspect = previousAspect;
      perspective.updateProjectionMatrix();
      gl.setPixelRatio(previousRatio);
      gl.setSize(previousSize.x, previousSize.y, false);
      gl.render(scene, camera);
      return result;
    },
  }), [camera, gl, model, scene]);
  return <OrbitControls ref={controls} enabled={mode === "view"} makeDefault target={model.cameraTarget} minDistance={2.8} maxDistance={8} enablePan />;
}

function RenderProbe() {
  const { camera, gl, scene } = useThree();
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      gl.render(scene, camera);
      const context = gl.getContext();
      const width = gl.domElement.width;
      const height = gl.domElement.height;
      const samples = [[0.5, 0.5], [0.4, 0.52], [0.6, 0.52], [0.5, 0.7]].map(([x, y]) => {
        const pixel = new Uint8Array(4);
        context.readPixels(Math.floor(width * x), Math.floor(height * y), 1, 1, context.RGBA, context.UNSIGNED_BYTE, pixel);
        return Array.from(pixel).join(",");
      });
      gl.domElement.dataset.webglProbe = samples.join(";");
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [camera, gl, scene]);
  return null;
}

function EditorScene(props: ViewerProps & { apiRef: ForwardedRef<ModelViewerHandle> }) {
  const textures = useZoneTextures(props.model, props.actions, props.draft);
  const activeStroke = useRef<PaintStroke | null>(null);

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    const zoneId = zoneForObject(props.model, event.object);
    const point = uvPoint(event);
    if (!zoneId || !point || props.mode === "view") return;
    event.stopPropagation();
    if (props.mode === "logo") {
      if (!props.allowedLogoZones.includes(zoneId)) return props.onRestricted(zoneId);
      props.onPlaceLogo({ id: makeActionId("logo"), type: "logo", zoneId, logoId: props.activeLogoId, position: point, scale: 0.16, rotation: 0 });
      return;
    }
    if (!props.allowedPaintZones.includes(zoneId)) return props.onRestricted(zoneId);
    const stroke: PaintStroke = { id: makeActionId("stroke"), type: "stroke", zoneId, colour: props.brushColour, size: props.brushSize, points: [point] };
    if (props.onDraftChange(stroke)) activeStroke.current = stroke;
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    const stroke = activeStroke.current;
    const point = uvPoint(event);
    if (!stroke || !point || event.buttons !== 1) return;
    const zoneId = zoneForObject(props.model, event.object);
    if (zoneId !== stroke.zoneId) return;
    event.stopPropagation();
    const previous = stroke.points.at(-1);
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 0.003) return;
    const next = { ...stroke, points: [...stroke.points, point] };
    if (props.onDraftChange(next)) activeStroke.current = next;
  };

  const finishStroke = () => {
    if (activeStroke.current) props.onCommitStroke(activeStroke.current);
    activeStroke.current = null;
    props.onDraftChange(null);
  };

  return (
    <>
      <color attach="background" args={["#020706"]} />
      <ambientLight intensity={1.15} />
      <directionalLight position={[3, 6, 4]} intensity={2.5} castShadow />
      <directionalLight position={[-4, 2, -3]} intensity={1.1} color="#6dd8c1" />
      <group onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={finishStroke} onPointerLeave={finishStroke}>
        {props.model.source === "procedural" ? <CalibrationArmour textures={textures} /> : <ImportedModel model={props.model} textures={textures} />}
      </group>
      <Grid position={[0, -0.7, 0]} args={[10, 10]} cellColor="#0b4d35" sectionColor="#00d978" fadeDistance={9} fadeStrength={1.5} infiniteGrid />
      <SceneController apiRef={props.apiRef} model={props.model} mode={props.mode} />
      <RenderProbe />
    </>
  );
}

export const ModelViewer = forwardRef<ModelViewerHandle, ViewerProps>(function ModelViewer(props, ref) {
  return (
    <Canvas
      dpr={[1, 1.7]}
      camera={{ position: [0, props.model.cameraTarget[1], props.model.cameraDistance], fov: 36, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      shadows
      onCreated={({ gl }) => {
        gl.setClearColor("#020706", 1);
        gl.domElement.setAttribute("data-webgl-probe", "initialised");
      }}
      style={{ touchAction: props.mode === "view" ? "none" : "pinch-zoom" }}
    >
      <EditorScene {...props} apiRef={ref} />
    </Canvas>
  );
});
