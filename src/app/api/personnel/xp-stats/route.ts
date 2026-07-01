import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

type XpProfileRow = {
  total_xp: number;
  current_level: number;
  lifetime_kill_count: number;
  lifetime_death_count: number;
  lifetime_teamkill_count: number;
  last_event_at: string | null;
};

type WeeklyRow = {
  week_start_date: string;
  week_end_at: string;
  week_xp: number;
  week_positive_xp: number;
  week_negative_xp: number;
  week_kill_count: number;
  week_death_count: number;
  week_teamkill_count: number;
  infantry_kill_count: number;
  specialist_kill_count: number;
  static_weapon_kill_count: number;
  light_vehicle_kill_count: number;
  vehicle_kill_count: number;
  apc_ifv_kill_count: number;
  tank_kill_count: number;
  aircraft_kill_count: number;
  unknown_kill_count: number;
  last_event_at: string | null;
};

type WeeklyTargetRow = {
  target_category: string;
  target_class: string;
  target_display_name: string;
  kill_count: number;
  xp_total: number;
  last_killed_at: string | null;
};

type MedicalProfileRow = {
  lifetime_blood_litres: number | string;
  lifetime_plasma_litres: number | string;
  lifetime_saline_litres: number | string;
  lifetime_bandage_count: number;
  lifetime_stitched_body_part_count: number;
  lifetime_surgery_count: number;
  lifetime_heart_restart_count: number;
  lifetime_lung_treatment_count: number;
  lifetime_airway_check_count: number;
  last_event_at: string | null;
};

type MedicalWeeklyRow = {
  week_start_date: string;
  week_end_at: string;
  week_blood_litres: number | string;
  week_plasma_litres: number | string;
  week_saline_litres: number | string;
  week_bandage_count: number;
  week_stitched_body_part_count: number;
  week_surgery_count: number;
  week_heart_restart_count: number;
  week_lung_treatment_count: number;
  week_airway_check_count: number;
  last_event_at: string | null;
};

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function emptyProfile() {
  return {
    totalXp: 0,
    currentLevel: 1,
    lifetimeKills: 0,
    lifetimeDeaths: 0,
    lifetimeTeamkills: 0,
    lastEventAt: null,
  };
}

function emptyWeekly() {
  return {
    weekStartDate: null,
    weekEndAt: null,
    xp: 0,
    positiveXp: 0,
    negativeXp: 0,
    kills: 0,
    deaths: 0,
    teamkills: 0,
    categories: {
      infantry: 0,
      specialist: 0,
      staticWeapon: 0,
      lightVehicle: 0,
      vehicle: 0,
      apcIfv: 0,
      tank: 0,
      aircraft: 0,
      unknown: 0,
    },
    lastEventAt: null,
    targets: [] as Array<{
      category: string;
      className: string;
      displayName: string;
      kills: number;
      xp: number;
      lastKilledAt: string | null;
    }>,
  };
}

function emptyMedicalProfile() {
  return {
    bloodLitres: 0,
    plasmaLitres: 0,
    salineLitres: 0,
    bandages: 0,
    stitchedBodyParts: 0,
    surgeries: 0,
    heartRestarts: 0,
    lungTreatments: 0,
    airwayChecks: 0,
    lastEventAt: null,
  };
}

