update public.rank_history as rank_history
set changed_at = timestamptz '2026-08-28 12:00:00+00'
from public.personnel as personnel
where rank_history.personnel_id = personnel.id
  and lower(personnel.name) = 'soren'
  and rank_history.new_rank_id = personnel.rank_id
  and rank_history.changed_at >= timestamptz '2026-08-28 12:00:00+00';
