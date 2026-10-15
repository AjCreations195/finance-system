import { TestBed } from '@angular/core/testing';
import { REQUEST_STATUSES, TAB_STATUSES } from '../models/purchase-request.model';
import { ANNUAL_BUDGET, PurchaseRequestService } from './purchase-request.service';

describe('PurchaseRequestService', () => {
  let service: PurchaseRequestService;

  beforeEach(() => {
    service = TestBed.inject(PurchaseRequestService);
  });

  it('seeds 130 requests with unique ids and valid statuses', () => {
    const requests = service.requests();
    expect(requests.length).toBe(130);
    expect(new Set(requests.map((r) => r.id)).size).toBe(130);
    expect(requests.every((r) => REQUEST_STATUSES.includes(r.status))).toBe(true);
  });

  it('has bilingual text on every request', () => {
    for (const r of service.requests()) {
      expect(r.description.en && r.description.ar).toBeTruthy();
      expect(r.creator.name.en && r.creator.name.ar).toBeTruthy();
    }
  });

  it('getById finds a request, or returns undefined', () => {
    expect(service.getById(1)?.number).toBe('BDRS/2016/019/0008');
    expect(service.getById(9999)).toBeUndefined();
  });

  it('setStatus changes only the given requests', () => {
    const before = service.getById(3)!.status;
    service.setStatus([1, 2], 'closed');

    expect(service.getById(1)!.status).toBe('closed');
    expect(service.getById(2)!.status).toBe('closed');
    expect(service.getById(3)!.status).toBe(before);
  });

  it('setStatus replaces the changed objects instead of mutating them', () => {
    const original = service.getById(1)!;
    service.setStatus([1], 'closed');
    expect(service.getById(1)).not.toBe(original);
    expect(original.status).not.toBe('closed');
  });

  it('delete removes the given requests', () => {
    service.delete([1, 2, 3]);
    expect(service.requests().length).toBe(127);
    expect(service.getById(2)).toBeUndefined();
  });

  describe('summary cards', () => {
    const stat = (id: string) => service.stats().find((s) => s.id === id)!;
    const sum = (statuses: readonly string[]) =>
      service.requests().filter((r) => statuses.includes(r.status)).reduce((total, r) => total + r.amount, 0);

    it('has the balance plus one card per table tab', () => {
      expect(service.stats().map((s) => s.id)).toEqual(['available', 'posted', 'inProgress', 'rejected']);
    });

    it('each tab card totals the amount and number of requests in that tab', () => {
      expect(stat('posted').amount).toBe(sum(TAB_STATUSES.fullyCompleted));
      expect(stat('rejected').amount).toBe(sum(TAB_STATUSES.rejected));
      expect(stat('inProgress').count).toBe(service.requests().filter((r) => TAB_STATUSES.inProgress.includes(r.status)).length);
    });

    it('available balance = yearly budget minus everything not rejected', () => {
      const rejected = sum(TAB_STATUSES.rejected);
      const all = service.requests().reduce((total, r) => total + r.amount, 0);
      expect(stat('available').amount).toBe(ANNUAL_BUDGET - (all - rejected));
    });

    it('updates live: rejecting a request moves its amount from "under procedure" to "rejected" and frees budget', () => {
      const request = service.requests().find((r) => r.status === 'pending')!;
      const before = { available: stat('available').amount, inProgress: stat('inProgress').amount, rejected: stat('rejected').amount };

      service.setStatus([request.id], 'rejected');

      expect(stat('inProgress').amount).toBe(before.inProgress - request.amount);
      expect(stat('rejected').amount).toBe(before.rejected + request.amount);
      expect(stat('available').amount).toBe(before.available + request.amount);
    });

    it('trends compare the newest month with the month before', () => {
      // Backlog growing is bad news; more posted requests is good news.
      expect(stat('inProgress').higherIsBetter).toBe(false);
      expect(stat('posted').higherIsBetter).toBe(true);
      expect(Number.isFinite(stat('posted').change)).toBe(true);
      expect(stat('available').periodParams).toEqual({ year: 2025 });
    });
  });
});
