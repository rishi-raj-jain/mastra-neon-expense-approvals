import { Mastra } from '@mastra/core';
import { PostgresStore } from '@mastra/pg';
import { expenseAgent } from './agents/expense-agent';
import { auth, rbac } from './auth';
import { expenseApproval } from './workflows/expense-approval';

export const mastra = new Mastra({
  agents: { expenseAgent },
  workflows: { expenseApproval },
  // Workflow snapshots live in Neon, so a request waiting for
  // approval survives restarts and deploys.
  storage: new PostgresStore({
    id: 'neon-storage',
    connectionString: process.env.DATABASE_URL!,
    schemaName: 'mastra',
  }),
  server: { auth, rbac },
});
