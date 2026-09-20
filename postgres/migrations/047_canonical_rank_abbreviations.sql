do $$
declare
  rename_pair text[];
begin
  foreach rename_pair slice 1 in array array[
    ['CT/PTC', 'PTC'],
    ['CT/PSC', 'PSC'],
    ['CT/PFC', 'PFC'],
    ['CX-C', 'CXC'],
    ['CX-X', 'CXX'],
    ['CX-T', 'CXT'],
    ['CX-P', 'CXP'],
    ['CX-O', 'CXO'],
    ['Clone Major', 'CMaj.']
  ] loop
    if exists (select 1 from public.ranks where upper(name) = upper(rename_pair[1]))
       and not exists (select 1 from public.ranks where upper(name) = upper(rename_pair[2])) then
      update public.ranks
         set name = rename_pair[2]
       where upper(name) = upper(rename_pair[1]);
    end if;
  end loop;
end;
$$;

do $$
declare
  rank_name text;
begin
  foreach rank_name in array array[
    'PTC', 'PSC', 'PFC',
    'CTS', 'CVC', 'CGS', 'SSM', 'BSM',
    'CXC', 'CX', 'CSX', 'CVX', 'CXX', 'CXT', 'CXP', 'CXS', 'CXSS', 'CXMS', 'CXM', 'CXO',
    'CMaj.'
  ] loop
    if not exists (select 1 from public.ranks where upper(name) = upper(rank_name)) then
      insert into public.ranks (name, rank_level, discord_role_id, is_active)
      values (
        rank_name,
        coalesce((select max(rank_level) + 1 from public.ranks), 0),
        null,
        true
      );
    else
      update public.ranks
         set is_active = true
       where upper(name) = upper(rank_name);
    end if;
  end loop;
end;
$$;
