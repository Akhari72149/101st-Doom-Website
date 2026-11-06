update public.recruitment_form_blocks
set description='Select every Main Operation you can regularly attend. Times are shown in Eastern Time and may be edited by recruitment staff when schedules change.',
    options='["Tomahawk 1 - 3:00 PM to 5:00 PM ET","Claymore 2 - 7:00 PM to 9:00 PM ET","Broadsword 3 - 9:00 PM to 11:00 PM ET","Dagger - 6:00 PM to 8:00 PM ET"]'::jsonb,
    updated_at=now()
where field_key='platoons';

update public.recruitment_form_blocks
set description='The 101st runs four platoon Main Operations. Select the Eastern Time operation windows you can regularly attend.',
    updated_at=now()
where block_type='information' and title='Main Operations';
