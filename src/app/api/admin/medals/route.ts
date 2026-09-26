import { NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/postgres/pool";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { broadcastWebsiteAction } from "@/lib/broadcastWebsiteAction";

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
 try{
  let notification:Record<string,unknown>;
  if(backend()==="postgres"){
   const valid=await getPostgresPool().query<{name:string;description:string|null;category:string|null;icon_key:string;ribbon_color:string;personnel_name:string;discord_id:string|null}>(`select awards.name,awards.description,awards.category,awards.icon_key,awards.ribbon_color,
     personnel.name personnel_name,personnel.discord_id
     from public.awards awards cross join public.personnel personnel
     where awards.id=$1 and awards.award_type='manual' and awards.is_active=true and personnel.id=$2`,[award,person]);
   if(!valid.rowCount)return NextResponse.json({error:"Medal cannot be manually awarded"},{status:400});
   await getPostgresPool().query("insert into public.personnel_awards(personnel_id,award_id,awarded_at,awarded_by,notes) values($1,$2,now(),$3,$4)",[person,award,auth.userId,notes]);
   const actor=await getPostgresPool().query<{display_name:string|null}>(`select coalesce(nullif("displayUsername",''),nullif(name,''),nullif(username,'')) display_name from public.app_auth_users where id=$1`,[auth.userId]);
   const row=valid.rows[0];
   notification={action:"MEDAL_AWARDED",target_personnel_id:person,personnelName:row.personnel_name,personnelDiscordId:row.discord_id,processedBy:actor.rows[0]?.display_name||auth.email||"Website administrator",awardName:row.name,awardDescription:row.description,awardCategory:row.category,awardIconKey:row.icon_key,awardColor:row.ribbon_color,awardNotes:notes};
  }else{
   const[{data:valid},{data:target}]=await Promise.all([supabaseAdmin.from("awards").select("id,name,description,category,icon_key,ribbon_color").eq("id",award).eq("award_type","manual").eq("is_active",true).maybeSingle(),supabaseAdmin.from("personnel").select("name,discord_id").eq("id",person).maybeSingle()]);
   if(!valid||!target)return NextResponse.json({error:"Medal cannot be manually awarded"},{status:400});
   const{error}=await supabaseAdmin.from("personnel_awards").insert({personnel_id:person,award_id:award,awarded_at:new Date().toISOString(),awarded_by:auth.userId,notes});if(error)throw error;
   notification={action:"MEDAL_AWARDED",target_personnel_id:person,personnelName:target.name,personnelDiscordId:target.discord_id,processedBy:auth.email||"Website administrator",awardName:valid.name,awardDescription:valid.description,awardCategory:valid.category,awardIconKey:valid.icon_key,awardColor:valid.ribbon_color,awardNotes:notes};
  }
  const discordNotified=await broadcastWebsiteAction(notification);
  return NextResponse.json({ok:true,discordNotified},{status:201});
 }catch(e){console.error("[admin-medals] Award failed",e);return NextResponse.json({error:"Failed to award medal"},{status:500});}
}

export async function DELETE(request:Request){if(!requestHasSameOrigin(request))return NextResponse.json({error:"Invalid request origin"},{status:403});const auth=await requirePageAccess(request,"admin.medals","edit");if(!auth)return NextResponse.json({error:"Forbidden"},{status:403});const id=new URL(request.url).searchParams.get("id")||"";if(!UUID.test(id))return NextResponse.json({error:"Invalid award"},{status:400});try{let notification:Record<string,unknown>|null=null;if(backend()==="postgres"){const record=await getPostgresPool().query<{personnel_id:string;personnel_name:string;discord_id:string|null;award_name:string;award_description:string|null;award_category:string|null;icon_key:string;ribbon_color:string;notes:string|null}>(`select personnel_awards.personnel_id,personnel_awards.notes,personnel.name personnel_name,personnel.discord_id,
 awards.name award_name,awards.description award_description,awards.category award_category,awards.icon_key,awards.ribbon_color
 from public.personnel_awards join public.personnel on personnel.id=personnel_awards.personnel_id join public.awards on awards.id=personnel_awards.award_id where personnel_awards.id=$1`,[id]);if(!record.rowCount)return NextResponse.json({error:"Award assignment not found"},{status:404});await getPostgresPool().query("delete from public.personnel_awards where id=$1",[id]);const actor=await getPostgresPool().query<{display_name:string|null}>(`select coalesce(nullif("displayUsername",''),nullif(name,''),nullif(username,'')) display_name from public.app_auth_users where id=$1`,[auth.userId]);const row=record.rows[0];notification={action:"MEDAL_REVOKED",target_personnel_id:row.personnel_id,personnelName:row.personnel_name,personnelDiscordId:row.discord_id,processedBy:actor.rows[0]?.display_name||auth.email||"Website administrator",awardName:row.award_name,awardDescription:row.award_description,awardCategory:row.award_category,awardIconKey:row.icon_key,awardColor:row.ribbon_color,awardNotes:row.notes};}else{const{data:record,error:readError}=await supabaseAdmin.from("personnel_awards").select("personnel_id,notes,personnel:personnel_id(name,discord_id),award:award_id(name,description,category,icon_key,ribbon_color)").eq("id",id).maybeSingle();if(readError)throw readError;if(!record)return NextResponse.json({error:"Award assignment not found"},{status:404});const{error}=await supabaseAdmin.from("personnel_awards").delete().eq("id",id);if(error)throw error;const target=record.personnel as unknown as {name:string;discord_id:string|null}|null,award=record.award as unknown as {name:string;description:string|null;category:string|null;icon_key:string;ribbon_color:string}|null;notification={action:"MEDAL_REVOKED",target_personnel_id:record.personnel_id,personnelName:target?.name||"Unknown",personnelDiscordId:target?.discord_id||null,processedBy:auth.email||"Website administrator",awardName:award?.name||"Unknown Medal",awardDescription:award?.description||null,awardCategory:award?.category||null,awardIconKey:award?.icon_key||"medal",awardColor:award?.ribbon_color||"#00ff66",awardNotes:record.notes};}const discordNotified=notification?await broadcastWebsiteAction(notification):false;return NextResponse.json({ok:true,discordNotified});}catch(e){console.error("[admin-medals] Remove failed",e);return NextResponse.json({error:"Failed to remove medal"},{status:500});}}
