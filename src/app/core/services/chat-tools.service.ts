import { Service, inject } from '@angular/core';
import { ChatToolName, TOOL_GROUPINGS, TOOL_SORTS, TOOL_STAGES, TOOL_STATUSES } from '../models/chat-tools';
import { LocalizedText } from '../models/dashboard.models';
import { PurchaseRequest, RequestStatus, TAB_STATUSES } from '../models/purchase-request.model';
import { LanguageService } from './language.service';
import { ANNUAL_BUDGET, PurchaseRequestService } from './purchase-request.service';
import { WorkspaceTabsService } from './workspace-tabs.service';

/** What goes back to Claude as the tool_result. */
export interface ToolOutcome {
  content: string;
  isError: boolean;
}

/** One of the stage groups (fullyCompleted, partiallyCompleted, inProgress, rejected). */
type Stage = (typeof TOOL_STAGES)[number];
/** The raw input object Claude sent for a tool call, before validation. */
type Input = Record<string, unknown>;

/** A bad tool input; the message goes back to Claude so it can correct the call. */
class ToolInputError extends Error {}

/** Validated filters shared by search_purchase_requests and spending_breakdown (see readFilters). */
interface Filters {
  /** Free text, matched against the request number, description, budget item and creator. */
  query?: string;
  statuses?: RequestStatus[];
  stage?: Stage;
  budgetItem?: string;
  minAmount?: number;
  maxAmount?: number;
  dateFrom?: string;
  dateTo?: string;
}

/** Requests returned by search_purchase_requests when the input gives no limit. */
const DEFAULT_LIMIT = 10;

/**
 * ChatToolsService
 * ----------------
 * Runs the finance assistant's tool calls (defined in chat-tools.ts) against
 * the data in this browser session, so answers match what's on screen,
 * including requests the user approved, rejected or deleted.
 *
 * Every input is validated first; a bad one returns an error result that
 * tells Claude what to fix. Results are compact JSON, with text in the
 * current interface language.
 */
@Service()
export class ChatToolsService {
  private readonly requests = inject(PurchaseRequestService);
  private readonly language = inject(LanguageService);
  private readonly workspace = inject(WorkspaceTabsService);

  /**
   * Entry point for one tool call. Never throws: a bad input or an unexpected
   * failure becomes an error outcome, so Claude gets a result either way.
   */
  run(name: string, input: unknown): ToolOutcome {
    try {
      const args = input && typeof input === 'object' && !Array.isArray(input) ? (input as Input) : {};
      return { content: JSON.stringify(this.call(name, args)), isError: false };
    } catch (err) {
      const message = err instanceof ToolInputError ? err.message : 'The tool failed unexpectedly.';
      return { content: message, isError: true };
    }
  }

  /** Dispatches to the handler for `name`; unknown names are a bad call. */
  private call(name: string, args: Input): unknown {
    switch (name as ChatToolName) {
      case 'get_overview':
        return this.overview();
      case 'search_purchase_requests':
        return this.search(args);
      case 'get_purchase_request':
        return this.details(this.findByNumber(args));
      case 'spending_breakdown':
        return this.breakdown(args);
      case 'open_purchase_request': {
        const request = this.findByNumber(args);
        this.workspace.openRequest(request.id);
        return { opened: request.number };
      }
      default:
        throw new ToolInputError(`Unknown tool "${name}".`);
    }
  }

  // ------------------------------------------------------------------
  // Tools
  // ------------------------------------------------------------------

  /**
   * get_overview: budget figures, the data's date range, and totals per stage
   * and per status. "Latest month" is the month of the newest request.
   */
  private overview() {
    const list = this.requests.requests();
    const days = list.map((r) => localDay(r.date)).sort();
    const latestMonth = days.at(-1)?.slice(0, 7) ?? null;
    const committed = sum(list.filter((r) => stageOf(r.status) !== 'rejected'));
    const inLatestMonth = list.filter((r) => localDay(r.date).startsWith(latestMonth ?? '-'));

    return {
      today: localDay(new Date().toISOString()),
      data_from: days[0] ?? null,
      data_to: days.at(-1) ?? null,
      latest_month: latestMonth,
      latest_year: latestMonth ? Number(latestMonth.slice(0, 4)) : null,
      currency: 'QAR',
      annual_budget: ANNUAL_BUDGET,
      committed,
      available_balance: ANNUAL_BUDGET - committed,
      total_requests: list.length,
      latest_month_requests: { count: inLatestMonth.length, total_amount: sum(inLatestMonth) },
      by_stage: Object.fromEntries(TOOL_STAGES.map((s) => [s, totals(list.filter((r) => stageOf(r.status) === s))])),
      by_status: Object.fromEntries(TOOL_STATUSES.map((s) => [s, totals(list.filter((r) => r.status === s))])),
    };
  }

