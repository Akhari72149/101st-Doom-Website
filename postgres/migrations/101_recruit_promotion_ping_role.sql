update public.discord_role_outbox
   set payload = jsonb_set(
     jsonb_set(payload, '{leadershipDiscordIds}', '[]'::jsonb, true),
     '{leadershipRoleIds}',
     '["704516430531395634"]'::jsonb,
     true
   ),
       updated_at = now()
 where event_type = 'PROMOTION_READY'
   and status in ('pending', 'processing')
   and upper(coalesce(payload->>'oldRankName', '')) in ('CR', 'CR-C');
