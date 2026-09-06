import { NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/postgres/pool";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function backend() {
  const value = process.env.LOOKUP_DATABASE_BACKEND || "supabase";
  if (value !== "postgres" && value !== "supabase") throw new Error("Unknown LOOKUP_DATABASE_BACKEND");
  return value;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const mode = params.get("mode") || "bootstrap";
  const query = (params.get("query") || "").trim().slice(0, 80);
  const certificationId = params.get("certificationId") || "";
  try {
    if (backend() === "postgres") {
      const pool = getPostgresPool();
      if (mode === "bootstrap") {
        const ranks = await pool.query("select id, name from public.ranks order by name");
        return NextResponse.json({ ranks: ranks.rows });
      }
      if (mode === "search") {
        if (query.length < 1) return NextResponse.json({ certifications: [] });
        const result = await pool.query(
          "select id, name from public.certifications where name ilike $1 order by name limit 50",
          [`%${query}%`],
        );
        return NextResponse.json({ certifications: result.rows });
      }
      if (mode === "personnel") {
        const result = await pool.query(
          `select pc.id, pc.awarded_at, p.id as personnel_id, p.name, p.rank_id, p.status,
                  p.slotted_position, p.reservist_since, p.mos
             from public.personnel_certifications pc
             join public.personnel p on p.id = pc.personnel_id
            where pc.certification_id = $1
            order by pc.awarded_at desc nulls last limit 1000`,
          [certificationId],
        );
        return NextResponse.json({ personnelCertifications: result.rows.map((row) => ({
          id: row.id, awarded_at: row.awarded_at,
          personnel: { id: row.personnel_id, name: row.name, rank_id: row.rank_id, status: row.status,
            slotted_position: row.slotted_position, reservist_since: row.reservist_since, mos: row.mos },
        })) });
      }
      if (mode === "reservists") {
        const result = await pool.query(
          `select id, name, rank_id, status, slotted_position, reservist_since, mos
             from public.personnel where slotted_position is null
            order by reservist_since desc nulls last limit 1000`,
        );
        return NextResponse.json({ personnel: result.rows });
      }
    } else {
      if (mode === "bootstrap") {
        const { data, error } = await supabaseAdmin.from("ranks").select("id,name").order("name");
        if (error) throw error;
        return NextResponse.json({ ranks: data || [] });
      }
      if (mode === "search") {
        if (query.length < 1) return NextResponse.json({ certifications: [] });
        const { data, error } = await supabaseAdmin.from("certifications").select("id,name")
          .ilike("name", `%${query}%`).order("name").limit(50);
        if (error) throw error;
        return NextResponse.json({ certifications: data || [] });
      }
      if (mode === "personnel") {
        const { data, error } = await supabaseAdmin.from("personnel_certifications")
          .select("id,awarded_at,personnel:personnel_id(id,name,rank_id,status,slotted_position,reservist_since,mos)")
          .eq("certification_id", certificationId).order("awarded_at", { ascending: false }).limit(1000);
        if (error) throw error;
        return NextResponse.json({ personnelCertifications: data || [] });
      }
      if (mode === "reservists") {
        const { data, error } = await supabaseAdmin.from("personnel")
          .select("id,name,rank_id,status,slotted_position,reservist_since,mos")
          .is("slotted_position", null).order("reservist_since", { ascending: false, nullsFirst: false }).limit(1000);
        if (error) throw error;
        return NextResponse.json({ personnel: data || [] });
      }
    }
    return NextResponse.json({ error: "Invalid lookup mode" }, { status: 400 });
  } catch (error) {
    console.error("[tag-lookup] Read failed", error);
    return NextResponse.json({ error: "Failed to load lookup data" }, { status: 500 });
  }
}
