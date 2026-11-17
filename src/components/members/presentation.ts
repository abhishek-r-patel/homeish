// Fixed labels for membership roles, relationships and access states.
export const MEMBER_LABELS: Readonly<Record<string, string>> = {
  admin: 'Administrator',
  committee: 'Committee',
  guard: 'Guard',
  hk_supervisor: 'Housekeeping supervisor',
  resident: 'Resident',
  owner: 'Owner',
  tenant: 'Tenant',
  family: 'Family',
  invited: 'Invited',
  pending: 'Pending',
  pending_approval: 'Pending approval',
  active: 'Active',
  rejected: 'Rejected',
  deactivated: 'Deactivated',
  ended: 'Ended',
};
