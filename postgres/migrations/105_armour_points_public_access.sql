update public.app_page_permissions
set page_path = '/admin/armour-points',
    label = 'Armour Point Transactions',
    description = 'Use transaction controls on the public armour points page to award, spend, and correct points with a permanent audit trail.'
where permission_key = 'admin.armour-points';
