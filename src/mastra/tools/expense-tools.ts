import { createTool } from '@mastra/core/tools';
import { getRequestUser } from '@mastra/core/utils';
import { z } from 'zod';
import { pool } from '../db';

export const submitExpense = createTool({
  id: 'submit-expense',
  description: 'Files an expense request for the signed-in user',
  inputSchema: z.object({
    category: z.enum(['meals', 'software', 'equipment', 'travel']),
    amountUsd: z.number().positive(),
    description: z.string().min(3),
  }),
  execute: async (inputData, context) => {
    const workflow = context.mastra!.getWorkflow('expenseApproval');
    const run = await workflow.createRun();
    // Pass the request context through, so the workflow knows who is asking.
    const result = await run.start({ inputData, requestContext: context.requestContext });
    if (result.status === 'suspended') {
      return { status: 'waiting_for_finance', runId: run.runId, details: result.suspendPayload };
    }
    if (result.status === 'success') return result.result;
    return { status: result.status };
  },
});

export const listMyExpenses = createTool({
  id: 'list-my-expenses',
  description: "Lists the signed-in user's 20 most recent expense requests",
  inputSchema: z.object({}),
  execute: async (_inputData, context) => {
    const user = getRequestUser(context.requestContext);
    if (!user) throw new Error('Sign in to see your expenses');
    const { rows } = await pool.query(
      `SELECT r.id, r.category, (r.amount_cents / 100.0)::numeric(10, 2) AS amount_usd, r.description, r.status,
              approver.name AS decided_by, r.decision_note, r.created_at
       FROM expense_requests r
       LEFT JOIN neon_auth."user" approver ON approver.id = r.decided_by
       WHERE r.requester_id = $1
       ORDER BY r.created_at DESC
       LIMIT 20`,
      [user.id],
    );
    return { expenses: rows };
  },
});
