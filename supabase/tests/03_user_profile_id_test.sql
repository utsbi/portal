-- D4: user_profile_id(check_uid) must honor its parameter (return the profile id
-- for the PASSED uid), not silently return the caller's own profile id.
BEGIN;
SELECT plan(4);

-- Impersonate Client A, but ask for Client B's profile id by uid.
SELECT t.as_user(t.uid_clienta());

SELECT is(
  public.user_profile_id(t.uid_clientb()),
  t.id('profile_clientb'),
  'user_profile_id(otherUid) returns the OTHER user''s profile id, not the caller''s'
);

SELECT isnt(
  public.user_profile_id(t.uid_clientb()),
  t.id('profile_clienta'),
  'user_profile_id(otherUid) does NOT return the caller''s own profile id'
);

-- Passing the caller's own uid still returns the caller's profile id.
SELECT is(
  public.user_profile_id(t.uid_clienta()),
  t.id('profile_clienta'),
  'user_profile_id(ownUid) returns the caller''s own profile id'
);

-- Unknown uid yields NULL.
SELECT is(
  public.user_profile_id('00000000-0000-0000-0000-000000000000'::uuid),
  NULL,
  'user_profile_id(unknownUid) returns NULL'
);

SELECT t.reset_auth();

SELECT * FROM finish();
ROLLBACK;
