import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { PageStateService } from './page-state.service';
import { PurchaseRequestService } from './purchase-request.service';
import { MAX_RECORD_TABS, WorkspaceTabsService } from './workspace-tabs.service';

@Component({ template: '' })
class EmptyPage {}

describe('WorkspaceTabsService', () => {
  let service: WorkspaceTabsService;
  let router: Router;

  const setup = async (url = '/dashboard') => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'dashboard', component: EmptyPage },
          { path: 'procurement/purchase-requests', component: EmptyPage },
        ]),
      ],
    });
    router = TestBed.inject(Router);
    service = TestBed.inject(WorkspaceTabsService);
    await go(url);
  };

  const go = async (url: string) => {
    await router.navigateByUrl(url);
    TestBed.tick();
  };
  /** Let a navigation started by the service finish. */
  const settle = async () => {
    await new Promise((r) => setTimeout(r));
    TestBed.tick();
  };
  const ids = () => service.tabs().map((t) => t.id);

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('following the router', () => {
    beforeEach(() => setup());

    it('starts with every module, as in the design, and marks the current page active', () => {
      expect(ids()).toEqual(['dashboard', 'procurement', 'custody', 'requests', 'invoices', 'contracts', 'budget']);
      expect(service.activeId()).toBe('dashboard');
    });

    it('opening a request opens a record tab right after "Purchase request"', async () => {
      await go('/procurement/purchase-requests?view=3');
      expect(ids().slice(0, 3)).toEqual(['dashboard', 'procurement', 'request-3']);
      expect(service.activeId()).toBe('request-3');

      // A second one goes after the first.
      await go('/procurement/purchase-requests?view=5');
      expect(ids().slice(1, 4)).toEqual(['procurement', 'request-3', 'request-5']);
    });

    it('ignores ids of requests that do not exist', async () => {
      await go('/procurement/purchase-requests?view=99999');
      expect(ids().some((id) => id.startsWith('request-'))).toBe(false);
    });

    it('remembers the last URL of each tab', async () => {
      await go('/procurement/purchase-requests?foo=1');
      await go('/dashboard');
      const tab = service.tabs().find((t) => t.id === 'procurement')!;
      expect(service.urlOf(tab)).toBe('/procurement/purchase-requests?foo=1');
    });

    it(`keeps at most ${MAX_RECORD_TABS} record tabs; the oldest goes to "recently closed"`, async () => {
      for (let id = 1; id <= MAX_RECORD_TABS + 1; id++) await go(`/procurement/purchase-requests?view=${id}`);
      const records = ids().filter((id) => id.startsWith('request-'));
      expect(records.length).toBe(MAX_RECORD_TABS);
      expect(records).not.toContain('request-1');
      expect(service.closed()[0].id).toBe('request-1');
    });

    it('deleting a request closes its tab', async () => {
      await go('/procurement/purchase-requests?view=4');
      TestBed.inject(PurchaseRequestService).delete([4]);
      TestBed.tick();
      expect(ids()).not.toContain('request-4');
    });
  });

  describe('closing', () => {
    beforeEach(() => setup());

    it('never closes the pinned dashboard', () => {
      service.close('dashboard');
      expect(ids()).toContain('dashboard');
    });

    it('closing the active tab moves to the next tab that opens a page', async () => {
      await go('/procurement/purchase-requests?view=2');
      service.close('request-2');
      await settle();
      // Next tabs (custody…) have no page yet, so it falls back to the previous one.
      expect(router.url).toBe('/procurement/purchase-requests');
    });

    it('closing an inactive tab does not navigate', () => {
      const navigate = vi.spyOn(router, 'navigateByUrl');
      service.close('custody');
      expect(ids()).not.toContain('custody');
      expect(navigate).not.toHaveBeenCalled();
    });

    it('close others / to the right / all keep the pinned tab', () => {
      service.closeAfter('invoices');
      expect(ids()).toEqual(['dashboard', 'procurement', 'custody', 'requests', 'invoices']);

      service.closeOthers('custody');
      expect(ids()).toEqual(['dashboard', 'custody']);

      service.closeAll();
      expect(ids()).toEqual(['dashboard']);
    });

    it('reopens the most recently closed tab, in its usual place', () => {
      service.close('custody');
      service.close('budget');
      service.reopen();
      expect(ids()).toContain('budget');
      expect(ids()).not.toContain('custody');

      service.reopen();
      expect(ids()).toEqual(['dashboard', 'procurement', 'custody', 'requests', 'invoices', 'contracts', 'budget']);
    });

    it('a closed page starts fresh: its saved state is cleared', () => {
      const pageState = TestBed.inject(PageStateService);
      pageState.save('procurement', { search: 'cables' });
      pageState.save('scroll:procurement', 400);
      service.close('procurement');
      expect(pageState.restore('procurement')).toBeUndefined();
      expect(pageState.restore('scroll:procurement')).toBeUndefined();
    });
  });

  describe('"+" menu actions', () => {
    beforeEach(() => setup());

    it('openModule re-adds a closed module and opens its page', async () => {
      service.close('procurement');
      expect(service.openModule('procurement')).toBe(true);
      await settle();
      expect(ids()).toContain('procurement');
      expect(router.url).toBe('/procurement/purchase-requests');
    });

    it('openModule returns false for modules without a page (but still shows the tab)', () => {
      service.close('budget');
      expect(service.openModule('budget')).toBe(false);
      expect(ids()).toContain('budget');
    });

    it('openRequest navigates to the request', async () => {
      service.openRequest(7);
      await settle();
      expect(router.url).toBe('/procurement/purchase-requests?view=7');
    });
  });

  describe('persistence', () => {
    it('restores the open tabs on the next visit', async () => {
      await setup('/procurement/purchase-requests?view=6');
      service.close('custody');
      TestBed.tick();

      TestBed.resetTestingModule();
      await setup('/dashboard');
      expect(ids()).toContain('request-6');
      expect(ids()).not.toContain('custody');
      expect(service.closed().map((t) => t.id)).toContain('custody');
    });

    it('falls back to the default tabs when the stored data is broken', async () => {
      localStorage.setItem('fs-workspace-tabs:guest', '{not json');
      await setup();
      expect(ids()[0]).toBe('dashboard');
      expect(ids().length).toBe(7);
    });
  });
});
