alter table public.site_documents
  add column if not exists background text not null default 'black';

alter table public.site_documents
  drop constraint if exists site_documents_background_check;

alter table public.site_documents
  add constraint site_documents_background_check
  check (background in ('black', 'charcoal', 'navy', 'paper'));
