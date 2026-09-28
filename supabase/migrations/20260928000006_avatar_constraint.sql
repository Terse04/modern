begin;

alter table public.profiles add constraint profiles_avatar_length_check check (length(avatar) <= 1500000) not valid;
alter table public.profiles validate constraint profiles_avatar_length_check;

commit;
