import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = "admin.mod-taskboard";
const ADMIN_KEY = "admin.mod-taskboard-admin";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = ["intake","approved","in_development","internal_review","testing","ready_for_release","released","cancelled"] as const;
const PRIORITIES = ["low","medium","high","critical"] as const;
const TYPES = ["bug","feature","asset","balance","maintenance","documentation","up_for_grabs"] as const;
const WORKSTREAMS = ["design","modelling","texturing","scripting","audio","documentation","quality","other"] as const;
const MOD_TARGETS = new Set(["dba_core","dba_republic","dba_cis","dba_imperial","dba_independant","101st_aux","musical_archives"]);
const PIPELINE_SPECIALTIES = new Set(["armour_artist","texture_artist","model_artist","script_artist","testing_team","animation_artist"]);
const TAGS = new Set(["Bug","Helmet","New Feature","Update","Up For Grabs"]);
const STATUS_SET = new Set<string>(STATUSES);
const PRIORITY_SET = new Set<string>(PRIORITIES);
const TYPE_SET = new Set<string>(TYPES);
const WORKSTREAM_SET = new Set<string>(WORKSTREAMS);
type Row = Record<string, unknown>;

function cleanText(value: unknown, max: number) { return String(value ?? "").trim().slice(0,max); }
function nullableUuid(value: unknown) { const text=String(value ?? ""); return text && UUID.test(text) ? text : null; }
function parseDate(value: unknown) { if(!value) return null; const date=new Date(String(value)); return Number.isNaN(date.getTime()) ? undefined : date.toISOString(); }
function labelForMessage(value:string){return value.replaceAll("_"," ").replace(/\b\w/g,char=>char.toUpperCase());}

async function requirePipelineAccess(request:Request,adminOnly=false) {
  return requirePageAccess(request,adminOnly?ADMIN_KEY:KEY,"read").catch(()=>null);
}

async function isAkhariAccount(userId:string) {
  const result=await getPostgresPool().query<{allowed:boolean}>(
    "select lower(username)='akhari' allowed from public.app_auth_users where id=$1",
    [userId],
  );
  return result.rows[0]?.allowed===true;
}

function parseTask(value: unknown) {
  const body=value as Row|null;
  const title=cleanText(body?.title,200),status=cleanText(body?.status,40),priority=cleanText(body?.priority,20);
  const requestedTypes=Array.isArray(body?.task_types)?body.task_types.map(item=>cleanText(item,30)):[];
  const taskTypes=requestedTypes.length?requestedTypes:[cleanText(body?.task_type,30)];
  const taskType=taskTypes[0],workstream=cleanText(body?.workstream,30);
  const tags=Array.isArray(body?.tags)?body.tags.map(String):[],modTargets=Array.isArray(body?.mod_targets)?body.mod_targets.map(String):[],dueDate=parseDate(body?.due_date);
  if(!title||!STATUS_SET.has(status)||!PRIORITY_SET.has(priority)||taskTypes.length>7||new Set(taskTypes).size!==taskTypes.length||taskTypes.some(type=>!TYPE_SET.has(type))||!WORKSTREAM_SET.has(workstream)
    ||dueDate===undefined||tags.length>5||tags.some(tag=>!TAGS.has(tag))||modTargets.length>7||new Set(modTargets).size!==modTargets.length||modTargets.some(target=>!MOD_TARGETS.has(target))) return null;
  return {title,description:cleanText(body?.description,10000)||null,acceptance_criteria:cleanText(body?.acceptance_criteria,10000)||null,
    status,priority,task_type:taskType,task_types:taskTypes,workstream,tags,mod_targets:modTargets,assigned_to:taskTypes.includes("up_for_grabs")?null:nullableUuid(body?.assigned_to),release_id:nullableUuid(body?.release_id),
    parent_task_id:nullableUuid(body?.parent_task_id),
    due_date:dueDate,position:Number.isInteger(Number(body?.position))?Math.max(0,Math.min(100000,Number(body?.position))):0,
    blocked:body?.blocked===true,blocker_reason:body?.blocked===true?cleanText(body?.blocker_reason,2000):null};
}

async function event(client: PoolClient,actorId:string,input:{taskId?:string;releaseId?:string;type:string;summary:string;oldValues?:Row;newValues?:Row;reason?:string|null}) {
  await client.query(`insert into public.mod_pipeline_events(task_id,release_id,actor_id,event_type,summary,old_values,new_values,reason)
    values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8)`,[input.taskId||null,input.releaseId||null,actorId,input.type,input.summary,
    JSON.stringify(input.oldValues||{}),JSON.stringify(input.newValues||{}),input.reason||null]);
}
function changedValues(oldRow:Row,next:Row) {
  const oldValues:Row={},newValues:Row={};
  for(const [key,value] of Object.entries(next)) {
    const old=oldRow[key] instanceof Date?(oldRow[key] as Date).toISOString():oldRow[key];
    if(JSON.stringify(old??null)!==JSON.stringify(value??null)){oldValues[key]=old??null;newValues[key]=value??null;}
  }
  return {oldValues,newValues};
}

async function validateParent(client:PoolClient,taskId:string|null,parentTaskId:string|null) {
  if(!parentTaskId)return;
  if(taskId===parentTaskId)throw new Error("INVALID_PARENT");
  const parent=await client.query("select id from public.mod_pipeline_tasks where id=$1 and archived_at is null",[parentTaskId]);
  if(!parent.rowCount)throw new Error("INVALID_PARENT");
  if(taskId){
    const cycle=await client.query(`with recursive ancestors as (
      select id,parent_task_id from public.mod_pipeline_tasks where id=$1
      union all
      select task.id,task.parent_task_id from public.mod_pipeline_tasks task join ancestors on task.id=ancestors.parent_task_id
    ) select 1 from ancestors where id=$2 limit 1`,[parentTaskId,taskId]);
    if(cycle.rowCount)throw new Error("INVALID_PARENT");
  }
}

