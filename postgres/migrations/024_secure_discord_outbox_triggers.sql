-- These trigger functions are the only writers allowed to enqueue automatic
-- Discord role work. Run them as their trusted migration owner instead of
-- granting the website runtime arbitrary INSERT access to the outbox table.
alter function public.notify_cert_change() security definer;
alter function public.notify_cert_change() set search_path = '';
alter function public.notify_user_created() security definer;
alter function public.notify_user_created() set search_path = '';
alter function public.sync_personnel_discord_tags() security definer;
alter function public.sync_personnel_discord_tags() set search_path = '';

revoke all on function public.notify_cert_change() from public;
revoke all on function public.notify_user_created() from public;
revoke all on function public.sync_personnel_discord_tags() from public;

