import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CHAT_TOOLS, TOOL_STATUSES } from '../models/chat-tools';
import { REQUEST_STATUSES, TAB_STATUSES } from '../models/purchase-request.model';
import { ChatToolsService } from './chat-tools.service';
import { LanguageService } from './language.service';
import { ANNUAL_BUDGET, PurchaseRequestService } from './purchase-request.service';
import { WorkspaceTabsService } from './workspace-tabs.service';

/** The parts of each tool's result the tests read. */
interface Overview {
  today: string;
  latest_month: string;
  total_requests: number;
  annual_budget: number;
  committed: number;
  available_balance: number;
  by_stage: Record<string, { count: number }>;
}
interface Search {
  total_matches: number;
  total_amount: number;
  requests: { description: string; amount: number; date: string }[];
}
interface Details {
  number: string;
  department: string;
  workflow: unknown[];
  currently_with: string | null;
}

describe('ChatToolsService', () => {
  let tools: ChatToolsService;
  let requests: PurchaseRequestService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    tools = TestBed.inject(ChatToolsService);
    requests = TestBed.inject(PurchaseRequestService);
  });

  /** Runs a tool that should succeed and returns its parsed result. */
  function run<T = Record<string, unknown>>(name: string, input: unknown = {}): T {
    const outcome = tools.run(name, input);
    expect(outcome.isError, outcome.content).toBe(false);
    return JSON.parse(outcome.content) as T;
  }

  function fails(name: string, input: unknown, message: RegExp): void {
    const outcome = tools.run(name, input);
    expect(outcome.isError).toBe(true);
    expect(outcome.content).toMatch(message);
  }

  const all = () => requests.requests();
  const total = (list = all()) => list.reduce((s, r) => s + r.amount, 0);

  it('the shared tool definitions use the app\'s statuses and stages', () => {
    expect([...TOOL_STATUSES]).toEqual([...REQUEST_STATUSES]);
    const search = CHAT_TOOLS.find((t) => t.name === 'search_purchase_requests')!;
    const stage = (search.input_schema.properties as Record<string, { enum?: string[] }>)['stage'];
    expect(stage.enum).toEqual(Object.keys(TAB_STATUSES));
  });

  it('rejects an unknown tool', () => {
    fails('delete_everything', {}, /Unknown tool/);
  });

  describe('get_overview', () => {
    it('reports the budget, balance and totals per stage', () => {
      const o = run<Overview>('get_overview');
      const committed = total(all().filter((r) => !TAB_STATUSES.rejected.includes(r.status)));

      expect(o.total_requests).toBe(all().length);
      expect(o.annual_budget).toBe(ANNUAL_BUDGET);
      expect(o.committed).toBe(committed);
      expect(o.available_balance).toBe(ANNUAL_BUDGET - committed);
      expect(o.latest_month).toBe('2025-01');
      expect(o.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const stages = Object.values(o.by_stage);
      expect(stages.reduce((s, g) => s + g.count, 0)).toBe(all().length);
    });

    it('follows changes made in the app', () => {
      const before = run<Overview>('get_overview');
      requests.delete([all()[0].id]);
      expect(run<Overview>('get_overview').total_requests).toBe(before.total_requests - 1);
    });
  });

  describe('search_purchase_requests', () => {
    it('filters by stage and amount, and reports the count and total of every match', () => {
      const r = run<Search>('search_purchase_requests', { stage: 'inProgress', min_amount: 100_000 });
      const expected = all().filter((x) => TAB_STATUSES.inProgress.includes(x.status) && x.amount >= 100_000);

      expect(r.total_matches).toBe(expected.length);
      expect(r.total_amount).toBe(total(expected));
      expect(r.requests.length).toBe(Math.min(10, expected.length));
    });

    it('sorts and limits', () => {
      const r = run<{ requests: { amount: number }[] }>('search_purchase_requests', { sort: 'amount_desc', limit: 3 });
      expect(r.requests.map((x) => x.amount)).toEqual([...all()].map((x) => x.amount).sort((a, b) => b - a).slice(0, 3));
    });

    it('finds text in either language and returns text in the interface language', () => {
      const en = run<Search>('search_purchase_requests', { query: 'modem' });
      TestBed.inject(LanguageService).setLanguage('ar');
      const ar = run<Search>('search_purchase_requests', { query: 'modem' });

      expect(en.total_matches).toBeGreaterThan(0);
      expect(ar.total_matches).toBe(en.total_matches);
      expect(ar.requests[0].description).toBe('توريد أجهزة مودم');
    });

    it('filters by date range (inclusive)', () => {
      const r = run<{ requests: { date: string }[] }>('search_purchase_requests', { date_from: '2025-01-01', date_to: '2025-01-31', limit: 25 });
      expect(r.requests.length).toBe(13);
      expect(r.requests.every((x) => x.date.startsWith('2025-01'))).toBe(true);
    });

    it('rejects bad inputs with a message Claude can act on', () => {
      fails('search_purchase_requests', { stage: 'done' }, /stage must be one of/);
      fails('search_purchase_requests', { statuses: ['accepted', 'nope'] }, /statuses must be a list of/);
      fails('search_purchase_requests', { limit: 100 }, /limit must be a whole number from 1 to 25/);
      fails('search_purchase_requests', { min_amount: '5000' }, /min_amount must be a number/);
      fails('search_purchase_requests', { date_from: '01/02/2025' }, /YYYY-MM-DD/);
      fails('search_purchase_requests', { date_from: '2025-02-01', date_to: '2025-01-01' }, /must not be after/);
    });
  });

  describe('get_purchase_request', () => {
    it('finds a request by full number or by its last digits', () => {
      const request = all()[0];
      const byNumber = run<Details>('get_purchase_request', { number: request.number });
      const byDigits = run<Details>('get_purchase_request', { number: '8' });

      expect(byNumber.number).toBe(request.number);
      expect(byDigits.number).toBe(request.number);
      expect(byNumber.workflow.length).toBeGreaterThan(0);
      expect(byNumber.department).toContain('Purchasing');
    });

    it('says who has a request that is waiting for approval', () => {
      const pending = all().find((r) => r.status === 'pending')!;
      expect(run<Details>('get_purchase_request', { number: pending.number }).currently_with).toBe(
        'Mohammed Khaled Al-Tamimi',
      );
    });

    it('reports an unknown or missing number as an error', () => {
      fails('get_purchase_request', { number: '9999' }, /No purchase request has the number/);
      fails('get_purchase_request', {}, /number is required/);
    });
  });

  describe('spending_breakdown', () => {
    it('groups by budget item, largest first, keeping same-named items apart', () => {
      const r = run<{ groups: { group: string; budget_code: string; total_amount: number }[]; total_amount: number }>(
        'spending_breakdown',
        { group_by: 'budget_item' },
      );
      const amounts = r.groups.map((g) => g.total_amount);
      expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
      expect(r.groups.length).toBe(13);
      expect(r.groups.filter((g) => g.group === 'Miscellaneous equipment').length).toBe(2);
      expect(r.total_amount).toBe(total());
    });

    it('groups by month in date order', () => {
      const r = run<{ groups: { group: string }[] }>('spending_breakdown', { group_by: 'month' });
      const months = r.groups.map((g) => g.group);
      expect(months).toEqual([...months].sort());
      expect(months.at(-1)).toBe('2025-01');
    });

    it('requires group_by', () => {
      fails('spending_breakdown', {}, /group_by is required/);
    });
  });

  it('open_purchase_request opens the request in the app', () => {
    const open = vi.spyOn(TestBed.inject(WorkspaceTabsService), 'openRequest').mockImplementation(() => {});
    const request = all()[4];
    expect(run('open_purchase_request', { number: request.number })).toEqual({ opened: request.number });
    expect(open).toHaveBeenCalledWith(request.id);
  });
});
