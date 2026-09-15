-- Slice 2 keeps membership lifecycle reversible while making inactive memberships
-- impossible to use for session or tenant resolution.
ALTER TABLE "Membership"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
