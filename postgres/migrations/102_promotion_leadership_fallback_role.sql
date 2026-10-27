update public.discord_role_outbox
   set payload = jsonb_set(
     payload,
     '{leadershipRoleIds}',
     '["813525376906821642"]'::jsonb,
     true
   ),
       updated_at = now()
 where event_type = 'PROMOTION_READY'
   and status in ('pending', 'processing')
   and upper(coalesce(payload->>'oldRankName', '')) not in ('CR', 'CR-C')
   and coalesce(payload->'leadershipDiscordIds', '[]'::jsonb) = '[]'::jsonb
   and coalesce(payload->'leadershipRoleIds', '[]'::jsonb) = '[]'::jsonb;