async function notifyTaskParticipants(client:PoolClient,taskId:string,actorId:string,eventType:string,title:string,message:string) {
  await client.query("savepoint mod_pipeline_notification");
  try {
    await client.query(`insert into public.mod_pipeline_notifications(recipient_id,task_id,actor_id,event_type,title,message)
      select distinct recipients.user_id,$1,$2,$3,$4,$5 from (
        select assigned_to user_id from public.mod_pipeline_tasks where id=$1
        union select assignee_id from public.mod_pipeline_contributors where task_id=$1
        union select user_id from public.mod_pipeline_watchers where task_id=$1
        union select parent.assigned_to from public.mod_pipeline_tasks child join public.mod_pipeline_tasks parent on parent.id=child.parent_task_id where child.id=$1
        union select parent_watchers.user_id from public.mod_pipeline_tasks child join public.mod_pipeline_watchers parent_watchers on parent_watchers.task_id=child.parent_task_id where child.id=$1
        union select $2::uuid
      ) recipients join public.app_auth_users users on users.id=recipients.user_id and users.disabled=false
      where recipients.user_id is not null`,[taskId,actorId,eventType,title,message]);
    await client.query("release savepoint mod_pipeline_notification");
  } catch(error) {
    await client.query("rollback to savepoint mod_pipeline_notification");
    await client.query("release savepoint mod_pipeline_notification");
    console.error("[mod-taskboard] Task notification failed",{taskId,eventType,error});
  }
}

function databaseErrorReference(error:unknown) {
  if(!error||typeof error!=="object")return null;
  const row=error as {code?:unknown;constraint?:unknown};
  const code=cleanText(row.code,20),constraint=cleanText(row.constraint,100);
  return code?`${code}${constraint?` / ${constraint}`:""}`:null;
}

async function readNotifications(userId:string) {
  const result=await getPostgresPool().query(`select notifications.*,
    coalesce(nullif(btrim(actor."displayUsername"),''),nullif(btrim(actor.name),''),nullif(btrim(actor.username),''),'System') actor_name,
    tasks.reference_number task_reference,tasks.title task_title
    from public.mod_pipeline_notifications notifications
    left join public.app_auth_users actor on actor.id=notifications.actor_id
    left join public.mod_pipeline_tasks tasks on tasks.id=notifications.task_id
    where notifications.recipient_id=$1 order by notifications.created_at desc limit 200`,[userId]);
  return result.rows;
}

async function readPostgres(includeArchive:boolean,userId:string) {
  const pool=getPostgresPool(),taskWhere=includeArchive?"":"where t.archived_at is null";
  await pool.query(`insert into public.mod_pipeline_assignees(id,name,active)
    select u.id,coalesce(nullif(btrim(u."displayUsername"),''),nullif(btrim(u.name),''),nullif(btrim(u.username),''),'Unknown account'),false
    from public.app_auth_users u where u.disabled=false
    on conflict(id) do update set name=excluded.name`);
  const [assignees,pipelinePeople,profiles,tasks,comments,releases,events,contributors,checklist,dependencies,links,approvals,repositories,repositoryLinks,assets,watchers,notifications]=await Promise.all([
    pool.query("select a.id,a.name,a.active,a.specialties from public.mod_pipeline_assignees a join public.app_auth_users u on u.id=a.id and u.disabled=false where a.active=true order by a.name"),
    pool.query("select a.id,a.name,a.active,a.specialties from public.mod_pipeline_assignees a join public.app_auth_users u on u.id=a.id and u.disabled=false order by a.name"),
    pool.query(`select id,coalesce(nullif(btrim("displayUsername"),''),nullif(btrim(name),''),nullif(btrim(username),''),'Unknown account') display_name
      from public.app_auth_users where disabled=false order by display_name`),
    pool.query(`select t.*,r.name release_name,r.version release_version from public.mod_pipeline_tasks t left join public.mod_pipeline_releases r on r.id=t.release_id ${taskWhere} order by t.status,t.position,t.created_at`),
    pool.query(`select c.id,c.task_id,c.user_id,c.content,c.created_at,
      coalesce(nullif(btrim(p."displayUsername"),''),nullif(btrim(p.name),''),nullif(btrim(p.username),'')) display_name
      from public.mod_pipeline_comments c left join public.app_auth_users p on p.id=c.user_id order by c.created_at`),
    pool.query(`select r.*,
      coalesce(nullif(btrim(creator."displayUsername"),''),nullif(btrim(creator.name),''),nullif(btrim(creator.username),'')) created_by_name,
      coalesce(nullif(btrim(approver."displayUsername"),''),nullif(btrim(approver.name),''),nullif(btrim(approver.username),'')) approved_by_name,
      count(t.id)::int task_count from public.mod_pipeline_releases r
      left join public.app_auth_users creator on creator.id=r.created_by left join public.app_auth_users approver on approver.id=r.approved_by
      left join public.mod_pipeline_tasks t on t.release_id=r.id and t.archived_at is null
      group by r.id,creator.id,approver.id order by r.created_at desc`),
    pool.query(`select e.*,
      coalesce(nullif(btrim(p."displayUsername"),''),nullif(btrim(p.name),''),nullif(btrim(p.username),'')) actor_name
      from public.mod_pipeline_events e left join public.app_auth_users p on p.id=e.actor_id order by e.created_at desc limit 1000`),
    pool.query(`select c.*,a.name assignee_name from public.mod_pipeline_contributors c join public.mod_pipeline_assignees a on a.id=c.assignee_id order by c.added_at`),
    pool.query("select * from public.mod_pipeline_checklist_items order by task_id,position,created_at"),
    pool.query(`select d.*,t.reference_number depends_on_reference,t.title depends_on_title from public.mod_pipeline_dependencies d join public.mod_pipeline_tasks t on t.id=d.depends_on_task_id order by d.created_at`),
    pool.query("select * from public.mod_pipeline_links order by created_at"),
    pool.query(`select a.*,
      coalesce(nullif(btrim(p."displayUsername"),''),nullif(btrim(p.name),''),nullif(btrim(p.username),'')) decided_by_name
      from public.mod_pipeline_approvals a left join public.app_auth_users p on p.id=a.decided_by order by a.decided_at desc`),
    pool.query("select * from public.mod_pipeline_repositories order by sort_order,name"),
    pool.query(`select l.*,r.name repository_name,r.web_url repository_url from public.mod_pipeline_repository_links l
      join public.mod_pipeline_repositories r on r.id=l.repository_id order by l.created_at`),
    pool.query(`select id,task_id,file_name,mime_type,byte_size,caption,uploaded_at
      from public.mod_pipeline_assets order by uploaded_at`),
    pool.query(`select task_id,user_id from public.mod_pipeline_watchers where user_id=$1 order by added_at desc`,[userId]),
    readNotifications(userId),
  ]);
  return {assignees:assignees.rows,pipelinePeople:pipelinePeople.rows,profiles:profiles.rows,tasks:tasks.rows,
    comments:comments.rows.map(row=>({...row,profiles:row.display_name?{display_name:row.display_name}:null})),releases:releases.rows,events:events.rows,
    contributors:contributors.rows,checklist:checklist.rows,dependencies:dependencies.rows,links:links.rows,approvals:approvals.rows,
    repositories:repositories.rows,repositoryLinks:repositoryLinks.rows,assets:assets.rows,watchers:watchers.rows,notifications};
}

