/*
# Create newsletter_subscribers table

1. New Tables
- `newsletter_subscribers` — Stores emails submitted via the storefront newsletter form.
  - `id` (uuid, primary key)
  - `email` (text, unique, not null) — subscriber email
  - `source` (text, default 'footer') — where the signup originated
  - `is_active` (boolean, default true) — allows admin to unsubscribe a user
  - `created_at` (timestamptz, default now())

2. Security
- RLS enabled. Single-tenant app (no Supabase Auth sign-in), so policies use
  `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)` because
  the data is intentionally shared/public (admin uses password-based session
  auth, not Supabase Auth).
  - anon INSERT allowed (storefront footer submits without sign-in).
  - anon + authenticated SELECT/UPDATE/DELETE allowed (admin manages subscribers).

3. Important Notes
1. The storefront anon-key client can now INSERT into newsletter_subscribers;
   the admin (also using anon key) can list, deactivate, and delete subscribers.
2. All statements are idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS).
3. A unique constraint on `email` prevents duplicate subscriptions; the frontend
   handles the duplicate-key error gracefully.
*/

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  source text DEFAULT 'footer',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_newsletter_subscribers" ON newsletter_subscribers;
CREATE POLICY "anon_select_newsletter_subscribers" ON newsletter_subscribers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_newsletter_subscribers" ON newsletter_subscribers;
CREATE POLICY "anon_insert_newsletter_subscribers" ON newsletter_subscribers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_newsletter_subscribers" ON newsletter_subscribers;
CREATE POLICY "anon_update_newsletter_subscribers" ON newsletter_subscribers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_newsletter_subscribers" ON newsletter_subscribers;
CREATE POLICY "anon_delete_newsletter_subscribers" ON newsletter_subscribers FOR DELETE
  TO anon, authenticated USING (true);
