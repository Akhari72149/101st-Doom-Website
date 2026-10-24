update public.app_page_permissions
set page_path = '/armour-points',
    label = 'Armour Point Transactions',
    description = 'Record purchases, appointment awards, and audited point corrections from the public armour points page.'
where permission_key = 'admin.armour-points';
