/**
 * Dashboard data models.
 *
 * Mock content (names, descriptions, item names) is stored in both
 * languages as LocalizedText and shown with the `localize` pipe, so
 * switching language translates the data as well as the labels.
 */

/** Text in both supported languages. */
export interface LocalizedText {
  en: string;
  ar: string;
}

/** A person shown with avatar, name and email (creator, employee…). */
export interface Person {
  name: LocalizedText;
  email: string;
}

// ---------------------------------------------------------------------------
// Statistics cards
// ---------------------------------------------------------------------------
export interface FinancialStat {
  id: string;
  /** Translation key for the card label. */
  label: string;
  /** Amount in riyals. Shown compact, e.g. "50 million riyals". */
  amount: number;
  /** Optional number of items behind the amount, shown under it ("32 requests"). */
  count?: number;
  icon: string;
  /** % change vs the comparison period (negative = decrease). */
  change: number;
  /** Whether a rise is good (true) or bad (false). Sets the trend color. */
  higherIsBetter: boolean;
  /** Translation key of the comparison period, e.g. 'dashboard.period.lastMonth'. */
  period: string;
  /** Placeholder values for the period text, e.g. { year: 2026 }. */
  periodParams?: Record<string, string | number>;
  /** 'text' = colored arrow + % (default); 'pill' = green/red rounded badge. */
  trendStyle?: 'text' | 'pill';
}

// ---------------------------------------------------------------------------
// "My tasks" table
// ---------------------------------------------------------------------------
export type TaskStatus = 'completed' | 'inProgress' | 'executed' | 'review' | 'sent';
export const TASK_STATUSES: readonly TaskStatus[] = ['completed', 'inProgress', 'executed', 'review', 'sent'];

export interface TaskItem {
  id: number;
  number: string;
  description: LocalizedText;
  attachments: number;
  notes: number;
  status: TaskStatus;
  creator: Person;
  /** ISO date */
  date: string;
}

// ---------------------------------------------------------------------------
// Recent activities
// ---------------------------------------------------------------------------
export type ActivityKind = 'message' | 'reply' | 'accepted' | 'answered';

export interface ActivityItem {
  id: number;
  kind: ActivityKind;
  /** ISO date-time */
  date: string;
  actor: LocalizedText;
  /** Translation key of the action sentence. */
  action: string;
  target: LocalizedText;
  /** For a reply: id of the message it answers (shown right under it). */
  replyTo?: number;
}

// ---------------------------------------------------------------------------
// Procurement status (donut + breakdown)
// ---------------------------------------------------------------------------
export type ProcurementState = 'new' | 'all' | 'shipping' | 'pending' | 'cancelled' | 'delivered';

export interface ProcurementBreakdown {
  state: ProcurementState;
  icon: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Recent transactions
// ---------------------------------------------------------------------------
export type TransactionType = 'financial' | 'custody' | 'purchase' | 'warehouse' | 'maintenance';
export const TRANSACTION_TYPES: readonly TransactionType[] = ['financial', 'custody', 'purchase', 'warehouse', 'maintenance'];

export interface TransactionItem {
  id: number;
  number: string;
  type: TransactionType;
  employee: Person;
  /** How long it has been open. */
  duration: { value: number; unit: 'day' | 'week' | 'month' | 'year' };
}

// ---------------------------------------------------------------------------
// Warehouses
// ---------------------------------------------------------------------------
export interface WarehouseItem {
  id: number;
  number: string;
  product: LocalizedText;
  quantity: number;
  unit: LocalizedText;
  minLevel: number;
  maxLevel: number;
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------
export interface ContractItem {
  id: number;
  number: string;
  supplier: LocalizedText;
  /** Supplier logo (public/images/suppliers); without one, the initial on `logoColor` is shown. */
  logoUrl?: string;
  /** Brand color for the initial-letter fallback logo. */
  logoColor: string;
  /** ISO date */
  date: string;
  /** Completion 0–100. */
  progress: number;
}

// ---------------------------------------------------------------------------
// Budget items (stacked bar chart)
// ---------------------------------------------------------------------------
export interface BudgetMonth {
  /** 0 = January … 11 = December */
  month: number;
  spent: number;
  remaining: number;
}

// ---------------------------------------------------------------------------
// Notifications (bell dropdown)
// ---------------------------------------------------------------------------
export interface NotificationItem {
  id: number;
  /** Translation key of the message. */
  message: string;
  reference: string;
  date: string;
  unread: boolean;
  /** Optional extras shown under the message. */
  actions?: boolean;
  attachment?: { name: string; size: string };
  comment?: LocalizedText;
}