  /** search_purchase_requests: filters the requests, sorts them, and returns the top `limit` plus the totals. */
  private search(args: Input) {
    const sort = optionalEnum(args, 'sort', TOOL_SORTS) ?? 'newest';
    const limit = optionalInt(args, 'limit', 1, 25) ?? DEFAULT_LIMIT;
    const matches = this.filter(readFilters(args));

    const sorted = [...matches].sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return a.date.localeCompare(b.date);
        case 'amount_desc':
          return b.amount - a.amount;
        case 'amount_asc':
          return a.amount - b.amount;
        default:
          return b.date.localeCompare(a.date);
      }
    });

    return {
      total_matches: matches.length,
      total_amount: sum(matches),
      shown: Math.min(limit, matches.length),
      requests: sorted.slice(0, limit).map((r) => this.row(r)),
    };
  }

  /** spending_breakdown: groups the filtered requests by one field and totals each group. Month groups are sorted by date; the others by amount. */
  private breakdown(args: Input) {
    const groupBy = optionalEnum(args, 'group_by', TOOL_GROUPINGS);
    if (!groupBy) throw new ToolInputError(`group_by is required: one of ${TOOL_GROUPINGS.join(', ')}.`);
    const matches = this.filter(readFilters(args));

    const groups = new Map<string, { group: string; budget_code?: string; count: number; total_amount: number }>();
    for (const r of matches) {
      // Two budget items share a name, so they're told apart by code.
      const [key, label, code] =
        groupBy === 'budget_item'
          ? [r.budgetItem.code, this.text(r.budgetItem.name), r.budgetItem.code]
          : groupBy === 'creator'
            ? [r.creator.email, this.text(r.creator.name)]
            : groupBy === 'status'
              ? [r.status, r.status]
              : groupBy === 'stage'
                ? [stageOf(r.status), stageOf(r.status)]
                : [localDay(r.date).slice(0, 7), localDay(r.date).slice(0, 7)];
      const group = groups.get(key) ?? { group: label, ...(code ? { budget_code: code } : {}), count: 0, total_amount: 0 };
      group.count++;
      group.total_amount += r.amount;
      groups.set(key, group);
    }

    const list = [...groups.values()];
    list.sort(groupBy === 'month' ? (a, b) => a.group.localeCompare(b.group) : (a, b) => b.total_amount - a.total_amount);
    return { group_by: groupBy, total_requests: matches.length, total_amount: sum(matches), groups: list };
  }

  /** get_purchase_request: the table row plus the details the side panel shows (workflow, activity, attachments). */
  private details(request: PurchaseRequest) {
    const d = this.requests.getDetails(request);
    const current = d.workflow.find((s) => s.state === 'current');
    return {
      ...this.row(request),
      products: request.products,
      notes: request.notes,
      creator_email: request.creator.email,
      directorate: this.text(d.directorate),
      department: this.text(d.department),
      fiscal_year: d.fiscalYear,
      letter_number: d.letterNumber,
      request_type: d.requestType,
      supplier_type: d.supplierType,
      reason: d.reason,
      urgency: d.urgency,
      confidentiality: d.confidentiality,
      workflow: d.workflow.map((s) => ({ step: s.key, state: s.state, person: this.text(s.person) })),
      currently_with: current ? this.text(current.person) : null,
      recent_activity: d.activity.map((a) => ({
        date: localDay(a.date),
        person: this.text(a.person),
        action: [this.text(a.message), a.highlight && this.text(a.highlight)].filter(Boolean).join(' '),
      })),
      attachments: d.attachments.length,
    };
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  /** Returns the requests that match every filter that was given. */
  private filter(f: Filters): PurchaseRequest[] {
    const q = f.query?.toLowerCase();
    const budget = f.budgetItem?.toLowerCase();
    return this.requests.requests().filter((r) => {
      const day = localDay(r.date);
      return (
        (!q || this.searchText(r).includes(q)) &&
        (!f.statuses?.length || f.statuses.includes(r.status)) &&
        (!f.stage || stageOf(r.status) === f.stage) &&
        (!budget || this.matchesBoth(r.budgetItem.name, budget)) &&
        (f.minAmount === undefined || r.amount >= f.minAmount) &&
        (f.maxAmount === undefined || r.amount <= f.maxAmount) &&
        (!f.dateFrom || day >= f.dateFrom) &&
        (!f.dateTo || day <= f.dateTo)
      );
    });
  }

  /** Searches both languages, so an English query finds requests while the UI is in Arabic. */
  private searchText(r: PurchaseRequest): string {
    const texts = [r.description, r.budgetItem.name, r.creator.name].flatMap((t) => [t.en, t.ar]);
    return [r.number, r.budgetItem.code, ...texts].join(' ').toLowerCase();
  }

  private matchesBoth(text: LocalizedText, term: string): boolean {
    return text.en.toLowerCase().includes(term) || text.ar.toLowerCase().includes(term);
  }

  /**
   * Finds one request by full number, or by its last digits ("0042" or "42").
   * Throws a ToolInputError when nothing matches, so Claude can try again.
   */
  private findByNumber(args: Input): PurchaseRequest {
    const number = optionalString(args, 'number');
    if (!number) throw new ToolInputError('number is required, e.g. "BDRS/2016/019/0042" or "0042".');
    const wanted = number.trim().toLowerCase();
    const digits = /^\d+$/.test(wanted) ? `/${wanted.padStart(4, '0')}` : null;
    const request = this.requests
      .requests()
      .find((r) => r.number.toLowerCase() === wanted || (digits !== null && r.number.endsWith(digits)));
    if (!request) throw new ToolInputError(`No purchase request has the number "${number}". It may have been deleted.`);
    return request;
  }

  /** The compact form of a request that every tool returns. */
  private row(r: PurchaseRequest) {
    return {
      number: r.number,
      description: this.text(r.description),
      budget_item: this.text(r.budgetItem.name),
      budget_code: r.budgetItem.code,
      creator: this.text(r.creator.name),
      status: r.status,
      stage: stageOf(r.status),
      date: localDay(r.date),
      amount: r.amount,
    };
  }

  /** The text in the interface language, so results match what the user reads. */
  private text(t: LocalizedText): string {
    return t[this.language.lang()];
  }
}

