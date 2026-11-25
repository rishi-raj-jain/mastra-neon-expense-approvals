import { createStep, createWorkflow } from '@mastra/core/workflows';
import { getRequestUser } from '@mastra/core/utils';
import { z } from 'zod';
import type { NeonAuthUser } from '@mastra/auth-neon';
import { APPROVER_ROLES, rbac } from '../auth';
import { pool } from '../db';

const requestSchema = z.object({
  requestId: z.number(),
  requesterId: z.string(),
  amountCents: z.number(),
  limitCents: z.number(),
});

const submitRequest = createStep({
  id: 'submit-request',
  description: 'Saves the request and checks it against the policy limit',
  inputSchema: z.object({
    category: z.enum(['meals', 'software', 'equipment', 'travel']),
    amountUsd: z.number().positive(),
    description: z.string().min(3),
  }),
  outputSchema: requestSchema,
  execute: async ({ inputData, requestContext, runId }) => {
    // The requester is the signed-in user, never a value from the input.
    const user = getRequestUser(requestContext);
    if (!user) throw new Error('Sign in to submit an expense');

    const amountCents = Math.round(inputData.amountUsd * 100);
    const { rows } = await pool.query(
      `INSERT INTO expense_requests
         (organization_id, requester_id, category, amount_cents, description, workflow_run_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, (SELECT auto_approve_limit_cents FROM expense_policies WHERE category = $3) AS limit_cents`,
      [process.env.NEON_AUTH_ORGANIZATION_ID, user.id, inputData.category, amountCents, inputData.description, runId],
    );

    return {
      requestId: Number(rows[0].id),
      requesterId: user.id,
      amountCents,
      limitCents: rows[0].limit_cents,
    };
  },
});

const financeApproval = createStep({
  id: 'finance-approval',
  description: 'Waits for a finance admin when the amount is over the policy limit',
  inputSchema: requestSchema,
  outputSchema: z.object({
    requestId: z.number(),
    status: z.enum(['auto_approved', 'approved', 'rejected']),
    decidedBy: z.string().nullable(),
    note: z.string().nullable(),
  }),
  suspendSchema: z.object({
    requestId: z.number(),
    amountUsd: z.number(),
    limitUsd: z.number(),
    message: z.string(),
  }),
  resumeSchema: z.object({
    approved: z.boolean(),
    note: z.string().optional(),
  }),
  execute: async ({ inputData, resumeData, suspend, requestContext }) => {
    const { requestId, requesterId, amountCents, limitCents } = inputData;

    if (amountCents <= limitCents) {
      return { requestId, status: 'auto_approved' as const, decidedBy: null, note: null };
    }

    const waitForFinance = (message: string) =>
      suspend({ requestId, amountUsd: amountCents / 100, limitUsd: limitCents / 100, message });

    if (!resumeData) {
      return waitForFinance('Over the policy limit. A finance admin needs to approve or reject it.');
    }

    // resumeData comes from whoever resumed the run, so check that person
    // before you trust it. A member can resume runs too.
    const user = getRequestUser(requestContext);
    const roles = await rbac.getRoles(requestContext.get('mastra__user') as NeonAuthUser);
    if (!user || !roles.some(role => APPROVER_ROLES.includes(role))) {
      return waitForFinance(`${user?.email ?? 'This user'} can't approve expenses. Still waiting for finance.`);
    }
    if (user.id === requesterId) {
      return waitForFinance("Requesters can't approve their own expenses. Still waiting for finance.");
    }

    return {
      requestId,
      status: resumeData.approved ? ('approved' as const) : ('rejected' as const),
      decidedBy: user.id,
      note: resumeData.note ?? null,
    };
  },
});

const recordDecision = createStep({
  id: 'record-decision',
  description: 'Writes the decision to expense_requests',
  inputSchema: financeApproval.outputSchema,
  outputSchema: z.object({ requestId: z.number(), status: z.string() }),
  execute: async ({ inputData }) => {
    await pool.query(
      `UPDATE expense_requests
       SET status = $2, decided_by = $3, decision_note = $4, decided_at = now()
       WHERE id = $1`,
      [inputData.requestId, inputData.status, inputData.decidedBy, inputData.note],
    );
    return { requestId: inputData.requestId, status: inputData.status };
  },
});

export const expenseApproval = createWorkflow({
  id: 'expense-approval',
  description: 'Files an expense request and waits for finance when it is over the policy limit',
  inputSchema: submitRequest.inputSchema,
  outputSchema: recordDecision.outputSchema,
})
  .then(submitRequest)
  .then(financeApproval)
  .then(recordDecision)
  .commit();