function emptyMedicalWeekly() {
  return {
    weekStartDate: null,
    weekEndAt: null,
    bloodLitres: 0,
    plasmaLitres: 0,
    salineLitres: 0,
    bandages: 0,
    stitchedBodyParts: 0,
    surgeries: 0,
    heartRestarts: 0,
    lungTreatments: 0,
    airwayChecks: 0,
    lastEventAt: null,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const personnelId = url.searchParams.get("personnelId") || "";

  if (!isUuid(personnelId)) {
    return NextResponse.json(
      { xpStats: null },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const [
    { data: profile },
    { data: weekly },
    { data: targets },
    { data: medicalProfile },
    { data: medicalWeekly },
  ] =
    await Promise.all([
      supabaseAdmin
        .from("personnel_xp_profiles")
        .select(
          "total_xp,current_level,lifetime_kill_count,lifetime_death_count,lifetime_teamkill_count,last_event_at",
        )
        .eq("personnel_id", personnelId)
        .maybeSingle<XpProfileRow>(),

      supabaseAdmin
        .from("personnel_xp_weekly_stats")
        .select(
          [
            "week_start_date",
            "week_end_at",
            "week_xp",
            "week_positive_xp",
            "week_negative_xp",
            "week_kill_count",
            "week_death_count",
            "week_teamkill_count",
            "infantry_kill_count",
            "specialist_kill_count",
            "static_weapon_kill_count",
            "light_vehicle_kill_count",
            "vehicle_kill_count",
            "apc_ifv_kill_count",
            "tank_kill_count",
            "aircraft_kill_count",
            "unknown_kill_count",
            "last_event_at",
          ].join(","),
        )
        .eq("personnel_id", personnelId)
        .maybeSingle<WeeklyRow>(),

      supabaseAdmin
        .from("personnel_xp_weekly_target_stats")
        .select(
          "target_category,target_class,target_display_name,kill_count,xp_total,last_killed_at",
        )
        .eq("personnel_id", personnelId)
        .order("kill_count", { ascending: false })
        .limit(12)
        .returns<WeeklyTargetRow[]>(),

      supabaseAdmin
        .from("personnel_medical_profiles")
        .select(
          [
            "lifetime_blood_litres",
            "lifetime_plasma_litres",
            "lifetime_saline_litres",
            "lifetime_bandage_count",
            "lifetime_stitched_body_part_count",
            "lifetime_surgery_count",
            "lifetime_heart_restart_count",
            "lifetime_lung_treatment_count",
            "lifetime_airway_check_count",
            "last_event_at",
          ].join(","),
        )
        .eq("personnel_id", personnelId)
        .maybeSingle<MedicalProfileRow>(),

      supabaseAdmin
        .from("personnel_medical_weekly_stats")
        .select(
          [
            "week_start_date",
            "week_end_at",
            "week_blood_litres",
            "week_plasma_litres",
            "week_saline_litres",
            "week_bandage_count",
            "week_stitched_body_part_count",
            "week_surgery_count",
            "week_heart_restart_count",
            "week_lung_treatment_count",
            "week_airway_check_count",
            "last_event_at",
          ].join(","),
        )
        .eq("personnel_id", personnelId)
        .maybeSingle<MedicalWeeklyRow>(),
    ]);

  const profileStats = profile
    ? {
        totalXp: profile.total_xp,
        currentLevel: profile.current_level,
        lifetimeKills: profile.lifetime_kill_count,
        lifetimeDeaths: profile.lifetime_death_count,
        lifetimeTeamkills: profile.lifetime_teamkill_count,
        lastEventAt: profile.last_event_at,
      }
    : emptyProfile();

  const now = Date.now();
  const weeklyIsCurrent =
    weekly?.week_end_at && new Date(weekly.week_end_at).getTime() > now;

  const weeklyStats =
    weekly && weeklyIsCurrent
      ? {
          weekStartDate: weekly.week_start_date,
          weekEndAt: weekly.week_end_at,
          xp: weekly.week_xp,
          positiveXp: weekly.week_positive_xp,
          negativeXp: weekly.week_negative_xp,
          kills: weekly.week_kill_count,
          deaths: weekly.week_death_count,
          teamkills: weekly.week_teamkill_count,
          categories: {
            infantry: weekly.infantry_kill_count,
            specialist: weekly.specialist_kill_count,
            staticWeapon: weekly.static_weapon_kill_count,
            lightVehicle: weekly.light_vehicle_kill_count,
            vehicle: weekly.vehicle_kill_count,
            apcIfv: weekly.apc_ifv_kill_count,
            tank: weekly.tank_kill_count,
            aircraft: weekly.aircraft_kill_count,
            unknown: weekly.unknown_kill_count,
          },
          lastEventAt: weekly.last_event_at,
          targets: ((targets || []) as WeeklyTargetRow[])
            .filter((target) => target.kill_count > 0)
            .map((target) => ({
              category: target.target_category,
              className: target.target_class,
              displayName: target.target_display_name,
              kills: target.kill_count,
              xp: target.xp_total,
              lastKilledAt: target.last_killed_at,
            })),
        }
      : emptyWeekly();

  const medicalProfileStats = medicalProfile
    ? {
        bloodLitres: numeric(medicalProfile.lifetime_blood_litres),
        plasmaLitres: numeric(medicalProfile.lifetime_plasma_litres),
        salineLitres: numeric(medicalProfile.lifetime_saline_litres),
        bandages: medicalProfile.lifetime_bandage_count,
        stitchedBodyParts: medicalProfile.lifetime_stitched_body_part_count,
        surgeries: medicalProfile.lifetime_surgery_count,
        heartRestarts: medicalProfile.lifetime_heart_restart_count,
        lungTreatments: medicalProfile.lifetime_lung_treatment_count,
        airwayChecks: medicalProfile.lifetime_airway_check_count,
        lastEventAt: medicalProfile.last_event_at,
      }
    : emptyMedicalProfile();

  const medicalWeeklyIsCurrent =
    medicalWeekly?.week_end_at && new Date(medicalWeekly.week_end_at).getTime() > now;

  const medicalWeeklyStats =
    medicalWeekly && medicalWeeklyIsCurrent
      ? {
          weekStartDate: medicalWeekly.week_start_date,
          weekEndAt: medicalWeekly.week_end_at,
          bloodLitres: numeric(medicalWeekly.week_blood_litres),
          plasmaLitres: numeric(medicalWeekly.week_plasma_litres),
          salineLitres: numeric(medicalWeekly.week_saline_litres),
          bandages: medicalWeekly.week_bandage_count,
          stitchedBodyParts: medicalWeekly.week_stitched_body_part_count,
          surgeries: medicalWeekly.week_surgery_count,
          heartRestarts: medicalWeekly.week_heart_restart_count,
          lungTreatments: medicalWeekly.week_lung_treatment_count,
          airwayChecks: medicalWeekly.week_airway_check_count,
          lastEventAt: medicalWeekly.last_event_at,
        }
      : emptyMedicalWeekly();

  return NextResponse.json(
    {
      xpStats: {
        profile: profileStats,
        weekly: weeklyStats,
      },
      medicalStats: {
        profile: medicalProfileStats,
        weekly: medicalWeeklyStats,
      },
    },
    { headers: noStoreHeaders },
  );
}
