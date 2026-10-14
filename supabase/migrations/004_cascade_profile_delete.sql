-- Deleting an auth user failed ("Database error deleting user") because
-- profiles.id referenced auth.users without ON DELETE CASCADE. Every other
-- table already cascades from profiles, so this makes a user delete clean
-- up all of their data.
ALTER TABLE profiles DROP CONSTRAINT profiles_id_fkey;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
