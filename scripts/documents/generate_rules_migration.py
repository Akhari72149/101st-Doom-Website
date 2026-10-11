#!/usr/bin/env python3
"""Generate the managed-document schema and initial Rules document migration."""

from __future__ import annotations

import argparse
import json


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("content")
    parser.add_argument("output")
    args = parser.parse_args()
    with open(args.content, "r", encoding="utf-8") as source:
        content = json.load(source)
    payload = json.dumps(content, ensure_ascii=False, separators=(",", ":"))
    sql = f"""create table if not exists public.site_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null,
  summary text not null default '',
  category text not null default 'General',
  content jsonb not null default '[]'::jsonb check (jsonb_typeof(content) = 'array'),
  source_url text,
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.app_auth_users(id) on delete set null
);

create table if not exists public.site_document_revisions (
  id bigserial primary key,
  document_id uuid references public.site_documents(id) on delete set null,
  document_slug text not null,
  action text not null check (action in ('created','updated','deleted','published','unpublished')),
  snapshot jsonb not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references public.app_auth_users(id) on delete set null
);

create index if not exists site_documents_public_order_idx on public.site_documents(published, sort_order, title);
create index if not exists site_document_revisions_changed_at_idx on public.site_document_revisions(changed_at desc);

insert into public.site_documents
  (slug, title, summary, category, content, source_url, sort_order, published)
values
  ('rules-and-regulations', 'Rules and Regulations',
   'Official conduct, operation, TeamSpeak, GARC, MOS, NCO, and Discord standards for the 101st Doom Battalion.',
   'General', $rules${payload}$rules$::jsonb,
   'https://docs.google.com/document/d/15tsyHzBSaqfvB-VcIr-eGbhROFKbX8zjc3_L4fA2ZrQ/edit?usp=sharing', 0, true)
on conflict (slug) do nothing;

alter table public.site_documents enable row level security;
alter table public.site_document_revisions enable row level security;
revoke all on public.site_documents from public;
revoke all on public.site_document_revisions from public;
grant select, insert, update, delete on public.site_documents to roster_app_runtime;
grant select, insert on public.site_document_revisions to roster_app_runtime;
grant usage, select on sequence public.site_document_revisions_id_seq to roster_app_runtime;

drop policy if exists "native runtime site documents" on public.site_documents;
create policy "native runtime site documents" on public.site_documents for all to roster_app_runtime using (true) with check (true);
drop policy if exists "native runtime site document revisions" on public.site_document_revisions;
create policy "native runtime site document revisions" on public.site_document_revisions for all to roster_app_runtime using (true) with check (true);

insert into public.app_page_permissions (permission_key, page_path, label, category, description)
values ('admin.documents', '/admin/documents', 'Document Library', 'Systems',
        'Review and maintain published website documents and rich-text content.')
on conflict (permission_key) do update
set page_path=excluded.page_path, label=excluded.label, category=excluded.category,
    description=excluded.description, updated_at=now();

insert into public.user_page_permissions (user_id, permission_key, access_level, granted_by, updated_at)
select users.id, 'admin.documents', 'full', users.id, now()
from public.app_auth_users users
where lower(users.username) = 'akhari'
on conflict (user_id, permission_key) do update
set access_level='full', granted_by=excluded.granted_by, updated_at=now();
"""
    with open(args.output, "w", encoding="utf-8", newline="\n") as output:
        output.write(sql)
    print(f"Generated migration with {len(content)} blocks")


if __name__ == "__main__":
    main()
