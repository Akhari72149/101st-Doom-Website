update public.uniform_guide_entries entries
set categories = (
      select jsonb_agg(
        case
          when category->>'label' = 'Ammuntion & Grenades'
            then jsonb_set(category, '{label}', '"Ammunition & Grenades"'::jsonb)
          else category
        end
      )
      from jsonb_array_elements(entries.categories) category
    ),
    updated_at = now()
where entries.section_key = 'dagger'
  and entries.categories @> '[{"label":"Ammuntion & Grenades"}]'::jsonb;
