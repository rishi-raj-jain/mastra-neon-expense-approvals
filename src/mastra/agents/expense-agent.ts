import { Agent } from '@mastra/core/agent';
import { listMyExpenses, submitExpense } from '../tools/expense-tools';

export const expenseAgent = new Agent({
  id: 'expense-agent',
  name: 'Expense Agent',
  instructions: ({ user }) => `You help ${user?.name ?? 'an Acme employee'} file and track expense requests.
- To file a request, you need a category (meals, software, equipment, or travel), an amount in US dollars, and a short description. Ask for anything that's missing, then call submit-expense.
- If submit-expense returns waiting_for_finance, say the amount is over the policy limit and a finance admin will review it.
- To answer questions about past requests, call list-my-expenses. You can only see the signed-in user's requests.
- You can't approve or reject expenses.`,
  model: 'mastra/anthropic/claude-haiku-5.5',
  tools: { submitExpense, listMyExpenses },
});