export async function GET(request:Request) {
  const auth=await requirePipelineAccess(request);if(!auth?.userId)return NextResponse.json({error:"Forbidden"},{status:403});
  try {
    if((process.env.MOD_TASKBOARD_DATABASE_BACKEND||"postgres")!=="postgres") return NextResponse.json({error:"The upgraded Mod Pipeline requires the PostgreSQL backend."},{status:503});
    const params=new URL(request.url).searchParams;
    if(params.get("notifications")==="1")return NextResponse.json({notifications:await readNotifications(auth.userId)},{headers:{"Cache-Control":"no-store"}});
    return NextResponse.json(await readPostgres(params.get("archive")==="1",auth.userId),{headers:{"Cache-Control":"no-store"}});
  } catch(error){console.error("[mod-taskboard] Read failed",error);return NextResponse.json({error:"Failed to load mod pipeline"},{status:500});}
}

export async function POST(request:Request) {
  if(!requestHasSameOrigin(request)) return NextResponse.json({error:"Invalid request origin"},{status:403});
  const auth=await requirePipelineAccess(request);if(!auth)return NextResponse.json({error:"Forbidden"},{status:403});
  const adminAuth=await requirePipelineAccess(request,true);
  const actorId=auth.userId;
  if(!actorId)return NextResponse.json({error:"Forbidden"},{status:403});
  const body=await request.json().catch(()=>null) as Row|null,kind=cleanText(body?.kind||"task",40);
  try {
    if(["dependency","release","repository"].includes(kind)&&!adminAuth)return NextResponse.json({error:"Pipeline administration permission is required."},{status:403});
    const result=await withPostgresTransaction(async client=>{
      if(kind==="task") {
        const parsed=parseTask(body);if(!parsed||(parsed.blocked&&!parsed.blocker_reason))throw new Error("INVALID_TASK");
        if(parsed.mod_targets.includes("musical_archives")&&!(await isAkhariAccount(actorId)))throw new Error("PROTECTED_MOD_TARGET");
        await validateParent(client,null,parsed.parent_task_id);
        const templateName=cleanText(body?.template_name,120)||null;
        const templateChecklist=Array.isArray(body?.template_checklist)
          ? body.template_checklist.map(item=>cleanText(item,500)).filter(Boolean)
          : [];
        if(templateChecklist.length>20)throw new Error("INVALID_TEMPLATE");
        const input={...parsed,release_id:adminAuth?parsed.release_id:null};
        const inserted=await client.query(`insert into public.mod_pipeline_tasks
          (title,description,acceptance_criteria,status,priority,task_type,task_types,workstream,tags,mod_targets,assigned_to,created_by,due_date,position,blocked,blocker_reason,release_id,parent_task_id,stage_entered_at)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,now()) returning *`,
          [input.title,input.description,input.acceptance_criteria,input.status,input.priority,input.task_type,input.task_types,input.workstream,input.tags,input.mod_targets,input.assigned_to,actorId,input.due_date,input.position,input.blocked,input.blocker_reason,input.release_id,input.parent_task_id]);
        if(templateChecklist.length) {
          for(const [position,content] of templateChecklist.entries()) {
            await client.query("insert into public.mod_pipeline_checklist_items(task_id,content,position,created_by) values($1,$2,$3,$4)",[inserted.rows[0].id,content,position,actorId]);
          }
        }
        await event(client,actorId,{taskId:inserted.rows[0].id,type:"task_created",summary:`Created MOD-${String(inserted.rows[0].reference_number).padStart(4,"0")}`,newValues:{...inserted.rows[0],template:templateName,checklist_items:templateChecklist.length}});
        await notifyTaskParticipants(client,inserted.rows[0].id,actorId,"task_assigned","New pipeline task",`${inserted.rows[0].title} has been assigned or linked to you.`);return inserted.rows[0];
      }
      const taskId=cleanText(body?.taskId,50);if(!["release","repository"].includes(kind)&&!UUID.test(taskId))throw new Error("INVALID_TASK");
      if(kind==="watcher") {const enabled=body?.enabled!==false;if(enabled)await client.query("insert into public.mod_pipeline_watchers(task_id,user_id) values($1,$2) on conflict do nothing",[taskId,actorId]);else await client.query("delete from public.mod_pipeline_watchers where task_id=$1 and user_id=$2",[taskId,actorId]);await event(client,actorId,{taskId,type:enabled?"watcher_added":"watcher_removed",summary:enabled?"Started watching task":"Stopped watching task"});return {enabled};}
      if(kind==="checklist") {const content=cleanText(body?.content,500);if(!content)throw new Error("INVALID_CHECKLIST");const pos=await client.query("select coalesce(max(position),-1)+1 position from public.mod_pipeline_checklist_items where task_id=$1",[taskId]);const inserted=await client.query("insert into public.mod_pipeline_checklist_items(task_id,content,position,created_by) values($1,$2,$3,$4) returning *",[taskId,content,pos.rows[0].position,actorId]);await event(client,actorId,{taskId,type:"checklist_added",summary:`Added checklist item: ${content}`});return inserted.rows[0];}
      if(kind==="link") {const label=cleanText(body?.label,100),url=cleanText(body?.url,2000);let parsed:URL;try{parsed=new URL(url);}catch{throw new Error("INVALID_LINK");}if(!label||!["http:","https:"].includes(parsed.protocol))throw new Error("INVALID_LINK");const inserted=await client.query("insert into public.mod_pipeline_links(task_id,label,url,created_by) values($1,$2,$3,$4) returning *",[taskId,label,url,actorId]);await event(client,actorId,{taskId,type:"link_added",summary:`Added link: ${label}`});return inserted.rows[0];}
      if(kind==="repository_link") {const repositoryId=cleanText(body?.repositoryId,50),referenceType=cleanText(body?.referenceType,30),reference=cleanText(body?.reference,300),providedUrl=cleanText(body?.url,2000);if(!UUID.test(repositoryId)||!["issue","branch","pull_request","commit","other"].includes(referenceType)||!reference)throw new Error("INVALID_REPOSITORY_LINK");const repository=await client.query<{name:string;web_url:string}>("select name,web_url from public.mod_pipeline_repositories where id=$1 and active=true",[repositoryId]);if(!repository.rowCount)throw new Error("INVALID_REPOSITORY_LINK");let url:string|null=providedUrl||null;if(url){let parsed:URL;try{parsed=new URL(url);}catch{throw new Error("INVALID_REPOSITORY_LINK");}if(!["http:","https:"].includes(parsed.protocol))throw new Error("INVALID_REPOSITORY_LINK");}else{const base=repository.rows[0].web_url.replace(/\/$/,"").replace(/\.git$/i,"");const encoded=referenceType==="branch"?reference.split("/").map(encodeURIComponent).join("/"):encodeURIComponent(reference);url=referenceType==="issue"?`${base}/issues/${encoded}`:referenceType==="pull_request"?`${base}/pull/${encoded}`:referenceType==="commit"?`${base}/commit/${encoded}`:referenceType==="branch"?`${base}/tree/${encoded}`:base;}const inserted=await client.query("insert into public.mod_pipeline_repository_links(task_id,repository_id,reference_type,reference,url,created_by) values($1,$2,$3,$4,$5,$6) returning *",[taskId,repositoryId,referenceType,reference,url,actorId]);await event(client,actorId,{taskId,type:"repository_linked",summary:`Linked ${repository.rows[0].name} ${referenceType.replaceAll("_"," ")}: ${reference}`,newValues:{repository_id:repositoryId,reference_type:referenceType,reference,url}});return inserted.rows[0];}
      if(kind==="contributor") {const assigneeId=cleanText(body?.assigneeId,50);if(!UUID.test(assigneeId))throw new Error("INVALID_CONTRIBUTOR");const inserted=await client.query("insert into public.mod_pipeline_contributors(task_id,assignee_id,added_by) values($1,$2,$3) on conflict do nothing returning *",[taskId,assigneeId,actorId]);if(inserted.rowCount){await event(client,actorId,{taskId,type:"contributor_added",summary:"Added a contributor",newValues:{assignee_id:assigneeId}});await notifyTaskParticipants(client,taskId,actorId,"contributor_added","Added to a pipeline task","You have been added as a task contributor.");}return inserted.rows[0]||null;}
      if(kind==="dependency") {const dependsOn=cleanText(body?.dependsOn,50);if(!UUID.test(dependsOn)||dependsOn===taskId)throw new Error("INVALID_DEPENDENCY");const inserted=await client.query("insert into public.mod_pipeline_dependencies(task_id,depends_on_task_id,created_by) values($1,$2,$3) on conflict do nothing returning *",[taskId,dependsOn,actorId]);if(inserted.rowCount)await event(client,actorId,{taskId,type:"dependency_added",summary:"Added a task dependency",newValues:{depends_on_task_id:dependsOn}});return inserted.rows[0]||null;}
      if(kind==="approval") {const gate=cleanText(body?.gate,20),decision=cleanText(body?.decision,20),notes=cleanText(body?.notes,2000)||null;if(!["review","testing","release"].includes(gate)||!["approved","rejected"].includes(decision))throw new Error("INVALID_APPROVAL");const inserted=await client.query("insert into public.mod_pipeline_approvals(task_id,gate,decision,notes,decided_by) values($1,$2,$3,$4,$5) returning *",[taskId,gate,decision,notes,actorId]);await event(client,actorId,{taskId,type:"approval_recorded",summary:`${decision==="approved"?"Approved":"Rejected"} ${gate} gate`,newValues:{gate,decision},reason:notes});await notifyTaskParticipants(client,taskId,actorId,"approval_recorded",`${labelForMessage(gate)} decision recorded`,`${decision==="approved"?"Approved":"Rejected"}${notes?`: ${notes}`:"."}`);return inserted.rows[0];}
      if(kind==="release") {const name=cleanText(body?.name,150),version=cleanText(body?.version,80)||null,description=cleanText(body?.description,4000)||null,targetDate=parseDate(body?.target_date);if(!name||targetDate===undefined)throw new Error("INVALID_RELEASE");const inserted=await client.query("insert into public.mod_pipeline_releases(name,version,description,target_date,created_by) values($1,$2,$3,$4,$5) returning *",[name,version,description,targetDate,actorId]);await event(client,actorId,{releaseId:inserted.rows[0].id,type:"release_created",summary:`Created release ${name}`,newValues:inserted.rows[0]});return inserted.rows[0];}
      if(kind==="repository") {const name=cleanText(body?.name,120),webUrl=cleanText(body?.webUrl,500).replace(/\/$/,""),defaultBranch=cleanText(body?.defaultBranch,200)||"main";let parsed:URL;try{parsed=new URL(webUrl);}catch{throw new Error("INVALID_REPOSITORY");}if(!name||!["http:","https:"].includes(parsed.protocol))throw new Error("INVALID_REPOSITORY");const count=await client.query<{count:number}>("select count(*)::int count from public.mod_pipeline_repositories",[]);if(count.rows[0].count>=5)throw new Error("REPOSITORY_LIMIT");const inserted=await client.query("insert into public.mod_pipeline_repositories(name,web_url,default_branch,sort_order,created_by) values($1,$2,$3,$4,$5) returning *",[name,webUrl,defaultBranch,count.rows[0].count,actorId]);await client.query("insert into public.audit_logs(user_id,action,details) values($1,'MOD_PIPELINE_REPOSITORY_CREATED',$2)",[actorId,`Added pipeline repository ${name} (${webUrl})`]);return inserted.rows[0];}
      throw new Error("INVALID_ACTION");
    });return NextResponse.json({ok:true,result},{status:201});
  } catch(error){const message=error instanceof Error?error.message:"";if(message==="PROTECTED_MOD_TARGET")return NextResponse.json({error:"Only Akhari can assign Musical Archives."},{status:403});if(message==="REPOSITORY_LIMIT")return NextResponse.json({error:"The pipeline supports up to five repositories."},{status:409});if((error as {code?:string})?.code==="23505")return NextResponse.json({error:"That repository or task reference is already linked."},{status:409});if((error as {code?:string,constraint?:string})?.code==="23514"&&(error as {constraint?:string})?.constraint==="mod_pipeline_tasks_mod_targets_check")return NextResponse.json({error:"The selected affected mod is not yet enabled in the database. Apply the latest website migration, then try again."},{status:409});if(message.startsWith("INVALID_"))return NextResponse.json({error:message.slice(8).toLowerCase().replaceAll("_"," ")},{status:400});const reference=databaseErrorReference(error);console.error("[mod-taskboard] Create failed",error);return NextResponse.json({error:`Failed to save pipeline item${reference?` (${reference})`:""}`},{status:500});}
}

