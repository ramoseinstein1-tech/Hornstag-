/**
 * Gate for the one-time admin bootstrap page (app/admin-bootstrap/page.tsx).
 * There is no public "create admin account" page — bootstrap only works
 * while zero admin accounts exist, and this code is the second layer on
 * top of that check: since Hornstag is deployed publicly, without it
 * whoever finds the (unlinked) bootstrap URL first would claim the only
 * admin account. Change the env var around your first deploy.
 */
export const ADMIN_BOOTSTRAP_CODE =
  process.env.NEXT_PUBLIC_ADMIN_BOOTSTRAP_CODE ?? "HORNSTAG-BOOTSTRAP-2026";
