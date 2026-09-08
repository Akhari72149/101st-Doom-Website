export type PublicUpdateJob = {
  id: string;
  status: "pending" | "running" | "succeeded" | "failed";
  stage: string;
  message: string;
  progress: number;
  requestedAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type PublicUpdateStatus = {
  active: boolean;
  job: PublicUpdateJob | null;
  serverTime: string;
};

const STAGE_PROGRESS: Record<string, number> = {
  queued: 2,
  countdown: 5,
  preflight: 10,
  fetch: 16,
  backup: 28,
  stopping: 38,
  maintenance: 42,
  installing: 48,
  git: 52,
  dependencies: 60,
  migrating: 70,
  migrations: 74,
  building: 82,
  build: 88,
  restarting: 96,
  complete: 100,
  failed: 100,
};

export function updateStageProgress(stage: string, status: PublicUpdateJob["status"]) {
  if (status === "succeeded" || status === "failed") return 100;
  return STAGE_PROGRESS[stage] ?? 5;
}
