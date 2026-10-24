delete from public.armour_progression_rank_points
where rank_key = 'CX-O';

update public.armour_progression_rank_points
set sort_order = 265,
    updated_at = now()
where rank_key = 'CXO';
