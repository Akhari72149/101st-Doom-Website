update public.hammer_ridealong_trainees
set joining_hammer=true,
    flight='',
    sere='Not Complete',
    cxc_test='Not Complete',
    updated_at=now()
where lower(btrim(name))=any(array[
  'darth','twisted','sigma','grim','joker','eclipse','warden','giant','razgriz','icarus'
]);
