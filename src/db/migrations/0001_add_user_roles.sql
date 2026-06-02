-- Add role column to users table
-- Safe to run multiple times (IF NOT EXISTS check on the constraint)

ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';

-- Set existing admin accounts to admin role
UPDATE users SET role = 'admin' WHERE email = 'andrew@mccreath.vip';

-- Add check constraint (drop first if it exists to allow re-runs)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('member', 'organiser', 'admin'));
