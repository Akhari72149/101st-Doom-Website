do $$
declare
  document_id uuid;
  original_content jsonb;
  updated_content jsonb := '[]'::jsonb;
  block jsonb;
  updated_runs jsonb;
  block_text text;
  block_index integer;
  removed_rule boolean := false;
  remove_attached_bullet boolean := false;
begin
  select id, content
    into document_id, original_content
    from public.site_documents
   where slug = 'rules-and-regulations'
   for update;

  if document_id is null then
    raise exception 'Rules and Regulations document was not found';
  end if;

  insert into public.site_document_revisions(document_id, document_slug, action, snapshot, changed_by)
  select id, slug, 'updated', to_jsonb(documents), null
    from public.site_documents documents
   where id = document_id;

  for block_index in 0..jsonb_array_length(original_content) - 1 loop
    block := original_content -> block_index;

    select coalesce(string_agg(run ->> 'text', '' order by position), '')
      into block_text
      from jsonb_array_elements(coalesce(block -> 'runs', '[]'::jsonb))
           with ordinality as runs(run, position);

    if not removed_rule
       and block ->> 'type' = 'numbered'
       and block_text like 'Do not dual-sim, whether it is a GARC related or non-GARC unit,%' then
      removed_rule := true;
      remove_attached_bullet := true;
      continue;
    end if;

    if remove_attached_bullet then
      remove_attached_bullet := false;
      if block ->> 'type' = 'bullet'
         and block_text like 'Anyone caught will be banned immediately from the unit and discord.%' then
        continue;
      end if;
    end if;

    if block ->> 'type' = 'numbered'
       and coalesce(block ->> 'start', '') ~ '^[0-9]+$'
       and (block ->> 'start')::integer > 1 then
      block := jsonb_set(block, '{start}', to_jsonb((block ->> 'start')::integer - 1), false);
    end if;

    if jsonb_typeof(block -> 'runs') = 'array' then
      select coalesce(jsonb_agg(
        case
          when run ? 'text' then jsonb_set(
            run,
            '{text}',
            to_jsonb(
              replace(
                replace(run ->> 'text',
                  'General Rules and Regulation #6',
                  'General Rules and Regulation #5'),
                '25.1. Troopers found consistently using the In-Game chat incorrectly',
                '24.1. Troopers found consistently using the In-Game chat incorrectly'
              )
            ),
            false
          )
          else run
        end
        order by position
      ), '[]'::jsonb)
        into updated_runs
        from jsonb_array_elements(block -> 'runs')
             with ordinality as runs(run, position);
      block := jsonb_set(block, '{runs}', updated_runs, false);
    end if;

    updated_content := updated_content || jsonb_build_array(block);
  end loop;

  if not removed_rule then
    raise exception 'Dual-sim rule was not found; document was not changed';
  end if;

  update public.site_documents
     set content = updated_content,
         updated_at = now()
   where id = document_id;
end
$$;
