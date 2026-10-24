insert into public.armour_customisation_items
  (slug,name,category,point_cost,rank_requirement,description,sort_order) values
  ('initial-helmet','Initial Helmet Custom','Rank equipment',80,'CST+','Initial helmet customisation. Sheet note: 80 points.',10),
  ('partial-helmet','Partial Helmet Custom (No Visor)','Rank equipment',160,'CP+','Partial helmet customisation without a custom visor. Sheet note: 160 points.',20),
  ('full-helmet','Full Helmet Custom (No Visor)','Rank equipment',228,'CS+','Full helmet customisation without a custom visor. Sheet note: 228 points.',30),
  ('full-helmet-visor','Full Helmet Custom with Visor / Partial Armour','Rank equipment',350,'CSM+','Full helmet and visor with partial armour customisation. Sheet note: 350 points.',40),
  ('officer-package','Full Helmet, Armour, Kama and Partial Pauldron','Rank equipment',420,'Clone 2nd Lieutenant+','Officer customisation package. Sheet note: 420 points.',45)
on conflict (slug) do update
set name=excluded.name,
    category=excluded.category,
    point_cost=excluded.point_cost,
    rank_requirement=excluded.rank_requirement,
    description=excluded.description,
    sort_order=excluded.sort_order,
    active=true,
    updated_at=now();