/** Validates the filter inputs shared by the search and breakdown tools. Throws on bad input. */
function readFilters(args: Input): Filters {
  const from = optionalDate(args, 'date_from');
  const to = optionalDate(args, 'date_to');
  if (from && to && from > to) throw new ToolInputError('date_from must not be after date_to.');
  return {
    query: optionalString(args, 'query'),
    statuses: optionalEnumArray(args, 'statuses', TOOL_STATUSES),
    stage: optionalEnum(args, 'stage', TOOL_STAGES),
    budgetItem: optionalString(args, 'budget_item'),
    minAmount: optionalNumber(args, 'min_amount'),
    maxAmount: optionalNumber(args, 'max_amount'),
    dateFrom: from,
    dateTo: to,
  };
}

/** The stage group a status belongs to (the same grouping as the purchase requests tabs). */
function stageOf(status: RequestStatus): Stage {
  return TOOL_STAGES.find((s) => TAB_STATUSES[s].includes(status))!;
}

/** Total amount (QAR) of a list of requests. */
function sum(list: PurchaseRequest[]): number {
  return list.reduce((total, r) => total + r.amount, 0);
}

/** Count and total amount of a list of requests, in the shape the tools return. */
function totals(list: PurchaseRequest[]) {
  return { count: list.length, total_amount: sum(list) };
}

/** YYYY-MM-DD in local time, the date the table shows. */
function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// --- Input validation: absent or null means "not given"; anything else must be valid.

/**
 * True when the input has a value for `key`. A missing key, or one set to
 * null, counts as "not given", so the optional helpers below return undefined.
 */
function given(args: Input, key: string): boolean {
  return args[key] !== undefined && args[key] !== null;
}

/**
 * Reads an optional text input. Returns the trimmed text, or undefined when it
 * is absent or blank. Throws a ToolInputError if the value is not a string.
 */
function optionalString(args: Input, key: string): string | undefined {
  if (!given(args, key)) return undefined;
  if (typeof args[key] !== 'string') throw new ToolInputError(`${key} must be a string.`);
  return (args[key] as string).trim() || undefined;
}

/**
 * Reads an optional number, such as an amount in QAR. It must be a finite
 * number of 0 or more; anything else throws a ToolInputError.
 */
function optionalNumber(args: Input, key: string): number | undefined {
  if (!given(args, key)) return undefined;
  const value = args[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new ToolInputError(`${key} must be a number of 0 or more.`);
  return value;
}

/**
 * Reads an optional whole number within [min, max], such as a result limit.
 * Builds on optionalNumber, so the same basic checks apply first.
 */
function optionalInt(args: Input, key: string, min: number, max: number): number | undefined {
  const value = optionalNumber(args, key);
  if (value !== undefined && (!Number.isInteger(value) || value < min || value > max)) {
    throw new ToolInputError(`${key} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

/**
 * Reads an optional date in the YYYY-MM-DD form. It checks the shape and that
 * Date.parse accepts the string; a wrong format throws a ToolInputError.
 */
function optionalDate(args: Input, key: string): string | undefined {
  const value = optionalString(args, key);
  if (value !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(Date.parse(value)))) {
    throw new ToolInputError(`${key} must be a date as YYYY-MM-DD.`);
  }
  return value;
}

/**
 * Reads an optional single choice from a fixed list, such as a sort order or
 * a stage. The value must be one of `values`; anything else throws a ToolInputError
 * that lists the allowed choices, so Claude can correct the call.
 */
function optionalEnum<T extends string>(args: Input, key: string, values: readonly T[]): T | undefined {
  if (!given(args, key)) return undefined;
  if (!values.includes(args[key] as T)) throw new ToolInputError(`${key} must be one of: ${values.join(', ')}.`);
  return args[key] as T;
}

/**
 * Reads an optional list of choices from a fixed list, such as several
 * statuses. Must be an array whose every item is one of `values` (an empty
 * array is accepted, and means no filter). Otherwise throws a ToolInputError.
 */
function optionalEnumArray<T extends string>(args: Input, key: string, values: readonly T[]): T[] | undefined {
  if (!given(args, key)) return undefined;
  const list = args[key];
  if (!Array.isArray(list) || list.some((v) => !values.includes(v as T))) {
    throw new ToolInputError(`${key} must be a list of: ${values.join(', ')}.`);
  }
  return list as T[];
}
