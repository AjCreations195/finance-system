import { LocalizedText, Person } from './dashboard.models';

/**
 * Purchase request statuses, exactly as in the Figma table.
 * Each value is a translation key (`requests.status.<value>`).
 */
export type RequestStatus =
  | 'accepted'
  | 'inProgress'
  | 'finished'
  | 'forReview'
  | 'sent'
  | 'rejected'
  | 'pending'
  | 'completed'
  | 'inCorrection'
  | 'suspended'
  | 'verified'
  | 'notExecutable'
  | 'closed';

export const REQUEST_STATUSES: readonly RequestStatus[] = [
  'accepted', 'inProgress', 'finished', 'forReview', 'sent', 'rejected', 'pending',
  'completed', 'inCorrection', 'suspended', 'verified', 'notExecutable', 'closed',
];

/**
 * Badge color family for each status (design colors). The families are
 * defined once in styles.scss (.task-badge.badge-*).
 */
export const STATUS_BADGE: Record<RequestStatus, string> = {
  accepted: 'completed',
  completed: 'completed',
  closed: 'completed',
  inProgress: 'inProgress',
  inCorrection: 'inProgress',
  finished: 'executed',
  suspended: 'executed',
  forReview: 'review',
  verified: 'review',
  sent: 'sent',
  notExecutable: 'sent',
  rejected: 'rejected',
  pending: 'pending',
};

/**
 * Icon inside each status badge. Arrows use `flip-rtl` so they point
 * in the reading direction (← in Arabic, → in English), as in the design.
 */
export const STATUS_ICON: Record<RequestStatus, string> = {
  accepted: 'done',
  completed: 'done',
  closed: 'done',
  inProgress: 'in-progress',
  inCorrection: 'in-progress',
  finished: 'done',
  suspended: 'done',
  forReview: 'status-review',
  verified: 'status-review',
  sent: 'done',
  notExecutable: 'done',
  rejected: 'done',
  pending: 'done',
};

/** The tabs above the table, and which statuses each one includes. */
export type RequestTab = 'all' | 'fullyCompleted' | 'partiallyCompleted' | 'inProgress' | 'rejected';

export const TAB_STATUSES: Record<Exclude<RequestTab, 'all'>, readonly RequestStatus[]> = {
  fullyCompleted: ['accepted', 'completed', 'finished', 'closed'],
  partiallyCompleted: ['verified', 'suspended'],
  inProgress: ['inProgress', 'forReview', 'sent', 'pending', 'inCorrection'],
  rejected: ['rejected', 'notExecutable'],
};

/** Final statuses: the request can't be approved any more. */
export const FINAL_STATUSES: readonly RequestStatus[] = ['accepted', 'completed', 'finished', 'closed', 'rejected', 'notExecutable'];

/** Budget line the request is charged to (name + budget code). */
export interface BudgetItem {
  name: LocalizedText;
  code: string;
}

/** One purchase request (a row in the table). */
export interface PurchaseRequest {
  id: number;
  number: string;
  budgetItem: BudgetItem;
  description: LocalizedText;
  /** Number of products in the request. */
  products: number;
  notes: number;
  status: RequestStatus;
  creator: Person;
  /** ISO date */
  date: string;
  /** Estimated cost in riyals. */
  amount: number;
}

/** Currency for all amounts (the design shows riyals). */
export const CURRENCY = 'QAR';

// ---------------------------------------------------------------------------
// Request details (side panel, Figma "بيانات طلب شراء")
// ---------------------------------------------------------------------------

/** Approval workflow step, shown in the panel's timeline (stepper). */
export interface WorkflowStep {
  /** Translation key suffix: `requests.details.steps.<key>`. */
  key: 'created' | 'approval' | 'returned' | 'accepted' | 'rejected';
  state: 'done' | 'current' | 'pending' | 'rejected';
  /** Who handled (or will handle) the step. */
  person: LocalizedText;
}

/** One entry of the activity log (who did what, when). */
export interface ActivityEntry {
  id: number;
  person: LocalizedText;
  /** ISO date-time */
  date: string;
  message: LocalizedText;
  /** Highlighted part of the message (a person or a step), shown in the brand color. */
  highlight?: LocalizedText;
  attachment?: { name: string; size: string };
  /** Small chips listing the individual actions taken. */
  tags?: LocalizedText[];
}

export interface RequestAttachment {
  id: number;
  name: LocalizedText;
  kind: 'image' | 'pdf';
  size: string;
}

/**
 * Everything the details panel shows for one request. The table row
 * (`request`) plus the fields only the details view needs; a real API
 * would return this from GET /purchase-requests/:id.
 */
export interface PurchaseRequestDetails {
  request: PurchaseRequest;
  directorate: LocalizedText;
  department: LocalizedText;
  fiscalYear: number;
  letterNumber: string;
  /** The following are translation key suffixes under `requests.details.values`. */
  supplierType: 'local' | 'international';
  reason: 'departmentNeeds' | 'replacement' | 'newProject';
  requestType: 'direct' | 'tender';
  confidentiality: 'normal' | 'confidential';
  privacy: 'none' | 'restricted';
  urgency: 'urgent' | 'normal';
  views: number;
  workflow: WorkflowStep[];
  activity: ActivityEntry[];
  creatorRole: LocalizedText;
  creatorPhone: string;
  attachments: RequestAttachment[];
}
