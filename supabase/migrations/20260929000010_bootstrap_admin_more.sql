update public.profiles
set is_admin = true,
    role = 'admin'
where username in ('terse04', 'terse07');
