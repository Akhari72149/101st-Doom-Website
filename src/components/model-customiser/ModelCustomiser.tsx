"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import {
  Brush,
  Camera,
  Download,
  Eye,
  FileDown,
  FileUp,
  ImagePlus,
  LockKeyhole,
  Redo2,
  RotateCcw,
  Trash2,
  Undo2,
} from "lucide-react";
import { APPROVED_LOGOS, getRankRule, MODEL_DEFINITIONS, RANKS } from "@/data/model-customiser/config";
import { calculateColourCoverage } from "@/lib/model-customiser/paint";
import { buildProject, downloadFile, parseProject } from "@/lib/model-customiser/project-state";
import { PALETTE, type EditorAction, type EditorMode, type LogoDecal, type PaintColour, type PaintStroke } from "@/lib/model-customiser/types";
import { ModelViewer, type ModelViewerHandle } from "./ModelViewer";
import styles from "./model-customiser.module.css";

const COLOUR_NAMES: Record<PaintColour, string> = {
  "#002700": "Green",
  "#790000": "Red",
  "#837B0F": "Yellow",
  "#464646": "Grey",
  "#BE6B30": "Orange",
};

function dataUrlDownload(name: string, url: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
}

export default function ModelCustomiser() {
  const viewerRef = useRef<ModelViewerHandle>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [modelId, setModelId] = useState(MODEL_DEFINITIONS[0].id);
  const [rank, setRank] = useState<(typeof RANKS)[number]>("CT");
  const [mode, setMode] = useState<EditorMode>("view");
  const [colour, setColour] = useState<PaintColour>(PALETTE[0]);
  const [brushSize, setBrushSize] = useState(0.035);
  const [logoId, setLogoId] = useState(APPROVED_LOGOS[0].id);
  const [actions, setActions] = useState<EditorAction[]>([]);
  const [past, setPast] = useState<EditorAction[][]>([]);
  const [future, setFuture] = useState<EditorAction[][]>([]);
  const [draft, setDraft] = useState<PaintStroke | null>(null);
  const [selectedLogoActionId, setSelectedLogoActionId] = useState<string | null>(null);
  const [projectCreatedAt, setProjectCreatedAt] = useState<string>();
  const [notice, setNotice] = useState("View mode active. Rotate and inspect the armour.");
  const [exporting, setExporting] = useState(false);

  const model = MODEL_DEFINITIONS.find((item) => item.id === modelId) ?? MODEL_DEFINITIONS[0];
  const rule = getRankRule(model.id, rank);
  const allowedPaintZones = useMemo(() => rule?.allowedPaintZones ?? [], [rule]);
  const allowedLogoZones = useMemo(() => rule?.allowedLogoZones ?? [], [rule]);
  const selectedLogo = actions.find((action): action is LogoDecal => action.type === "logo" && action.id === selectedLogoActionId) ?? null;
  const placedLogos = actions.filter((action): action is LogoDecal => action.type === "logo");

  const coverage = useMemo(() => {
    return Object.fromEntries(PALETTE.map((paintColour) => [paintColour, calculateColourCoverage(actions, allowedPaintZones, paintColour)])) as Record<PaintColour, number>;
  }, [actions, allowedPaintZones]);

  const commit = (next: EditorAction[], message: string) => {
    setPast((items) => [...items.slice(-49), actions]);
    setActions(next);
    setFuture([]);
    setNotice(message);
  };

  const changeModel = (nextModelId: string) => {
    setModelId(nextModelId);
    setActions([]);
    setPast([]);
    setFuture([]);
    setSelectedLogoActionId(null);
    setProjectCreatedAt(undefined);
    setNotice("Model changed. Customisation history was reset.");
  };

  const changeRank = (nextRank: (typeof RANKS)[number]) => {
    setRank(nextRank);
    setNotice(`Rank rules changed to ${nextRank}. Existing paint remains visible; new actions use the new restrictions.`);
  };

  const handleDraftChange = (candidate: PaintStroke | null) => {
    if (!candidate) {
      setDraft(null);
      return true;
    }
    if (!allowedPaintZones.includes(candidate.zoneId)) {
      setNotice("Restricted zone. This rank cannot paint that surface.");
      return false;
    }
    const limit = rule?.colourLimits?.[candidate.colour];
    if (typeof limit === "number") {
      const candidateCoverage = calculateColourCoverage([...actions, candidate], allowedPaintZones, candidate.colour);
      if (candidateCoverage > limit) {
        setNotice(`${COLOUR_NAMES[candidate.colour]} coverage limit reached for ${rank}.`);
        return false;
      }
    }
    setDraft(candidate);
    return true;
  };

  const undo = () => {
    const previous = past.at(-1);
    if (!previous) return;
    setFuture((items) => [actions, ...items].slice(0, 50));
    setActions(previous);
    setPast((items) => items.slice(0, -1));
    setSelectedLogoActionId(null);
    setNotice("Last customisation action undone.");
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setPast((items) => [...items, actions].slice(-50));
    setActions(next);
    setFuture((items) => items.slice(1));
    setNotice("Customisation action restored.");
  };

  const updateSelectedLogo = (patch: Partial<LogoDecal>) => {
    if (!selectedLogo) return;
    const next = actions.map((action) => action.id === selectedLogo.id ? { ...action, ...patch } as LogoDecal : action);
    commit(next, "Logo placement updated.");
  };

  const exportProject = () => {
    const project = buildProject(model.id, rank, actions, projectCreatedAt);
    setProjectCreatedAt(project.createdAt);
    downloadFile(`${model.id}-${rank.toLowerCase()}.nexus-customiser.json`, JSON.stringify(project, null, 2), "application/json");
    setNotice("Editable project exported.");
  };

  const importProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const project = parseProject(await file.text());
      if (!MODEL_DEFINITIONS.some((item) => item.id === project.modelId) || !RANKS.includes(project.rank as (typeof RANKS)[number])) {
        throw new Error("The project references a model or rank unavailable in this build.");
      }
      setModelId(project.modelId);
      setRank(project.rank as (typeof RANKS)[number]);
      setActions(project.actions);
      setPast([]);
      setFuture([]);
      setProjectCreatedAt(project.createdAt);
      setSelectedLogoActionId(null);
      setNotice(`Imported ${file.name}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Project import failed.");
    }
  };

  const exportRenders = async () => {
    if (!viewerRef.current || exporting) return;
    setExporting(true);
    setNotice("Rendering four deterministic views...");
    try {
      const views = await viewerRef.current.exportViews();
      for (const [view, url] of Object.entries(views)) dataUrlDownload(`${model.id}-${rank.toLowerCase()}-${view}.png`, url);
      setNotice("Front, back, left and right PNG renders exported.");
    } catch {
      setNotice("PNG export failed. Try again with hardware acceleration enabled.");
    } finally {
      setExporting(false);
    }
  };

  const resetAll = () => {
    if (actions.length) commit([], "Model and customisation reset.");
    viewerRef.current?.resetCamera();
    setSelectedLogoActionId(null);
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Nexus Fabricator</p>
          <h1>Model Customiser</h1>
          <p className={styles.intro}>Paint approved UV zones, place unit insignia, and export a consistent four-view reference set.</p>
        </div>
        <div className={styles.headerStatus}><span /> Local project mode</div>
      </header>

      <section className={styles.workspace}>
        <div className={styles.viewerPanel}>
          <div className={styles.viewerTopbar}>
            <div>
              <span className={styles.smallLabel}>Active model</span>
              <strong>{model.name}</strong>
            </div>
            <button className={styles.iconButton} onClick={() => viewerRef.current?.resetCamera()} title="Reset camera" aria-label="Reset camera"><Camera size={19} /></button>
          </div>
          <div className={`${styles.viewer} ${styles[`mode-${mode}`]}`}>
            <ModelViewer
              ref={viewerRef}
              model={model}
              mode={mode}
              actions={actions}
              draft={draft}
              brushColour={colour}
              brushSize={brushSize}
              activeLogoId={logoId}
              allowedPaintZones={allowedPaintZones}
              allowedLogoZones={allowedLogoZones}
              onDraftChange={handleDraftChange}
              onCommitStroke={(stroke) => commit([...actions, stroke], `Paint applied to ${model.paintZones.find((zone) => zone.id === stroke.zoneId)?.name ?? stroke.zoneId}.`)}
              onPlaceLogo={(decal) => { commit([...actions, decal], "Approved logo placed."); setSelectedLogoActionId(decal.id); }}
              onRestricted={(zoneId) => setNotice(`${model.paintZones.find((zone) => zone.id === zoneId)?.name ?? "Surface"} is restricted for ${rank}.`)}
            />
            <div className={styles.viewerBadge}>{mode === "view" ? "Drag to rotate / wheel to zoom" : mode === "paint" ? "Draw directly on an allowed surface" : "Tap an allowed surface to place insignia"}</div>
          </div>
          <div className={styles.modeBar} aria-label="Editor mode">
            <button className={mode === "view" ? styles.activeMode : ""} onClick={() => { setMode("view"); setNotice("View mode active. Rotate and inspect the armour."); }}><Eye size={18} /> View</button>
            <button className={mode === "paint" ? styles.activeMode : ""} onClick={() => { setMode("paint"); setNotice("Paint mode active. Camera rotation is paused while drawing."); }}><Brush size={18} /> Paint</button>
            <button className={mode === "logo" ? styles.activeMode : ""} onClick={() => { setMode("logo"); setNotice("Logo mode active. Select an approved insignia, then tap an allowed zone."); }}><ImagePlus size={18} /> Logo</button>
          </div>
          <div className={styles.notice} role="status">{notice}</div>
        </div>

        <aside className={styles.controls}>
          <section className={styles.controlSection}>
            <h2>Loadout</h2>
            <label>Model<select value={model.id} onChange={(event) => changeModel(event.target.value)}>{MODEL_DEFINITIONS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>Rank<select value={rank} onChange={(event) => changeRank(event.target.value as (typeof RANKS)[number])}>{RANKS.map((item) => <option key={item}>{item}</option>)}</select></label>
            {model.calibrationNotice && <p className={styles.calibration}><LockKeyhole size={16} />{model.calibrationNotice}</p>}
          </section>

          <section className={styles.controlSection}>
            <div className={styles.sectionHeading}><h2>Paint</h2><span>{Math.round(brushSize * 1000)} px</span></div>
            <div className={styles.swatches}>{PALETTE.map((item) => <button key={item} type="button" className={colour === item ? styles.selectedSwatch : ""} style={{ "--swatch": item } as React.CSSProperties} onClick={() => setColour(item)} title={COLOUR_NAMES[item]} aria-label={COLOUR_NAMES[item]} />)}</div>
            <label>Brush size<input type="range" min="0.008" max="0.09" step="0.002" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} /></label>
            <div className={styles.zoneGrid}>{model.paintZones.map((zone) => <span key={zone.id} className={allowedPaintZones.includes(zone.id) ? styles.zoneAllowed : styles.zoneRestricted}>{allowedPaintZones.includes(zone.id) ? "Allowed" : "Locked"}<strong>{zone.name}</strong></span>)}</div>
          </section>

          <section className={styles.controlSection}>
            <h2>Coverage</h2>
            <div className={styles.coverageList}>{PALETTE.map((item) => { const limit = rule?.colourLimits?.[item]; const used = coverage[item]; return <div key={item} className={styles.coverageRow}><div><i style={{ background: item }} /><span>{COLOUR_NAMES[item]}</span><b>{used.toFixed(1)}%{typeof limit === "number" ? ` / ${limit}%` : ""}</b></div><progress max={typeof limit === "number" ? limit : 100} value={Math.min(used, limit ?? 100)} /></div>; })}</div>
          </section>

          <section className={styles.controlSection}>
            <h2>Approved Logos</h2>
            <div className={styles.logoGrid}>{APPROVED_LOGOS.map((logo) => <button key={logo.id} className={logoId === logo.id ? styles.selectedLogo : ""} onClick={() => setLogoId(logo.id)}><Image src={logo.path} alt="" width={96} height={96} /><span>{logo.name}</span></button>)}</div>
            {placedLogos.length > 0 && <label>Placed logo<select value={selectedLogoActionId ?? ""} onChange={(event) => setSelectedLogoActionId(event.target.value)}><option value="" disabled>Select a placed logo</option>{placedLogos.map((decal, index) => <option key={decal.id} value={decal.id}>{APPROVED_LOGOS.find((logo) => logo.id === decal.logoId)?.name ?? decal.logoId} · {model.paintZones.find((zone) => zone.id === decal.zoneId)?.name ?? decal.zoneId} {index + 1}</option>)}</select></label>}
            {selectedLogo && <div className={styles.logoEditor}><div className={styles.sectionHeading}><strong>Selected logo</strong><button className={styles.dangerIcon} onClick={() => { commit(actions.filter((action) => action.id !== selectedLogo.id), "Logo removed."); setSelectedLogoActionId(null); }} title="Remove logo"><Trash2 size={17} /></button></div><label>Horizontal position<input type="range" min="0.08" max="0.92" step="0.01" value={selectedLogo.position.x} onChange={(event) => updateSelectedLogo({ position: { ...selectedLogo.position, x: Number(event.target.value) } })} /></label><label>Vertical position<input type="range" min="0.08" max="0.92" step="0.01" value={selectedLogo.position.y} onChange={(event) => updateSelectedLogo({ position: { ...selectedLogo.position, y: Number(event.target.value) } })} /></label><label>Scale<input type="range" min="0.06" max="0.36" step="0.01" value={selectedLogo.scale} onChange={(event) => updateSelectedLogo({ scale: Number(event.target.value) })} /></label><label>Rotation<input type="range" min="-180" max="180" step="5" value={selectedLogo.rotation} onChange={(event) => updateSelectedLogo({ rotation: Number(event.target.value) })} /></label></div>}
          </section>

          <section className={styles.controlSection}>
            <h2>Project</h2>
            <div className={styles.actionGrid}>
              <button onClick={undo} disabled={!past.length}><Undo2 size={17} /> Undo</button>
              <button onClick={redo} disabled={!future.length}><Redo2 size={17} /> Redo</button>
              <button onClick={exportProject}><FileDown size={17} /> Project</button>
              <button onClick={() => importRef.current?.click()}><FileUp size={17} /> Import</button>
              <button onClick={() => actions.length && commit([], "Current customisation cleared.")} disabled={!actions.length}><Trash2 size={17} /> Clear</button>
              <button onClick={resetAll}><RotateCcw size={17} /> Reset model</button>
              <button className={styles.exportButton} onClick={exportRenders} disabled={exporting}><Download size={17} /> {exporting ? "Rendering" : "4 PNGs"}</button>
            </div>
            <input ref={importRef} className={styles.hiddenInput} type="file" accept="application/json,.json" onChange={importProject} />
          </section>
        </aside>
      </section>
    </main>
  );
}
