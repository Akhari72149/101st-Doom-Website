update public.audit_logs
set details = regexp_replace(
  details,
  '^Updated display role tags for account [0-9a-fA-F-]{36}: ',
  'Role tags updated to '
)
where action = 'ACCOUNT_ROLE_TAGS_UPDATED'
  and details ~ '^Updated display role tags for account [0-9a-fA-F-]{36}: ';
