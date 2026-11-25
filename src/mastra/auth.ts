import { MastraAuthNeon, MastraRBACNeon } from '@mastra/auth-neon';

export const auth = new MastraAuthNeon({
  // Only people you add to the Acme organization can use this server.
  signUpEnabled: false,
});

export const rbac = new MastraRBACNeon({
  // Read every user's role in the Acme organization, whichever
  // organization is active in their session.
  organizationId: process.env.NEON_AUTH_ORGANIZATION_ID,
  roleMapping: {
    owner: ['*'],
    admin: ['auth:read', 'agents:*', 'workflows:*', 'memory:*'],
    member: ['auth:read', 'agents:read', 'agents:execute', 'workflows:read', 'workflows:execute', 'memory:*'],
    _default: [],
  },
});

// Roles in the Acme organization that can approve expenses.
export const APPROVER_ROLES = ['owner', 'admin'];
