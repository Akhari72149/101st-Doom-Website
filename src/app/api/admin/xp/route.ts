import { NextResponse } from "next/server";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";

export const runtime="nodejs"; export const dynamic="force-dynamic";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=(error:string,status:number)=>NextResponse.json({error},{status});

export async function GET(request:Request){
  if(!(await requirePageAccess(request,"admin.xp","read").catch(()=>null)))return fail("Forbidden",403);
  const pool=getPostgresPool();
  const [personnel,adjustments]=await Promise.all([
    pool.query(`select p.id,p.name,r.name rank_name,coalesce(x.total_xp,0)::integer total_xp,
      coalesce(x.current_level,1)::integer current_level,x.last_event_at
      from public.personnel p left join public.ranks r on r.id=p.rank_id
      left join public.personnel_xp_profiles x on x.personnel_id=p.id
      where lower(coalesce(p.status,'')) not in ('retired','removed','transferred') order by p.name`),
    pool.query(`select a.id,a.personnel_id,p.name,a.xp_delta,a.previous_total,a.new_total,a.reason,
      coalesce(u."displayUsername",u.username,'Unknown') adjusted_by_name,a.created_at
      from public.personnel_xp_adjustments a join public.personnel p on p.id=a.personnel_id
      left join public.app_auth_users u on u.id=a.adjusted_by order by a.created_at desc limit 100`),
  ]);
  return NextResponse.json({personnel:personnel.rows,adjustments:adjustments.rows},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:Request){
  if(!requestHasSameOrigin(request))return fail("Invalid request origin",403);
  const auth=await requirePageAccess(request,"admin.xp","edit").catch(()=>null);if(!auth)return fail("Edit XP Management access is required",403);
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const personnelId=String(body?.personnelId||""),delta=Number(body?.xpDelta),reason=String(body?.reason||"").trim().slice(0,500);
  if(!UUID.test(personnelId)||!Number.isInteger(delta)||delta===0||Math.abs(delta)>100000||reason.length<3)return fail("Invalid XP correction",400);
  try{
    const result=await withPostgresTransaction(async client=>{
      const person=await client.query("select name from public.personnel where id=$1 for update",[personnelId]);if(!person.rowCount)throw new Error("NOT_FOUND");
      await client.query(`insert into public.personnel_xp_profiles(personnel_id,total_xp,current_level,lifetime_kill_count,lifetime_death_count,lifetime_teamkill_count)
        values($1,0,1,0,0,0) on conflict(personnel_id) do nothing`,[personnelId]);
      const current=await client.query<{total_xp:number}>("select total_xp from public.personnel_xp_profiles where personnel_id=$1 for update",[personnelId]);
      const previous=Number(current.rows[0].total_xp),next=Math.max(0,previous+delta),applied=next-previous;
      await client.query(`update public.personnel_xp_profiles set total_xp=$2,current_level=public.calculate_arma_xp_level($2),updated_at=now() where personnel_id=$1`,[personnelId,next]);
      const adjustment=await client.query(`insert into public.personnel_xp_adjustments(personnel_id,xp_delta,previous_total,new_total,reason,adjusted_by)
        values($1,$2,$3,$4,$5,$6) returning *`,[personnelId,applied,previous,next,reason,auth.userId]);
      await client.query(`insert into public.audit_logs(user_id,target_personnel_id,action,details)
        values($1,$2,'XP_ADJUSTED',$3)`,[auth.userId,personnelId,`${applied>=0?"+":""}${applied} XP: ${reason}`]);
      return adjustment.rows[0];
    });
    return NextResponse.json({adjustment:result});
  }catch(error){if((error as Error).message==="NOT_FOUND")return fail("Personnel record not found",404);console.error("[admin-xp] Adjustment failed",error);return fail("Failed to apply XP correction",500);}
}