export async function PATCH(request:Request) {
  if(!requestHasSameOrigin(request))return NextResponse.json({error:"Invalid request origin"},{status:403});
  const auth=await requirePipelineAccess(request);if(!auth)return NextResponse.json({error:"Forbidden"},{status:403});
  const adminAuth=await requirePipelineAccess(request,true);
  const actorId=auth.userId;
  if(!actorId)return NextResponse.json({error:"Forbidden"},{status:403});
  const body=await request.json().catch(()=>null) as Row|null,kind=cleanText(body?.kind||"task",40),id=cleanText(body?.id,50);if(!UUID.test(id))return NextResponse.json({error:"Invalid record"},{status:400});
  try {
    const result=await withPostgresTransaction(async client=>{
      if(kind==="notification_read"){const changed=await client.query("update public.mod_pipeline_notifications set read_at=coalesce(read_at,now()) where id=$1 and recipient_id=$2 returning *",[id,actorId]);if(!changed.rowCount)throw new Error("NOT_FOUND");return changed.rows[0];}
      if(kind==="notifications_read_all"){const changed=await client.query("update public.mod_pipeline_notifications set read_at=coalesce(read_at,now()) where recipient_id=$1 and read_at is null",[actorId]);return {updated:changed.rowCount};}
      if(kind==="checklist"){const row=await client.query("select * from public.mod_pipeline_checklist_items where id=$1 for update",[id]);if(!row.rowCount)throw new Error("NOT_FOUND");const completed=body?.completed===true;const changed=await client.query("update public.mod_pipeline_checklist_items set completed=$2,completed_by=case when $2 then $3::uuid else null end,completed_at=case when $2 then now() else null end where id=$1 returning *",[id,completed,actorId]);await event(client,actorId,{taskId:String(row.rows[0].task_id),type:"checklist_updated",summary:`Marked checklist item ${completed?"complete":"incomplete"}`,oldValues:{completed:row.rows[0].completed},newValues:{completed}});await notifyTaskParticipants(client,String(row.rows[0].task_id),actorId,"checklist_updated","Task checklist updated",`${cleanText(row.rows[0].content,200)} was marked ${completed?"complete":"incomplete"}.`);return changed.rows[0];}
      if(kind==="release"){
        if(!adminAuth)throw new Error("ADMIN_REQUIRED");
        const old=await client.query("select * from public.mod_pipeline_releases where id=$1 for update",[id]);
        if(!old.rowCount)throw new Error("NOT_FOUND");
        if(old.rows[0].status==="released")throw new Error("RELEASE_LOCKED");
        const status=cleanText(body?.status,20);
        if(!["planned","testing","released","cancelled"].includes(status))throw new Error("INVALID_RELEASE");
        const name=cleanText(body?.name,150),version=cleanText(body?.version,80)||null,description=cleanText(body?.description,4000)||null,targetDate=parseDate(body?.target_date);
        if(!name||targetDate===undefined)throw new Error("INVALID_RELEASE");
        const scopeProvided=Array.isArray(body?.task_ids);
        const requestedTaskIds=scopeProvided?(body?.task_ids as unknown[]).map(item=>cleanText(item,50)):[];
        if(scopeProvided&&(requestedTaskIds.length>500||new Set(requestedTaskIds).size!==requestedTaskIds.length||requestedTaskIds.some(taskId=>!UUID.test(taskId))))throw new Error("INVALID_RELEASE_SCOPE");
        let scopeSummary:{added:Row[];removed:Row[]}|null=null;
        if(scopeProvided){
          const currentScope=await client.query("select id,reference_number,title,status from public.mod_pipeline_tasks where release_id=$1 and archived_at is null for update",[id]);
          const requestedScope=await client.query("select id,reference_number,title,status,release_id,archived_at from public.mod_pipeline_tasks where id=any($1::uuid[]) for update",[requestedTaskIds]);
          if(requestedScope.rowCount!==requestedTaskIds.length)throw new Error("INVALID_RELEASE_SCOPE");
          if(requestedScope.rows.some(task=>task.archived_at||["released","cancelled"].includes(task.status)))throw new Error("RELEASE_SCOPE_CLOSED_TASK");
          if(requestedScope.rows.some(task=>task.release_id&&task.release_id!==id))throw new Error("TASK_ALREADY_SCOPED");
          const requestedSet=new Set(requestedTaskIds),currentSet=new Set(currentScope.rows.map(task=>String(task.id)));
          const removed=currentScope.rows.filter(task=>!requestedSet.has(String(task.id)));
          const added=requestedScope.rows.filter(task=>!currentSet.has(String(task.id)));
          if(removed.some(task=>task.status==="released"))throw new Error("RELEASE_SCOPE_CLOSED_TASK");
          if(removed.length){
            const removedIds=removed.map(task=>task.id);
            await client.query("update public.mod_pipeline_tasks set release_id=null,version=version+1,updated_at=now() where id=any($1::uuid[])",[removedIds]);
            for(const task of removed){await event(client,actorId,{taskId:task.id,type:"release_scope_removed",summary:`Removed from release ${name}`,oldValues:{release_id:id},newValues:{release_id:null}});await notifyTaskParticipants(client,task.id,actorId,"release_scope_removed","Removed from release",`${task.reference_number?`MOD-${String(task.reference_number).padStart(4,"0")} `:""}${task.title} was removed from ${name}.`);}
          }
          if(added.length){
            const addedIds=added.map(task=>task.id);
            await client.query("update public.mod_pipeline_tasks set release_id=$2,version=version+1,updated_at=now() where id=any($1::uuid[])",[addedIds,id]);
            for(const task of added){await event(client,actorId,{taskId:task.id,type:"release_scope_added",summary:`Added to release ${name}`,oldValues:{release_id:null},newValues:{release_id:id}});await notifyTaskParticipants(client,task.id,actorId,"release_scope_added","Added to release",`${task.reference_number?`MOD-${String(task.reference_number).padStart(4,"0")} `:""}${task.title} was added to ${name}.`);}
          }
          scopeSummary={
            added:added.map(task=>({id:task.id,reference_number:task.reference_number,title:task.title})),
            removed:removed.map(task=>({id:task.id,reference_number:task.reference_number,title:task.title})),
          };
        }
        let releaseNotes:string|null=null,affectedMods:string[]=[],taskSnapshot:Row[]=[];
        if(status==="released"){
          const scoped=await client.query(`select t.*,
            (select decision from public.mod_pipeline_approvals a where a.task_id=t.id and a.gate='release' order by a.decided_at desc limit 1) release_decision
            from public.mod_pipeline_tasks t where t.release_id=$1 and t.archived_at is null for update`,[id]);
          if(!scoped.rowCount)throw new Error("RELEASE_EMPTY");
          const invalid=scoped.rows.filter(task=>task.blocked||!["ready_for_release","released"].includes(task.status)||task.release_decision!=="approved");
          if(invalid.length)throw new Error("RELEASE_SCOPE_NOT_READY");
          affectedMods=[...new Set(scoped.rows.flatMap(task=>Array.isArray(task.mod_targets)?task.mod_targets:[]))];
          taskSnapshot=scoped.rows.map(task=>({id:task.id,reference_number:task.reference_number,title:task.title,mod_targets:task.mod_targets,task_types:task.task_types,status:"released"}));
          releaseNotes=cleanText(body?.release_notes,10000)||`Released ${scoped.rowCount} pipeline task${scoped.rowCount===1?"":"s"}.`;
          const releasedTasks=await client.query(`update public.mod_pipeline_tasks set status='released',stage_entered_at=now(),released_at=coalesce(released_at,now()),version=version+1,updated_at=now()
            where release_id=$1 and archived_at is null and status='ready_for_release' returning *`,[id]);
          for(const task of releasedTasks.rows)await event(client,actorId,{taskId:task.id,type:"status_changed",summary:"Moved from ready_for_release to released",oldValues:{status:"ready_for_release"},newValues:{status:"released"},reason:`Released with ${name}`});
        }
        const changed=await client.query(`update public.mod_pipeline_releases set name=$2,version=$3,description=$4,status=$5,target_date=$6,
          released_at=case when $5='released' then now() else released_at end,approved_by=case when $5='released' then $7::uuid else approved_by end,
          approved_at=case when $5='released' then now() else approved_at end,release_notes=case when $5='released' then $8 else release_notes end,
          affected_mods=case when $5='released' then $9::text[] else affected_mods end,
          task_snapshot=case when $5='released' then $10::jsonb else task_snapshot end,updated_at=now() where id=$1 returning *`,
          [id,name,version,description,status,targetDate,actorId,releaseNotes,affectedMods,JSON.stringify(taskSnapshot)]);
        const diff=changedValues(old.rows[0],changed.rows[0]);
        await event(client,actorId,{releaseId:id,type:status==="released"?"release_completed":"release_updated",summary:status==="released"?`Released ${name}`:`Updated release ${name}`,...diff,reason:releaseNotes});
        if(scopeSummary&&(scopeSummary.added.length||scopeSummary.removed.length))await event(client,actorId,{releaseId:id,type:"release_scope_updated",summary:`Updated ${name} scope: ${scopeSummary.added.length} added, ${scopeSummary.removed.length} removed`,oldValues:{removed_tasks:scopeSummary.removed},newValues:{added_tasks:scopeSummary.added}});
        return changed.rows[0];
      }
      if(kind==="archive_release_tasks"){
        if(!adminAuth)throw new Error("ADMIN_REQUIRED");
        const release=await client.query("select * from public.mod_pipeline_releases where id=$1 for update",[id]);
        if(!release.rowCount)throw new Error("NOT_FOUND");
        if(release.rows[0].status!=="released")throw new Error("RELEASE_NOT_COMPLETE");
        const archived=await client.query(`update public.mod_pipeline_tasks set archived_at=now(),archived_by=$2,archive_reason=$3,version=version+1,updated_at=now()
          where release_id=$1 and status='released' and archived_at is null returning *`,[id,actorId,`Archived after release ${release.rows[0].name}`]);
        for(const task of archived.rows)await event(client,actorId,{taskId:task.id,type:"task_archived",summary:"Archived released task",reason:`Archived after release ${release.rows[0].name}`});
        await event(client,actorId,{releaseId:id,type:"release_tasks_archived",summary:`Archived ${archived.rowCount} tasks from ${release.rows[0].name}`});
        return {archived:archived.rowCount};
      }
      if(kind==="repository"){if(!adminAuth)throw new Error("ADMIN_REQUIRED");const name=cleanText(body?.name,120),webUrl=cleanText(body?.webUrl,500).replace(/\/$/,""),defaultBranch=cleanText(body?.defaultBranch,200)||"main",active=body?.active!==false;let parsed:URL;try{parsed=new URL(webUrl);}catch{throw new Error("INVALID_REPOSITORY");}if(!name||!["http:","https:"].includes(parsed.protocol))throw new Error("INVALID_REPOSITORY");const changed=await client.query("update public.mod_pipeline_repositories set name=$2,web_url=$3,default_branch=$4,active=$5,updated_at=now() where id=$1 returning *",[id,name,webUrl,defaultBranch,active]);if(!changed.rowCount)throw new Error("NOT_FOUND");await client.query("insert into public.audit_logs(user_id,action,details) values($1,'MOD_PIPELINE_REPOSITORY_UPDATED',$2)",[actorId,`Updated pipeline repository ${name} (${webUrl})`]);return changed.rows[0];}
      if(kind==="assignee"){if(!adminAuth)throw new Error("ADMIN_REQUIRED");const active=body?.active===true;const specialties=Array.isArray(body?.specialties)?body.specialties.map(String):null;if(specialties&&(specialties.length>6||new Set(specialties).size!==specialties.length||specialties.some(item=>!PIPELINE_SPECIALTIES.has(item))))throw new Error("INVALID_SPECIALTIES");const previous=await client.query<{name:string;active:boolean;specialties:string[]}>("select name,active,specialties from public.mod_pipeline_assignees where id=$1 for update",[id]);if(!previous.rowCount)throw new Error("NOT_FOUND");const changed=await client.query("update public.mod_pipeline_assignees set active=$2,specialties=coalesce($3::text[],specialties),updated_at=now() where id=$1 returning *",[id,active,specialties]);const before=previous.rows[0],after=changed.rows[0];await client.query("insert into public.audit_logs(user_id,action,details) values($1,'MOD_PIPELINE_PERSON_UPDATED',$2)",[actorId,`Updated ${after.name}: active ${before.active} -> ${after.active}; specialties ${(before.specialties||[]).join(", ")||"none"} -> ${(after.specialties||[]).join(", ")||"none"}`]);return after;}
      const selected=await client.query("select * from public.mod_pipeline_tasks where id=$1 for update",[id]);if(!selected.rowCount)throw new Error("NOT_FOUND");const old=selected.rows[0] as Row;
      if(Number(body?.version)!==Number(old.version))throw new Error("VERSION_CONFLICT");
      if(kind==="move") {
        const status=cleanText(body?.status,40),beforeId=nullableUuid(body?.beforeId);
        if(!STATUS_SET.has(status))throw new Error("INVALID_STATUS");
        const reason=cleanText(body?.reason,1000)||null;
        const previousIndex=STATUSES.indexOf(String(old.status) as typeof STATUSES[number]),nextIndex=STATUSES.indexOf(status as typeof STATUSES[number]);
        if((nextIndex<previousIndex||status==="cancelled")&&!reason)throw new Error("REASON_REQUIRED");
        if(status==="testing"){
          const approval=await client.query("select 1 from public.mod_pipeline_approvals where task_id=$1 and gate='review' and decision='approved' order by decided_at desc limit 1",[id]);
          if(!approval.rowCount)throw new Error("REVIEW_APPROVAL_REQUIRED");
        }
        if(status==="ready_for_release"){
          const approval=await client.query("select 1 from public.mod_pipeline_approvals where task_id=$1 and gate='testing' and decision='approved' order by decided_at desc limit 1",[id]);
          if(!approval.rowCount)throw new Error("TEST_APPROVAL_REQUIRED");
        }
        if(status==="released"){
          if(!old.release_id)throw new Error("RELEASE_REQUIRED");
          const approval=await client.query("select 1 from public.mod_pipeline_approvals where task_id=$1 and gate='release' and decision='approved' order by decided_at desc limit 1",[id]);
          if(!approval.rowCount)throw new Error("APPROVAL_REQUIRED");
        }
        let positionResult;
        if(beforeId)positionResult=await client.query("select position from public.mod_pipeline_tasks where id=$1 and status=$2 and archived_at is null",[beforeId,status]);
        const targetPosition=positionResult?.rows[0]?.position ?? (await client.query("select coalesce(max(position),-1)+1 position from public.mod_pipeline_tasks where status=$1 and archived_at is null and id<>$2",[status,id])).rows[0].position;
        await client.query("update public.mod_pipeline_tasks set position=position+1 where status=$1 and archived_at is null and id<>$2 and position>=$3",[status,id,targetPosition]);
        const now=new Date().toISOString();
        const changed=await client.query(`update public.mod_pipeline_tasks set status=$2,position=$3,stage_entered_at=case when status<>$2 then $4 else stage_entered_at end,
          started_at=case when started_at is null and $2 not in ('intake','approved') then $4 else started_at end,
          completed_at=case when completed_at is null and $2='ready_for_release' then $4 else completed_at end,
          released_at=case when released_at is null and $2='released' then $4 else released_at end,
          version=version+1,updated_at=now() where id=$1 returning *`,[id,status,targetPosition,now]);
        await event(client,actorId,{taskId:id,type:old.status===status?"task_reordered":"status_changed",summary:old.status===status?`Reordered within ${status}`:`Moved from ${old.status} to ${status}`,oldValues:{status:old.status,position:old.position},newValues:{status,position:targetPosition},reason});
        if(old.status!==status)await notifyTaskParticipants(client,id,actorId,"status_changed","Pipeline stage changed",`Moved from ${labelForMessage(String(old.status))} to ${labelForMessage(status)}${reason?`: ${reason}`:"."}`);
        return changed.rows[0];
      }
      if(kind==="archive"||kind==="restore"){const archive=kind==="archive",reason=cleanText(body?.reason,1000)||null;const changed=await client.query("update public.mod_pipeline_tasks set archived_at=case when $2 then now() else null end,archived_by=case when $2 then $3::uuid else null end,archive_reason=case when $2 then $4::text else null end,version=version+1,updated_at=now() where id=$1 returning *",[id,archive,actorId,reason]);await event(client,actorId,{taskId:id,type:archive?"task_archived":"task_restored",summary:archive?"Archived task":"Restored task",reason});await notifyTaskParticipants(client,id,actorId,archive?"task_archived":"task_restored",archive?"Task archived":"Task restored",reason||`The task was ${archive?"archived":"restored"}.`);return changed.rows[0];}
      const parsed=parseTask(body);if(!parsed||(parsed.blocked&&!parsed.blocker_reason))throw new Error("INVALID_TASK");
      const addsMusicalArchives=parsed.mod_targets.includes("musical_archives")&&!(Array.isArray(old.mod_targets)&&old.mod_targets.includes("musical_archives"));
      if(addsMusicalArchives&&!(await isAkhariAccount(actorId)))throw new Error("PROTECTED_MOD_TARGET");
      await validateParent(client,id,parsed.parent_task_id);
      const input={...parsed,release_id:adminAuth?parsed.release_id:old.release_id as string|null};
      if(input.status==="testing"&&old.status!=="testing"){const approval=await client.query("select 1 from public.mod_pipeline_approvals where task_id=$1 and gate='review' and decision='approved' order by decided_at desc limit 1",[id]);if(!approval.rowCount)throw new Error("REVIEW_APPROVAL_REQUIRED");}
      if(input.status==="ready_for_release"&&old.status!=="ready_for_release"){const approval=await client.query("select 1 from public.mod_pipeline_approvals where task_id=$1 and gate='testing' and decision='approved' order by decided_at desc limit 1",[id]);if(!approval.rowCount)throw new Error("TEST_APPROVAL_REQUIRED");}
      if(input.status==="released"){if(!input.release_id)throw new Error("RELEASE_REQUIRED");const approval=await client.query("select 1 from public.mod_pipeline_approvals where task_id=$1 and gate='release' and decision='approved' order by decided_at desc limit 1",[id]);if(!approval.rowCount)throw new Error("APPROVAL_REQUIRED");}
      const now=new Date().toISOString(),next={...input,stage_entered_at:input.status!==old.status?now:old.stage_entered_at,started_at:!old.started_at&&!["intake","approved"].includes(input.status)?now:old.started_at,completed_at:input.status==="ready_for_release"&&!old.completed_at?now:old.completed_at,released_at:input.status==="released"&&!old.released_at?now:old.released_at};
      const changed=await client.query(`update public.mod_pipeline_tasks set title=$2,description=$3,acceptance_criteria=$4,status=$5,priority=$6,task_type=$7,task_types=$8,workstream=$9,tags=$10,mod_targets=$11,assigned_to=$12,due_date=$13,position=$14,blocked=$15,blocker_reason=$16,release_id=$17,parent_task_id=$18,stage_entered_at=$19,started_at=$20,completed_at=$21,released_at=$22,version=version+1,updated_at=now() where id=$1 returning *`,[id,next.title,next.description,next.acceptance_criteria,next.status,next.priority,next.task_type,next.task_types,next.workstream,next.tags,next.mod_targets,next.assigned_to,next.due_date,next.position,next.blocked,next.blocker_reason,next.release_id,next.parent_task_id,next.stage_entered_at,next.started_at,next.completed_at,next.released_at]);
      const diff=changedValues(old,next),statusChanged=old.status!==next.status;await event(client,actorId,{taskId:id,type:statusChanged?"status_changed":"task_updated",summary:statusChanged?`Moved from ${old.status} to ${next.status}`:"Updated task details",...diff,reason:cleanText(body?.reason,1000)||null});await notifyTaskParticipants(client,id,actorId,statusChanged?"status_changed":"task_updated",statusChanged?"Pipeline stage changed":"Task updated",statusChanged?`Moved from ${labelForMessage(String(old.status))} to ${labelForMessage(next.status)}.`:"Task details were updated.");return changed.rows[0];
    });return NextResponse.json({ok:true,result});
  } catch(error){const message=error instanceof Error?error.message:"";if(message==="ADMIN_REQUIRED")return NextResponse.json({error:"Pipeline administration permission is required."},{status:403});if(message==="PROTECTED_MOD_TARGET")return NextResponse.json({error:"Only Akhari can assign Musical Archives."},{status:403});if(message==="NOT_FOUND")return NextResponse.json({error:"Record not found"},{status:404});if(message==="VERSION_CONFLICT")return NextResponse.json({error:"This task changed while you were editing it. Refresh and try again."},{status:409});if(message==="REASON_REQUIRED")return NextResponse.json({error:"Give a reason when moving work backwards or cancelling it."},{status:400});if(message==="INVALID_PARENT")return NextResponse.json({error:"Choose an active parent that does not create a circular task hierarchy."},{status:400});if(message==="REVIEW_APPROVAL_REQUIRED")return NextResponse.json({error:"Internal review approval is required before testing."},{status:400});if(message==="TEST_APPROVAL_REQUIRED")return NextResponse.json({error:"Testing approval is required before release readiness."},{status:400});if(message==="RELEASE_REQUIRED")return NextResponse.json({error:"Select a release before marking this task released."},{status:400});if(message==="APPROVAL_REQUIRED")return NextResponse.json({error:"Release approval is required before this task can be released."},{status:400});if(message==="RELEASE_EMPTY")return NextResponse.json({error:"Add at least one task to this release before completing it."},{status:400});if(message==="RELEASE_SCOPE_NOT_READY")return NextResponse.json({error:"Every scoped task must be unblocked, Ready for Release, and have its latest release decision approved."},{status:409});if(message==="RELEASE_SCOPE_CLOSED_TASK")return NextResponse.json({error:"Released, cancelled, or archived tasks cannot be added to or removed from an active release."},{status:409});if(message==="TASK_ALREADY_SCOPED")return NextResponse.json({error:"One or more selected tasks already belong to another release."},{status:409});if(message==="RELEASE_LOCKED")return NextResponse.json({error:"Released releases are read-only."},{status:409});if(message==="RELEASE_NOT_COMPLETE")return NextResponse.json({error:"Only completed releases can have their tasks archived."},{status:409});if(message.startsWith("INVALID_"))return NextResponse.json({error:"Invalid pipeline data"},{status:400});const reference=databaseErrorReference(error);console.error("[mod-taskboard] Update failed",error);return NextResponse.json({error:`Failed to update pipeline${reference?` (${reference})`:""}`},{status:500});}
}

