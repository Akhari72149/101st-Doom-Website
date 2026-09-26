insert into public.awards (
  code,
  name,
  description,
  category,
  icon_key,
  ribbon_color,
  award_type,
  trigger_domain,
  trigger_metric,
  trigger_threshold,
  sort_order,
  is_active,
  updated_at
)
values (
  'GOLDEN_CLIPPY',
  'The Golden Clippy',
  'Bestowed upon the battalion''s unrivalled master of administration, whose immaculate records, faultless reports, and exemplary CWO work bring order to operational chaos. Reserved for the best of the best in paperwork.',
  'Administrative Excellence',
  'paperclip',
  '#f5c542',
  'manual',
  null,
  null,
  null,
  95,
  true,
  now()
)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  icon_key = excluded.icon_key,
  ribbon_color = excluded.ribbon_color,
  award_type = excluded.award_type,
  trigger_domain = excluded.trigger_domain,
  trigger_metric = excluded.trigger_metric,
  trigger_threshold = excluded.trigger_threshold,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();
