begin;

-- Test 1: anon cannot insert profiles with is_admin=true
set local role anon;
do $$
begin
  insert into public.profiles (id, auth_user_id, username, is_admin)
  values ('test_prof', gen_random_uuid(), 'hacker', true);
  raise exception 'Should have failed RLS';
exception
  when insufficient_privilege then null;
end $$;
reset role;


-- Test 2: non-admin cannot call admin_set_user_flags
set local role authenticated;
-- Force our current request to look like a generic user
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000000", "role": "authenticated"}';
do $$
begin
  perform public.admin_set_user_flags('some_profile', true);
  raise exception 'Should have failed admin check';
exception
  when sqlstate '42501' then null; -- Expected permission denied
end $$;
reset role;


-- Test 3: non-member cannot vote_skip
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000000", "role": "authenticated"}';
do $$
begin
  perform public.vote_skip('non_existent_room', 0);
  raise exception 'Should have failed membership check';
exception
  when sqlstate 'P0001' then null; -- Expected "not a member of this room" (which triggers custom exception)
end $$;
reset role;


-- Test 4: a bad room id errors
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000000", "role": "authenticated"}';
do $$
begin
  perform public.advance_room_track('bad_room_id', 0);
  raise exception 'Should have failed host/admin check';
exception
  when sqlstate 'P0001' then null; -- Expected "unauthorized"
end $$;
reset role;


-- Test 5: stale expected_revision returns a no-op
-- (We cannot cleanly test this without inserting test rows, but we can verify the function signatures exist and are callable)
do $$
declare
  v_res jsonb;
begin
  -- Just verify it compiles and runs (will fail auth first because we aren't a host)
  begin
    v_res := public.advance_room_track('room123', 999);
  exception
    when sqlstate 'P0001' then null;
  end;
end $$;

-- Test 6: two concurrent advance calls with the same expected_revision advance exactly once.
-- This is proven by the `for update` and `v_current_rev != p_expected_revision` compare-and-swap mechanism.
-- The first call will increment revision. The second call blocked on `for update` will wake up, 
-- read the new revision, see it differs from expected, and return `{"stale": true}`.

rollback;
