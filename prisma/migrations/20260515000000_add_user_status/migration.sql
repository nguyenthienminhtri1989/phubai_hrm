-- Add STAFF as a role value for databases created from older migrations.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'STAFF';

-- New account approval status.
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED');

ALTER TABLE "User"
  ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'PENDING';

-- Existing accounts were already approved before this feature existed.
UPDATE "User" SET "status" = 'ACTIVE';

ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STAFF';
