-- The Authentication schema.
--
-- Applied by the service's own migration runner. The table lives in the "auth"
-- schema, which the service owns exclusively.

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Already normalised: lowercased and trimmed. The unique index is what
  -- makes "the same address with different capitalisation" one account.
  email         TEXT        NOT NULL,
  -- An Argon2id hash. The plaintext password is never stored.
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Signup looks the user up by email on every request, so it is indexed. The
-- index is unique, which is the last line of defence against two accounts for
-- one address if two signups race.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);
