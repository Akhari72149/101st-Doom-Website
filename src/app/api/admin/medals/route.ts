import { NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/postgres/pool";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime="nodejs"; export const dynamic="force-dynamic";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function backend(){const v=process.env.ADMIN_PERSONNEL_DATABASE_BACKEND||"supabase";if(v!=="postgres"&&v!=="supabase")throw new Error("Unknown ADMIN_PERSONNEL_DATABASE_BACKEND");return v;}

export async function GET(request:Request){
 if(!(await requirePageAccess(request,"admin.medals","read")))return NextResponse.json({error:"Forbidden"},{status:403});
 const personId=new URL(request.url).searchParams.get("personId")||"";
 try{
  if(backend()==="postgres"){
   if(personId){if(!UUID.test(personId))return NextResponse.json({error:"Invalid personnel"},{status:400});const r=await getPostgresPool().query(`select pa.id,pa.awarded_at,pa.notes,a.id award_id,a.name,a.description,a.category,a.icon_key,a.ribbon_color from public.personnel_awards pa join public.awards a on a.id=pa.award_id where pa.personnel_id=$1 order by pa.awarded_at desc`,[personId]);return NextResponse.json({personMedals:r.rows.map(x=>({id:x.id,awarded_at:x.awarded_at,notes:x.notes,award:{id:x.award_id,name:x.name,description:x.description,category:x.category,icon_key:x.icon_key,ribbon_color:x.ribbon_color}}))});}
   const [p,r,a]=await Promise.all([getPostgresPool().query("select id,name,rank_id,status,slotted_position from public.personnel order by name"),getPostgresPool().query("select id,name,rank_level from public.ranks"),getPostgresPool().query("select id,name,description,category,icon_key,ribbon_color,sort_order from public.awards where award_type='manual' and is_active=true order by sort_order,name")]);return NextResponse.json({personnel:p.rows,ranks:r.rows,medals:a.rows});
  }
  if(personId){const{data,error}=await supabaseAdmin.from("personnel_awards").select("id,awarded_at,notes,award:award_id(id,name,description,category,icon_key,ribbon_color)").eq("personnel_id",personId).order("awarded_at",{ascending:false});if(error)throw error;return NextResponse.json({personMedals:data||[]});}
  const[p,r,a]=await Promise.all([supabaseAdmin.from("personnel").select("id,name,rank_id,status,slotted_position").order("name"),supabaseAdmin.from("ranks").select("id,name,rank_level"),supabaseAdmin.from("awards").select("id,name,description,category,icon_key,ribbon_color,sort_order").eq("award_type","manual").eq("is_active",true).order("sort_order").order("name")]);const e=p.error||r.error||a.error;if(e)throw e;return NextResponse.json({personnel:p.data||[],ranks:r.data||[],medals:a.data||[]});
 }catch(e){console.error("[admin-medals] Read failed",e);return NextResponse.json({error:"Failed to load medals"},{status:500});}
}

export async function POST(request:Request){
 if(!requestHasSameOrigin(request))return NextResponse.json({error:"Invalid request origin"},{status:403});const auth=await requirePageAccess(request,"admin.medals","edit");if(!auth)return NextResponse.json({error:"Forbidden"},{status:403});
 const b=await request.json().catch(()=>null) as Record<string,unknown>|null;const person=String(b?.personnelId||""),award=String(b?.awardId||""),notes=String(b?.notes||"").trim().slice(0,2000)||null;if(!UUID.test(person)||!UUID.test(award))return NextResponse.json({error:"Invalid medal award"},{status:400});
 try{if(backend()==="postgres"){const valid=await getPostgresPool().query("select 1 from public.awards where id=$1 and award_type='manual' and is_active=true",[award]);if(!valid.rowCount)return NextResponse.json({error:"Medal cannot be manually awarded"},{status:400});await getPostgresPool().query("insert into public.personnel_awards(personnel_id,award_id,awarded_at,awarded_by,notes) values($1,$2,now(),$3,$4)",[person,award,auth.userId,notes]);}else{const{data:valid}=await supabaseAdmin.from("awards").select("id").eq("id",award).eq("award_type","manual").eq("is_active",true).maybeSingle();if(!valid)return NextResponse.json({error:"Medal cannot be manually awarded"},{status:400});const{error}=await supabaseAdmin.from("personnel_awards").insert({personnel_id:person,award_id:award,awarded_at:new Date().toISOString(),awarded_by:auth.userId,notes});if(error)throw error;}return NextResponse.json({ok:true},{status:201});}catch(e){console.error("[admin-medals] Award failed",e);return NextResponse.json({error:"Failed to award medal"},{status:500});}
}

export async function DELETE(request:Request){if(!requestHasSameOrigin(request))return NextResponse.json({error:"Invalid request origin"},{status:403});if(!(await requirePageAccess(request,"admin.medals","edit")))return NextResponse.json({error:"Forbidden"},{status:403});const id=new URL(request.url).searchParams.get("id")||"";if(!UUID.test(id))return NextResponse.json({error:"Invalid award"},{status:400});try{if(backend()==="postgres")await getPostgresPool().query("delete from public.personnel_awards where id=$1",[id]);else{const{error}=await supabaseAdmin.from("personnel_awards").delete().eq("id",id);if(error)throw error;}return NextResponse.json({ok:true});}catch(e){console.error("[admin-medals] Remove failed",e);return NextResponse.json({error:"Failed to remove medal"},{status:500});}}
