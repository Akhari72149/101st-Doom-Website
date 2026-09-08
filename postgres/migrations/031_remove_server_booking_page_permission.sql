-- Server booking is public to view and uses its own shared password for writes.
-- Assignments are removed automatically by the permission foreign key cascade.
delete from public.app_page_permissions
where permission_key = 'operations.server-bookings';
