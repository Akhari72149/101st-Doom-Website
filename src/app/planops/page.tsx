"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getAppAuthHeaders, getAppSession, hasAppPermission } from "@/lib/client-auth";

type PlanLayer = {
  id: string;
  name: string;
  visible: boolean;
};

type PlanMarker = {
  id: string;
  x: number;
  y: number;
  label: string;
  type: "infantry" | "vehicle" | "objective" | "support" | "note";
  color: string;
  layerId: string;
};

type PlanRow = {
  id: string;
  name: string;
  notes: string | null;
  map_name: string;
  markers: PlanMarker[];
  layers: PlanLayer[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type InteractionMode = "map" | "marker";

const MAPS = [
  {
    key: "altis",
    name: "Altis",
    image: "/maps/altis.jpg",
  },
  {
    key: "tanoa",
    name: "Tanoa",
    image: "/maps/tanoa.jpg",
  },
  {
    key: "malden",
    name: "Malden",
    image: "/maps/malden.jpg",
  },
];

const MARKER_TYPES: PlanMarker["type"][] = [
  "infantry",
  "vehicle",
  "objective",
  "support",
  "note",
];

const DEFAULT_COLORS = [
  "#158000",
  "#56d2ff",
  "#840505",
  "#9e6b04",
  "#55009b",
  "#ffffff",
];


function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getMarkerSymbol(type: PlanMarker["type"]) {
  switch (type) {
    case "infantry":
      return "▲";
    case "vehicle":
      return "■";
    case "objective":
      return "★";
    case "support":
      return "●";
    case "note":
      return "✎";
    default:
      return "●";
  }
}

function getDefaultLayers(): PlanLayer[] {
  return [
    { id: generateId(), name: "Base", visible: true },
    { id: generateId(), name: "BlueFor", visible: false },
    { id: generateId(), name: "OpFor", visible: false },
    { id: generateId(), name: "Supply", visible: false },
    { id: generateId(), name: "MB", visible: false },
  ];
}

export default function PlanOpsPage() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [loadingPlans, setLoadingPlans] = useState(true);
  const [saving, setSaving] = useState(false);

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [planName, setPlanName] = useState("Untitled Plan");
  const [planNotes, setPlanNotes] = useState("");
  const [selectedMap, setSelectedMap] = useState(MAPS[0].key);

  const [layers, setLayers] = useState<PlanLayer[]>(getDefaultLayers());
  const [activeLayerId, setActiveLayerId] = useState<string>("");
  const [newLayerName, setNewLayerName] = useState("");

  const [markers, setMarkers] = useState<PlanMarker[]>([]);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);

  const [placementType, setPlacementType] = useState<PlanMarker["type"]>("infantry");
  const [placementColor, setPlacementColor] = useState("#00ff66");
  const [placementLabel, setPlacementLabel] = useState("");

  const [interactionMode, setInteractionMode] = useState<InteractionMode>("map");

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const [isPanning, setIsPanning] = useState(false);
  const [isDraggingMarker, setIsDraggingMarker] = useState(false);

  const mapWrapRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<PlanMarker[]>([]);
  const selectedPlanIdRef = useRef<string>("");

  const panStartRef = useRef({
    mouseX: 0,
    mouseY: 0,
    offsetX: 0,
    offsetY: 0,
  });

  const dragMarkerRef = useRef<{
    markerId: string | null;
    pointerOffsetX: number;
    pointerOffsetY: number;
  }>({
    markerId: null,
    pointerOffsetX: 0,
    pointerOffsetY: 0,
  });

  const activeMap = useMemo(() => {
    return MAPS.find((m) => m.key === selectedMap) || MAPS[0];
  }, [selectedMap]);

  const selectedMarker = useMemo(() => {
    return markers.find((m) => m.id === selectedMarkerId) || null;
  }, [markers, selectedMarkerId]);

  const visibleLayerIds = useMemo(() => {
    return new Set(layers.filter((layer) => layer.visible).map((layer) => layer.id));
  }, [layers]);

  const visibleMarkers = useMemo(() => {
    return markers.filter((marker) => visibleLayerIds.has(marker.layerId));
  }, [markers, visibleLayerIds]);

  const activeLayer = useMemo(() => {
    return layers.find((layer) => layer.id === activeLayerId) || null;
  }, [layers, activeLayerId]);

  const isMarkerOnActiveLayer = (marker: PlanMarker) => {
    return marker.layerId === activeLayerId;
  };

  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  useEffect(() => {
    selectedPlanIdRef.current = selectedPlanId;
  }, [selectedPlanId]);

  useEffect(() => {
    const checkAccess = async () => {
      const session=await getAppSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      setUserId(session.user.id);
      const allowed = session.roles.some((role) =>
        ["admin", "logistics", "nco", "trainer"].includes(role)
      )||hasAppPermission(session,"operations.planops","edit");

      setCanEdit(allowed);
      setLoadingAuth(false);
    };

    checkAccess();
  }, [router]);

  useEffect(() => {
    if (loadingAuth) return;
    fetchPlans();
  }, [loadingAuth]);

  useEffect(() => {
    if (!activeLayerId && layers.length > 0) {
      setActiveLayerId(layers[0].id);
    }
  }, [layers, activeLayerId]);

  useEffect(() => {
    if (!selectedMarker) return;
    if (selectedMarker.layerId !== activeLayerId) {
      setSelectedMarkerId(null);
    }
  }, [activeLayerId, selectedMarker]);

  useEffect(() => {
    if(!selectedPlanId)return;
    let cancelled=false;
    const refresh=async()=>{if(dragMarkerRef.current.markerId)return;const response=await fetch(`/api/planops?id=${encodeURIComponent(selectedPlanId)}`,{cache:"no-store",headers:await getAppAuthHeaders()});if(!response.ok||cancelled)return;const data=await response.json() as {plans?:PlanRow[]};const plan=data.plans?.[0];if(plan&&Array.isArray(plan.markers)){setMarkers(plan.markers);markersRef.current=plan.markers;}};
    const interval=window.setInterval(()=>void refresh(),3000);
    return()=>{cancelled=true;window.clearInterval(interval);};
  }, [selectedPlanId, userId]);

  async function fetchPlans() {
    setLoadingPlans(true);

    const response=await fetch("/api/planops",{cache:"no-store",headers:await getAppAuthHeaders()});
    if(!response.ok){
      console.error("Failed to fetch plans",await response.text());
      setLoadingPlans(false);
      return;
    }

    const payload=await response.json() as {plans?:any[]};
    const safePlans: PlanRow[] =
      payload.plans?.map((row: any) => {
        const safeLayers: PlanLayer[] =
          Array.isArray(row.layers) && row.layers.length > 0
            ? row.layers.map((layer: any) => ({
                id: String(layer.id),
                name: String(layer.name ?? "Layer"),
                visible: layer.visible !== false,
              }))
            : getDefaultLayers();

        const fallbackLayerId = safeLayers[0]?.id || generateId();

        const safeMarkers: PlanMarker[] = Array.isArray(row.markers)
          ? row.markers.map((marker: any) => ({
              id: String(marker.id),
              x: Number(marker.x ?? 0),
              y: Number(marker.y ?? 0),
              label: String(marker.label ?? ""),
              type: marker.type ?? "note",
              color: String(marker.color ?? "#00ff66"),
              layerId: String(marker.layerId ?? fallbackLayerId),
            }))
          : [];

        return {
          id: row.id,
          name: row.name,
          notes: row.notes ?? "",
          map_name: row.map_name ?? MAPS[0].key,
          markers: safeMarkers,
          layers: safeLayers,
          created_by: row.created_by ?? null,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      }) || [];

    setPlans(safePlans);

    if (safePlans.length > 0) {
      loadPlanIntoEditor(safePlans[0]);
    } else {
      resetEditor();
    }

    setLoadingPlans(false);
  }

  const persistMarkers = async (nextMarkers: PlanMarker[]) => {
    if (!selectedPlanIdRef.current) return;

    const response=await fetch("/api/planops",{method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json",...(await getAppAuthHeaders())},body:JSON.stringify({kind:"markers",id:selectedPlanIdRef.current,markers:nextMarkers})});
    if(!response.ok){
      console.error("Failed to persist markers",await response.text());
    }
  };

  const broadcastMarkerMove = async (
    markerId: string,
    x: number,
    y: number,
    layerId: string
  ) => {
    void markerId;void x;void y;void layerId;
  };

  const broadcastMarkerCreate = async (marker: PlanMarker) => {
    void marker;
  };

  const broadcastMarkerDelete = async (markerId: string) => {
    void markerId;
  };

  const resetEditor = () => {
    const defaultLayers = getDefaultLayers();

    setSelectedPlanId("");
    setPlanName("Untitled Plan");
    setPlanNotes("");
    setSelectedMap(MAPS[0].key);
    setLayers(defaultLayers);
    setActiveLayerId(defaultLayers[0]?.id || "");
    setNewLayerName("");
    setMarkers([]);
    setSelectedMarkerId(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setInteractionMode("map");
  };

  const loadPlanIntoEditor = (plan: PlanRow) => {
    const safeLayers =
      Array.isArray(plan.layers) && plan.layers.length > 0
        ? plan.layers
        : getDefaultLayers();

    setSelectedPlanId(plan.id);
    setPlanName(plan.name);
    setPlanNotes(plan.notes || "");
    setSelectedMap(plan.map_name || MAPS[0].key);
    setLayers(safeLayers);
    setActiveLayerId(safeLayers[0]?.id || "");
    setNewLayerName("");
    setMarkers(Array.isArray(plan.markers) ? plan.markers : []);
    setSelectedMarkerId(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setInteractionMode("map");
  };

  const handleNewPlan = () => {
    resetEditor();
  };

  const handleSavePlan = async () => {
    if (!canEdit || !userId) return;

    setSaving(true);

    const payload = {
      name: planName.trim() || "Untitled Plan",
      notes: planNotes,
      map_name: selectedMap,
      layers,
      markers,
    };

    if (selectedPlanId) {
      const response=await fetch("/api/planops",{method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json",...(await getAppAuthHeaders())},body:JSON.stringify({id:selectedPlanId,...payload})});
      if(!response.ok){
        console.error("Failed to update plan",await response.text());
        setSaving(false);
        return;
      }
    } else {
      const response=await fetch("/api/planops",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json",...(await getAppAuthHeaders())},body:JSON.stringify(payload)});
      if(!response.ok){
        console.error("Failed to create plan",await response.text());
        setSaving(false);
        return;
      }

      const data=await response.json() as {plan?:PlanRow};
      if (data.plan?.id) {
        setSelectedPlanId(data.plan.id);
      }
    }

    await fetchPlans();
    setSaving(false);
  };

  const handleDeletePlan = async () => {
    if (!canEdit || !selectedPlanId) return;

    const confirmed = window.confirm("Delete this plan?");
    if (!confirmed) return;

    const response=await fetch(`/api/planops?id=${encodeURIComponent(selectedPlanId)}`,{method:"DELETE",credentials:"same-origin",headers:await getAppAuthHeaders()});
    if(!response.ok){
      console.error("Failed to delete plan",await response.text());
      return;
    }

    await fetchPlans();
  };

  const getLocalMapPoint = (clientX: number, clientY: number) => {
    if (!mapWrapRef.current) return null;

    const rect = mapWrapRef.current.getBoundingClientRect();

    const stageX = clientX - rect.left - offset.x;
    const stageY = clientY - rect.top - offset.y;

    const mapX = stageX / zoom;
    const mapY = stageY / zoom;

    return {
      x: clamp(mapX, 0, rect.width),
      y: clamp(mapY, 0, rect.height),
      width: rect.width,
      height: rect.height,
    };
  };

  const handleMapClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canEdit) return;
    if (interactionMode !== "marker") return;
    if (isDraggingMarker || isPanning) return;
    if (!activeLayerId) return;
    if ((e.target as HTMLElement).closest("[data-marker='true']")) return;

    const point = getLocalMapPoint(e.clientX, e.clientY);
    if (!point) return;

    const newMarker: PlanMarker = {
      id: generateId(),
      x: point.x,
      y: point.y,
      label: placementLabel.trim() || placementType.toUpperCase(),
      type: placementType,
      color: placementColor,
      layerId: activeLayerId,
    };

    const nextMarkers = [...markersRef.current, newMarker];
    setMarkers(nextMarkers);
    setSelectedMarkerId(newMarker.id);

    await broadcastMarkerCreate(newMarker);
    await persistMarkers(nextMarkers);
  };

  const startMarkerDrag = (
    e: React.MouseEvent<HTMLDivElement>,
    marker: PlanMarker
  ) => {
    if (!canEdit) return;
    if (!isMarkerOnActiveLayer(marker)) return;

    e.stopPropagation();

    const point = getLocalMapPoint(e.clientX, e.clientY);
    if (!point) return;

    dragMarkerRef.current = {
      markerId: marker.id,
      pointerOffsetX: point.x - marker.x,
      pointerOffsetY: point.y - marker.y,
    };

    setSelectedMarkerId(marker.id);
    setIsDraggingMarker(true);
  };

  const startPan = (e: React.MouseEvent<HTMLDivElement>) => {
    if (interactionMode !== "map") return;
    if ((e.target as HTMLElement).closest("[data-marker='true']")) return;

    panStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };

    setIsPanning(true);
  };

  useEffect(() => {
    const handleMove = async (e: MouseEvent) => {
      if (isDraggingMarker && dragMarkerRef.current.markerId) {
        const movingMarker = markersRef.current.find(
          (m) => m.id === dragMarkerRef.current.markerId
        );
        if (!movingMarker || !isMarkerOnActiveLayer(movingMarker)) return;

        const point = getLocalMapPoint(e.clientX, e.clientY);
        if (!point) return;

        const nextX = clamp(
          point.x - dragMarkerRef.current.pointerOffsetX,
          0,
          point.width
        );

        const nextY = clamp(
          point.y - dragMarkerRef.current.pointerOffsetY,
          0,
          point.height
        );

        const nextMarkers = markersRef.current.map((m) =>
          m.id === dragMarkerRef.current.markerId
            ? { ...m, x: nextX, y: nextY }
            : m
        );

        setMarkers(nextMarkers);
        markersRef.current = nextMarkers;

        await broadcastMarkerMove(
          dragMarkerRef.current.markerId,
          nextX,
          nextY,
          movingMarker.layerId
        );
        return;
      }

      if (isPanning) {
        const dx = e.clientX - panStartRef.current.mouseX;
        const dy = e.clientY - panStartRef.current.mouseY;

        setOffset({
          x: panStartRef.current.offsetX + dx,
          y: panStartRef.current.offsetY + dy,
        });
      }
    };

    const handleUp = async () => {
      const finishedDragMarkerId = dragMarkerRef.current.markerId;

      setIsDraggingMarker(false);
      setIsPanning(false);
      dragMarkerRef.current = {
        markerId: null,
        pointerOffsetX: 0,
        pointerOffsetY: 0,
      };

      if (finishedDragMarkerId) {
        await persistMarkers(markersRef.current);
      }
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDraggingMarker, isPanning, zoom, offset, activeLayerId]);

  const handleWheelZoom = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();

    if (!mapWrapRef.current) return;

    const rect = mapWrapRef.current.getBoundingClientRect();

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomStep = 0.1;
    const nextZoom = clamp(
      Number((zoom + (e.deltaY < 0 ? zoomStep : -zoomStep)).toFixed(2)),
      0.5,
      2.5
    );

    if (nextZoom === zoom) return;

    const worldX = (mouseX - offset.x) / zoom;
    const worldY = (mouseY - offset.y) / zoom;

    const nextOffsetX = mouseX - worldX * nextZoom;
    const nextOffsetY = mouseY - worldY * nextZoom;

    setZoom(nextZoom);
    setOffset({
      x: nextOffsetX,
      y: nextOffsetY,
    });
  };

  const updateSelectedMarker = (updates: Partial<PlanMarker>) => {
    if (!selectedMarkerId) return;

    setMarkers((prev) =>
      prev.map((m) => (m.id === selectedMarkerId ? { ...m, ...updates } : m))
    );
  };

  const deleteSelectedMarker = async () => {
    if (!selectedMarkerId) return;

    const markerId = selectedMarkerId;
    const nextMarkers = markersRef.current.filter((m) => m.id !== markerId);

    setMarkers(nextMarkers);
    markersRef.current = nextMarkers;
    setSelectedMarkerId(null);

    await broadcastMarkerDelete(markerId);
    await persistMarkers(nextMarkers);
  };

  const addLayer = () => {
    if (!canEdit) return;

    const trimmed = newLayerName.trim();
    if (!trimmed) return;

    const newLayer: PlanLayer = {
      id: generateId(),
      name: trimmed,
      visible: true,
    };



    setLayers((prev) => [...prev, newLayer]);
    setActiveLayerId(newLayer.id);
    setNewLayerName("");
  };

  const toggleLayerVisibility = (layerId: string) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
      )
    );
  };

  const renameLayer = (layerId: string, name: string) => {
    setLayers((prev) =>
      prev.map((layer) => (layer.id === layerId ? { ...layer, name } : layer))
    );
  };

  const deleteLayer = (layerId: string) => {
    if (!canEdit) return;
    if (layers.length <= 1) return;

    const nextLayers = layers.filter((layer) => layer.id !== layerId);
    const fallbackLayerId = nextLayers[0]?.id;

    setLayers(nextLayers);

    if (activeLayerId === layerId && fallbackLayerId) {
      setActiveLayerId(fallbackLayerId);
    }

    if (fallbackLayerId) {
      const nextMarkers = markersRef.current.map((marker) =>
        marker.layerId === layerId
          ? { ...marker, layerId: fallbackLayerId }
          : marker
      );

      setMarkers(nextMarkers);
      markersRef.current = nextMarkers;
    }

    if (selectedMarker && selectedMarker.layerId === layerId) {
      setSelectedMarkerId(null);
    }
  };

      const getMarkerScale = () => {
  return clamp(zoom * 2.0, 1.0, 1.4);
};

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-black text-[#00ff66] flex items-center justify-center">
        Loading PlanOps...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      <div className="pointer-events-none fixed inset-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,102,0.08),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,102,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,102,0.06)_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      <div className="relative z-10 p-4 md:p-6">
        <div className="mx-auto w-full max-w-[1900px]">
          <div className="mb-6 rounded-3xl border border-[#00ff66]/30 bg-black/70 p-5 shadow-[0_0_35px_rgba(0,255,102,0.12)] backdrop-blur">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-[#00ff66] tracking-wide">
                  PLANOPS
                </h1>
                <p className="mt-2 text-sm text-gray-300">
                  Base mission planning page for maps, objectives, units, notes, and layers.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleNewPlan}
                  className="rounded-xl border border-[#00ff66]/40 bg-[#00ff66]/10 px-4 py-2 text-sm font-semibold text-[#00ff66] transition hover:bg-[#00ff66]/20"
                >
                  New Plan
                </button>

                {canEdit && (
                  <>
                    <button
                      onClick={handleSavePlan}
                      disabled={saving}
                      className="rounded-xl border border-[#2f6fff]/50 bg-[#2f6fff]/20 px-4 py-2 text-sm font-semibold text-[#8cb3ff] transition hover:bg-[#2f6fff]/30 disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save Plan"}
                    </button>

                    <button
                      onClick={handleDeletePlan}
                      disabled={!selectedPlanId}
                      className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                    >
                      Delete Plan
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[400px_minmax(0,1fr)_400px]">
            <div className="rounded-3xl border border-[#00ff66]/25 bg-black/70 p-4 shadow-[0_0_25px_rgba(0,255,102,0.08)] backdrop-blur">
              <h2 className="mb-4 text-lg font-bold text-[#00ff66]">Plans</h2>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-gray-400">
                    Existing Plans
                  </label>
                  <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
                    {loadingPlans ? (
                      <div className="rounded-2xl border border-[#00ff66]/15 bg-black/50 p-3 text-sm text-gray-400">
                        Loading plans...
                      </div>
                    ) : plans.length === 0 ? (
                      <div className="rounded-2xl border border-[#00ff66]/15 bg-black/50 p-3 text-sm text-gray-400">
                        No plans yet.
                      </div>
                    ) : (
                      plans.map((plan) => (
                        <button
                          key={plan.id}
                          onClick={() => loadPlanIntoEditor(plan)}
                          className={`w-full rounded-2xl border p-3 text-left transition ${
                            selectedPlanId === plan.id
                              ? "border-[#00ff66]/60 bg-[#00ff66]/12"
                              : "border-[#00ff66]/15 bg-black/50 hover:bg-[#00ff66]/8"
                          }`}
                        >
                          <div className="text-sm font-semibold text-white">{plan.name}</div>
                          <div className="mt-1 text-xs text-gray-400">
                            {plan.map_name.toUpperCase()} • {plan.markers?.length || 0} markers •{" "}
                            {plan.layers?.length || 0} layers
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-gray-400">
                    Plan Name
                  </label>
                  <input
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    className="w-full rounded-xl border border-[#00ff66]/20 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[#00ff66]/50"
                    placeholder="Operation Name"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-gray-400">
                    Map
                  </label>
                  <select
                    value={selectedMap}
                    onChange={(e) => setSelectedMap(e.target.value)}
                    className="w-full rounded-xl border border-[#00ff66]/20 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[#00ff66]/50"
                  >
                    {MAPS.map((map) => (
                      <option key={map.key} value={map.key}>
                        {map.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-gray-400">
                    Notes
                  </label>
                  <textarea
                    value={planNotes}
                    onChange={(e) => setPlanNotes(e.target.value)}
                    rows={8}
                    className="w-full rounded-xl border border-[#00ff66]/20 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[#00ff66]/50"
                    placeholder="Phase breakdown, comms, staging, objectives..."
                  />
                </div>

                <div className="border-t border-[#00ff66]/15 pt-4">
                  <div className="mb-3 text-sm font-semibold text-white">Layers</div>

                  <div className="space-y-2">
                    {layers.map((layer) => (
                      <div
                        key={layer.id}
                        className={`rounded-2xl border p-3 ${
                          activeLayerId === layer.id
                            ? "border-[#00ff66]/40 bg-[#00ff66]/10"
                            : "border-[#00ff66]/15 bg-black/40"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setActiveLayerId(layer.id)}
                            className={`rounded-lg border px-3 py-1 text-xs font-semibold ${
                              activeLayerId === layer.id
                                ? "border-[#00ff66]/50 bg-[#00ff66]/20 text-[#00ff66]"
                                : "border-[#00ff66]/15 bg-black/40 text-gray-300"
                            }`}
                          >
                            Active
                          </button>

                          <button
                            onClick={() => toggleLayerVisibility(layer.id)}
                            className={`rounded-lg border px-3 py-1 text-xs font-semibold ${
                              layer.visible
                                ? "border-[#2f6fff]/40 bg-[#2f6fff]/20 text-[#8cb3ff]"
                                : "border-red-500/30 bg-red-500/10 text-red-300"
                            }`}
                          >
                            {layer.visible ? "Visible" : "Hidden"}
                          </button>

                          <input
                            value={layer.name}
                            onChange={(e) => renameLayer(layer.id, e.target.value)}
                            className="min-w-0 flex-1 rounded-lg border border-[#00ff66]/15 bg-black/50 px-3 py-1.5 text-sm text-white outline-none focus:border-[#00ff66]/40"
                          />

                          <button
  onClick={() => deleteLayer(layer.id)}
  disabled={layers.length <= 1}
  className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300 disabled:opacity-40"
>
  Delete
</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {canEdit && (
                    <div className="mt-3 flex gap-2">
                      <input
                        value={newLayerName}
                        onChange={(e) => setNewLayerName(e.target.value)}
                        className="min-w-0 flex-1 rounded-xl border border-[#00ff66]/20 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[#00ff66]/50"
                        placeholder="New layer name"
                      />
                      <button
                        onClick={addLayer}
                        className="rounded-xl border border-[#00ff66]/40 bg-[#00ff66]/10 px-4 py-2 text-sm font-semibold text-[#00ff66] transition hover:bg-[#00ff66]/20"
                      >
                        Add
                      </button>
                    </div>
                  )}

                  <div className="mt-3 rounded-2xl border border-[#00ff66]/10 bg-black/40 p-3 text-xs text-gray-400">
                    Active layer: {activeLayer?.name || "None"}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[#00ff66]/25 bg-black/70 p-4 shadow-[0_0_25px_rgba(0,255,102,0.08)] backdrop-blur">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-[#00ff66]">
                  Map Board
                </h2>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setInteractionMode("map")}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                      interactionMode === "map"
                        ? "border-[#2f6fff]/60 bg-[#2f6fff]/25 text-[#8cb3ff]"
                        : "border-[#2f6fff]/20 bg-[#2f6fff]/10 text-[#6f96e8] hover:bg-[#2f6fff]/18"
                    }`}
                  >
                    Map Control
                  </button>

                  <button
                    onClick={() => {
                      if (!canEdit) return;
                      setInteractionMode("marker");
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                      interactionMode === "marker"
                        ? "border-[#00ff66]/60 bg-[#00ff66]/20 text-[#00ff66]"
                        : "border-[#00ff66]/20 bg-[#00ff66]/10 text-[#7dffb1] hover:bg-[#00ff66]/16"
                    } ${!canEdit ? "opacity-50 cursor-not-allowed" : ""}`}
                    disabled={!canEdit}
                  >
                    Place Marker
                  </button>

                  <button
                    onClick={() => setZoom((z) => clamp(Number((z - 0.1).toFixed(2)), 0.5, 2.5))}
                    className="rounded-lg border border-[#00ff66]/25 bg-black/60 px-3 py-1.5 text-sm text-[#00ff66] hover:bg-[#00ff66]/10"
                  >
                    -
                  </button>
                  <div className="rounded-lg border border-[#00ff66]/15 bg-black/60 px-3 py-1.5 text-sm text-gray-300">
                    {Math.round(zoom * 100)}%
                  </div>
                  <button
                    onClick={() => setZoom((z) => clamp(Number((z + 0.1).toFixed(2)), 0.5, 2.5))}
                    className="rounded-lg border border-[#00ff66]/25 bg-black/60 px-3 py-1.5 text-sm text-[#00ff66] hover:bg-[#00ff66]/10"
                  >
                    +
                  </button>
                  <button
                    onClick={() => {
                      setZoom(1);
                      setOffset({ x: 0, y: 0 });
                    }}
                    className="rounded-lg border border-[#2f6fff]/30 bg-[#2f6fff]/10 px-3 py-1.5 text-sm text-[#8cb3ff] hover:bg-[#2f6fff]/20"
                  >
                    Reset View
                  </button>
                </div>
              </div>

              <div
                ref={mapWrapRef}
                onWheel={handleWheelZoom}
                onMouseDown={startPan}
                onClick={handleMapClick}
                className={`relative h-[70vh] min-h-[600px] w-full overflow-hidden rounded-3xl border border-[#00ff66]/20 bg-black select-none ${
                  interactionMode === "marker" ? "cursor-crosshair" : "cursor-grab"
                }`}
              >
                <div
                  className="absolute left-0 top-0 origin-top-left"
                  style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                    width: "100%",
                    height: "100%",
                  }}
                >
                  <img
                    src={activeMap.image}
                    alt={activeMap.name}
                    className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                    draggable={false}
                  />

                  <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,102,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,102,0.08)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

                  {visibleMarkers.map((marker) => {
  const selected = marker.id === selectedMarkerId;
  const markerLayer = layers.find((layer) => layer.id === marker.layerId);
  const isActiveLayerMarker = isMarkerOnActiveLayer(marker);

  const scale = getMarkerScale();

  return (
    <div
      key={marker.id}
      data-marker="true"
      onMouseDown={(e) => startMarkerDrag(e, marker)}
      onClick={(e) => {
        e.stopPropagation();
        if (!isActiveLayerMarker) return;
        setSelectedMarkerId(marker.id);
      }}
      className={`group absolute -translate-x-1/2 -translate-y-1/2 ${
        isActiveLayerMarker ? "cursor-move" : "cursor-default"
      }`}
      style={{
        left: marker.x,
        top: marker.y,
        transform: `translate(-50%, -50%) scale(${scale})`,
      }}
    >
      <div
        className={`font-bold transition ${
          selected ? "scale-125" : ""
        } ${!isActiveLayerMarker ? "opacity-50" : ""}`}
        style={{
          color: marker.color,
          textShadow: `0 0 8px ${marker.color}, 0 0 16px ${marker.color}55`,
          fontSize: "18px",
          filter: isActiveLayerMarker
            ? "none"
            : "brightness(0.6) saturate(0.6)",
        }}
      >
        {getMarkerSymbol(marker.type)}
      </div>

<div
  className="absolute left-1/2 top-full mt-1 -translate-x-1/2 text-center whitespace-nowrap font-semibold pointer-events-none"
  style={{
    fontSize: "9px",
    color: "#ffffff",
    textShadow: "0 0 6px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.9)",
    opacity: isActiveLayerMarker ? 1 : 0.6,
    filter: isActiveLayerMarker ? "none" : "brightness(0.8)",
  }}
>
  {marker.label}
</div>

      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-5 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/90 px-2 py-1 text-[10px] text-white opacity-0 shadow transition-opacity duration-150 group-hover:opacity-100">
        {markerLayer?.name || "Layer"}
      </div>
    </div>
  );
})}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-400">
                <span className="rounded-full border border-[#00ff66]/15 px-3 py-1">
                  Mode: {interactionMode === "marker" ? "Place Marker" : "Map Control"}
                </span>
                <span className="rounded-full border border-[#00ff66]/15 px-3 py-1">
                  Active Layer: {activeLayer?.name || "None"}
                </span>
                <span className="rounded-full border border-[#00ff66]/15 px-3 py-1">
                  Visible Markers: {visibleMarkers.length}
                </span>
                <span className="rounded-full border border-[#00ff66]/15 px-3 py-1">
                  Mouse wheel to zoom
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-[#00ff66]/25 bg-black/70 p-4 shadow-[0_0_25px_rgba(0,255,102,0.08)] backdrop-blur">
              <h2 className="mb-4 text-lg font-bold text-[#00ff66]">Marker Controls</h2>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-gray-400">
                    New Marker Type
                  </label>
                  <select
                    value={placementType}
                    onChange={(e) => setPlacementType(e.target.value as PlanMarker["type"])}
                    className="w-full rounded-xl border border-[#00ff66]/20 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[#00ff66]/50"
                  >
                    {MARKER_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-gray-400">
                    New Marker Label
                  </label>
                  <input
                    value={placementLabel}
                    onChange={(e) => setPlacementLabel(e.target.value)}
                    className="w-full rounded-xl border border-[#00ff66]/20 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[#00ff66]/50"
                    placeholder="1-1, OBJ ALPHA, LZ..."
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-gray-400">
                    Place Into Layer
                  </label>
                  <select
                    value={activeLayerId}
                    onChange={(e) => setActiveLayerId(e.target.value)}
                    className="w-full rounded-xl border border-[#00ff66]/20 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[#00ff66]/50"
                  >
                    {layers.map((layer) => (
                      <option key={layer.id} value={layer.id}>
                        {layer.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-gray-400">
                    New Marker Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setPlacementColor(color)}
                        className={`h-9 w-9 rounded-full border-2 transition ${
                          placementColor === color
                            ? "scale-110 border-white"
                            : "border-white/20"
                        }`}
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="border-t border-[#00ff66]/15 pt-4">
                  <div className="mb-3 text-sm font-semibold text-white">
                    Selected Marker
                  </div>

                  {selectedMarker ? (
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-gray-400">
                          Label
                        </label>
                        <input
                          value={selectedMarker.label}
                          onChange={(e) =>
                            updateSelectedMarker({ label: e.target.value })
                          }
                          className="w-full rounded-xl border border-[#00ff66]/20 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[#00ff66]/50"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-gray-400">
                          Type
                        </label>
                        <select
                          value={selectedMarker.type}
                          onChange={(e) =>
                            updateSelectedMarker({
                              type: e.target.value as PlanMarker["type"],
                            })
                          }
                          className="w-full rounded-xl border border-[#00ff66]/20 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[#00ff66]/50"
                        >
                          {MARKER_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-gray-400">
                          Layer
                        </label>
                        <select
                          value={selectedMarker.layerId}
                          onChange={(e) =>
                            updateSelectedMarker({
                              layerId: e.target.value,
                            })
                          }
                          className="w-full rounded-xl border border-[#00ff66]/20 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[#00ff66]/50"
                        >
                          {layers.map((layer) => (
                            <option key={layer.id} value={layer.id}>
                              {layer.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-gray-400">
                          Color
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {DEFAULT_COLORS.map((color) => (
                            <button
                              key={color}
                              onClick={() => updateSelectedMarker({ color })}
                              className={`h-9 w-9 rounded-full border-2 transition ${
                                selectedMarker.color === color
                                  ? "scale-110 border-white"
                                  : "border-white/20"
                              }`}
                              style={{ background: color }}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                        <div className="rounded-xl border border-[#00ff66]/10 bg-black/40 p-2">
                          X: {Math.round(selectedMarker.x)}
                        </div>
                        <div className="rounded-xl border border-[#00ff66]/10 bg-black/40 p-2">
                          Y: {Math.round(selectedMarker.y)}
                        </div>
                      </div>

                      <button
                        onClick={deleteSelectedMarker}
                        className="w-full rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
                      >
                        Delete Marker
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-[#00ff66]/15 bg-black/50 p-3 text-sm text-gray-400">
                      No marker selected.
                    </div>
                  )}
                </div>

                <div className="border-t border-[#00ff66]/15 pt-4">
                  <div className="text-sm font-semibold text-white">Editor Access</div>
                  <div className="mt-2 rounded-2xl border border-[#00ff66]/15 bg-black/50 p-3 text-sm text-gray-300">
                    {canEdit
                      ? "You have editor access for creating and updating plans."
                      : "You are in view-only mode. Admin/logistics/NCO/trainer can edit."}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
