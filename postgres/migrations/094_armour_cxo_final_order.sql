update public.armour_progression_rank_points
set sort_order = 275,
    updated_at = now()
where rank_key = 'CXO';