export async function DELETE(request:Request) {
  if(!requestHasSameOrigin(request))return NextResponse.json({error:"Invalid request origin"},{status:403});const auth=await requirePipelineAccess(request);if(!auth)return NextResponse.json({error:"Mod Pipeline permission is required."},{status:403});
  const url=new URL(request.url),id=url.searchParams.get("id")||"",kind=url.searchParams.get("kind")||"task";if(!UUID.test(id))return NextResponse.json({error:"Invalid record"},{status:400});
  const tables:Record<string,string>={task:"mod_pipeline_tasks",checklist:"mod_pipeline_checklist_items",link:"mod_pipeline_links",repository_link:"mod_pipeline_repository_links",repository:"mod_pipeline_repositories",contributor:"mod_pipeline_contributors",dependency:"mod_pipeline_dependencies"};if(!tables[kind])return NextResponse.json({error:"Invalid record type"},{status:400});
  const adminOnly=new Set(["task","repository_link","repository","dependency"]);if(adminOnly.has(kind)&&!(await requirePipelineAccess(request,true)))return NextResponse.json({error:"Pipeline administration permission is required."},{status:403});
  try{if(kind==="task"){const archived=await getPostgresPool().query("select 1 from public.mod_pipeline_tasks where id=$1 and archived_at is not null",[id]);if(!archived.rowCount)return NextResponse.json({error:"Archive the task before permanently deleting it."},{status:409});}const field=kind==="contributor"?"assignee_id":kind==="dependency"?"depends_on_task_id":"id",taskId=url.searchParams.get("taskId");const needsTaskScope=kind==="contributor"||kind==="dependency";if(needsTaskScope&&(!taskId||!UUID.test(taskId)))return NextResponse.json({error:"Invalid task scope"},{status:400});const result=await getPostgresPool().query(`delete from public.${tables[kind]} where ${field}=$1${needsTaskScope?" and task_id=$2":""} returning *`,needsTaskScope?[id,taskId]:[id]);if(!result.rowCount)return NextResponse.json({error:"Record not found"},{status:404});if(kind==="repository_link")await getPostgresPool().query(`insert into public.mod_pipeline_events(task_id,actor_id,event_type,summary,old_values) values($1,$2,'repository_unlinked','Removed repository reference',$3::jsonb)`,[result.rows[0].task_id,auth.userId,JSON.stringify({repository_id:result.rows[0].repository_id,reference_type:result.rows[0].reference_type,reference:result.rows[0].reference})]);if(kind==="contributor")await getPostgresPool().query(`insert into public.mod_pipeline_events(task_id,actor_id,event_type,summary,old_values) values($1,$2,'contributor_removed','Removed a contributor',$3::jsonb)`,[result.rows[0].task_id,auth.userId,JSON.stringify({assignee_id:result.rows[0].assignee_id})]);return NextResponse.json({ok:true});}catch(error){console.error("[mod-taskboard] Delete failed",error);return NextResponse.json({error:"Failed to remove record"},{status:500});}
}
