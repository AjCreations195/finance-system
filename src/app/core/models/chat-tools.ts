import type Anthropic from '@anthropic-ai/sdk';

/**
 * Tools the finance assistant can call, shared by both sides: the server
 * sends these definitions to Claude, and the browser runs the calls
 * (chat-tools.service.ts), because the purchase requests live in the
 * browser's session. Same Node type-stripping rules as chat.model.ts.
 *
 * The list must not change during a conversation (Claude's reasoning is tied
 * to it), so it is a constant.
 */

/** Same values as REQUEST_STATUSES (a test keeps them in sync). */
export const TOOL_STATUSES = [
  'accepted', 'inProgress', 'finished', 'forReview', 'sent', 'rejected', 'pending',
  'completed', 'inCorrection', 'suspended', 'verified', 'notExecutable', 'closed', 'delivered',
] as const;

/** The table's status groups (TAB_STATUSES keys). */
export const TOOL_STAGES = ['fullyCompleted', 'partiallyCompleted', 'inProgress', 'rejected'] as const;

/** The "group_by" choices of spending_breakdown. */
export const TOOL_GROUPINGS = ['budget_item', 'creator', 'status', 'stage', 'month'] as const;

/** The "sort" choices of search_purchase_requests. */
export const TOOL_SORTS = ['newest', 'oldest', 'amount_desc', 'amount_asc'] as const;

/** Names of the tools the browser can run (matched in ChatToolsService). */
export type ChatToolName =
  | 'get_overview'
  | 'search_purchase_requests'
  | 'get_purchase_request'
  | 'spending_breakdown'
  | 'open_purchase_request';

// Reusable schema fragments, shared by several tools so the wording stays the same.
// Reusable schema fragments, shared by several tools so the wording stays the same.
const statuses = {
  type: 'array',
  items: { type: 'string', enum: TOOL_STATUSES },
  description: 'Only requests with one of these statuses.',
};
const stage = {
  type: 'string',
  enum: TOOL_STAGES,
  description: 'Only requests in this group of statuses (see the stages in the system prompt).',
};
const dateFrom = { type: 'string', description: 'Earliest request date, inclusive, as YYYY-MM-DD.' };
const dateTo = { type: 'string', description: 'Latest request date, inclusive, as YYYY-MM-DD.' };
const requestNumber = {
  type: 'string',
  description: 'The request number, e.g. "BDRS/2016/019/0042", or just its last digits, e.g. "0042" or "42".',
};

// The tool definitions Claude sees. `description` tells Claude when to use each tool.
const tools: (Anthropic.Beta.BetaTool & { name: ChatToolName })[] = [
  {
    name: 'get_overview',
    description:
      "Today's date, the date range the data covers, the annual budget, the amount committed, the available balance, and the number and total amount of requests per status and per stage. Call this first for questions about totals, balances or 'this month', and whenever you need today's date.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'search_purchase_requests',
    description:
      'Finds purchase requests by text, status, stage, budget item, amount or date. Returns how many match, their total amount, and up to `limit` of them (number, description, budget item, creator, status, date, amount). Call this for questions about specific or filtered requests, e.g. "pending requests over 100,000" or "requests created by Hiba".',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Words to find in the request number, description, budget item name or code, or creator name.',
        },
        statuses,
        stage,
        budget_item: { type: 'string', description: 'Only requests whose budget item name contains this text.' },
        min_amount: { type: 'number', description: 'Smallest amount in QAR, inclusive.' },
        max_amount: { type: 'number', description: 'Largest amount in QAR, inclusive.' },
        date_from: dateFrom,
        date_to: dateTo,
        sort: { type: 'string', enum: TOOL_SORTS, description: 'Order of the results. Default: newest.' },
        limit: { type: 'integer', minimum: 1, maximum: 25, description: 'How many requests to return. Default 10.' },
      },
    },
  },
  {
    name: 'get_purchase_request',
    description:
      'Full details of one purchase request: its fields, the department, urgency and type, the approval workflow (who has it now), and the latest activity. Call this when the user asks about a specific request by number.',
    input_schema: { type: 'object', properties: { number: requestNumber }, required: ['number'] },
  },
  {
    name: 'spending_breakdown',
    description:
      'Totals requests by budget item, creator, status, stage or month: the number of requests and total amount per group, largest first. Call this for "which budget item / who / which month spent the most" and similar comparisons. Filters work as in search_purchase_requests.',
    input_schema: {
      type: 'object',
      properties: {
        group_by: { type: 'string', enum: TOOL_GROUPINGS },
        statuses,
        stage,
        date_from: dateFrom,
        date_to: dateTo,
      },
      required: ['group_by'],
    },
  },
  {
    name: 'open_purchase_request',
    description:
      "Opens a purchase request's details panel in the app, so the user can see it. Call this only when the user asks to open, show or view a specific request.",
    input_schema: { type: 'object', properties: { number: requestNumber }, required: ['number'] },
  },
];

/**
 * Sent to Claude as-is. `eager_input_streaming` streams each call's input as
 * it is written; the browser validates every input before running it.
 */
export const CHAT_TOOLS: Anthropic.Beta.BetaTool[] = tools.map((tool) => ({ ...tool, eager_input_streaming: true }));
