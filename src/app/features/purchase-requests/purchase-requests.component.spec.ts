import { Location } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TAB_STATUSES } from '../../core/models/purchase-request.model';
import { PurchaseRequestService } from '../../core/services/purchase-request.service';
import { ToastService } from '../../core/services/toast.service';
import { PurchaseRequestsComponent } from './purchase-requests.component';

describe('PurchaseRequestsComponent', () => {
  let fixture: ComponentFixture<PurchaseRequestsComponent>;
  let component: PurchaseRequestsComponent;
  let el: HTMLElement;
  let service: PurchaseRequestService;
  let toast: ToastService;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear(); // list state saved by PageStateService
    await TestBed.configureTestingModule({ imports: [PurchaseRequestsComponent], providers: [provideRouter([])] }).compileComponents();
    fixture = TestBed.createComponent(PurchaseRequestsComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    service = TestBed.inject(PurchaseRequestService);
    toast = TestBed.inject(ToastService);
    await fixture.whenStable();
  });

  afterEach(() => document.body.classList.remove('overflow-hidden'));

  const rows = () => component['rows']();
  const bodyRows = () => el.querySelectorAll('.requests-table tbody tr');
  const printRows = () => el.querySelectorAll('.print-report tbody tr');

  describe('listing and pagination', () => {
    it('shows 13 rows per page out of 130 requests', () => {
      expect(rows().length).toBe(13);
      expect(bodyRows().length).toBe(13);
      expect(component['totalPages']()).toBe(10);
    });

    it('moves between pages and clamps out-of-range pages', () => {
      component['goTo'](2);
      expect(rows()[0].id).toBe(14);

      component['goTo'](999);
      expect(component['currentPage']()).toBe(10);

      component['goTo'](-5);
      expect(component['currentPage']()).toBe(1);
    });

    it('the Previous button is disabled on the first page', () => {
      const [prev] = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).filter((b) => b.textContent?.trim() === 'Previous');
      expect(prev.disabled).toBe(true);
    });
  });

  describe('filters', () => {
    it('a status tab shows only its statuses and resets to page 1', () => {
      component['goTo'](3);
      component['setTab']('rejected');

      expect(component['currentPage']()).toBe(1);
      expect(rows().length).toBeGreaterThan(0);
      expect(rows().every((r) => TAB_STATUSES.rejected.includes(r.status))).toBe(true);
    });

    it('the status filter keeps only the exact status', () => {
      component['setStatus']('pending');
      expect(rows().every((r) => r.status === 'pending')).toBe(true);
    });

    it('search matches the request number, ignoring case and spaces', async () => {
      const input = el.querySelector<HTMLInputElement>('input[type="search"]')!;
      input.value = '  bdrs/2016/019/0008 ';
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      expect(rows().map((r) => r.id)).toEqual([1]);
      expect(bodyRows().length).toBe(1);
    });

    it('search matches the creator name', () => {
      component['onSearch']('fares osama');
      expect(rows().length).toBeGreaterThan(0);
      expect(rows().every((r) => r.creator.name.en === 'Fares Osama Tariq')).toBe(true);
    });

    it('shows an empty state when nothing matches', async () => {
      component['onSearch']('zzz-no-match');
      await fixture.whenStable();
      expect(rows().length).toBe(0);
      expect(component['totalPages']()).toBe(1);
    });
  });

  it('sorting by notes orders the rows numerically', () => {
    component['sort'].toggle('notes');
    const notes = rows().map((r) => r.notes);
    expect(notes).toEqual([...notes].sort((a, b) => a - b));
  });

  describe('selection', () => {
    it('toggles a single row', () => {
      component['toggleRow'](1);
      expect(component['selectedCount']()).toBe(1);
      component['toggleRow'](1);
      expect(component['selectedCount']()).toBe(0);
    });

    it('"select all" selects and then clears the current page', () => {
      component['toggleAllOnPage']();
      expect(component['allOnPageSelected']()).toBe(true);
      expect(component['selectedCount']()).toBe(13);

      component['toggleAllOnPage']();
      expect(component['selectedCount']()).toBe(0);
    });
  });

  describe('row actions', () => {
    it('only allows approving requests that are not final', () => {
      const accepted = service.getById(1)!; // seeded as 'accepted'
      const inProgress = service.getById(2)!; // seeded as 'inProgress'
      expect(component['canApprove'](accepted)).toBe(false);
      expect(component['canApprove'](inProgress)).toBe(true);
    });

    it('approve sets the status to accepted and shows a toast', () => {
      component['approve'](service.getById(2)!);
      expect(service.getById(2)!.status).toBe('accepted');
      expect(toast.toasts().at(-1)?.type).toBe('success');
    });

    it('delete asks for confirmation first, then removes the request', async () => {
      component['askDelete']([service.getById(1)!]);
      await fixture.whenStable();
      expect(el.querySelector('[role="alertdialog"]')).not.toBeNull();
      expect(service.requests().length).toBe(130);

      el.querySelector<HTMLButtonElement>('[role="alertdialog"] .btn-danger')!.click();
      await fixture.whenStable();

      expect(service.getById(1)).toBeUndefined();
      expect(el.querySelector('[role="alertdialog"]')).toBeNull();
      expect(toast.toasts().at(-1)?.type).toBe('success');
    });

    it('cancelling the confirmation keeps the request', async () => {
      component['askDelete']([service.getById(1)!]);
      await fixture.whenStable();
      component['onEscape']();
      await fixture.whenStable();

      expect(el.querySelector('[role="alertdialog"]')).toBeNull();
      expect(service.getById(1)).toBeDefined();
    });

    it('deleting removes the ids from the selection too', () => {
      component['toggleRow'](1);
      component['toggleRow'](2);
      component['askDelete']([service.getById(1)!]);
      component['confirmDelete']();
      expect([...component['selected']()]).toEqual([2]);
    });

    it('openRowMenu toggles the menu for the same row', () => {
      const button = document.createElement('button');
      const event = { stopPropagation: vi.fn(), currentTarget: button } as unknown as MouseEvent;
      const request = service.getById(1)!;

      component['openRowMenu'](request, event);
      expect(component['rowMenu']()?.request.id).toBe(1);

      component['openRowMenu'](request, event);
      expect(component['rowMenu']()).toBeNull();
    });

    it('scrolling any container (not just the window) closes the row menu', () => {
      const button = document.createElement('button');
      const event = { stopPropagation: vi.fn(), currentTarget: button } as unknown as MouseEvent;
      component['openRowMenu'](service.getById(1)!, event);

      // The page scrolls inside the layout; scroll events don't bubble.
      const scroller = document.createElement('div');
      document.body.appendChild(scroller);
      scroller.dispatchEvent(new Event('scroll', { bubbles: false }));
      scroller.remove();

      expect(component['rowMenu']()).toBeNull();
    });
  });

  describe('print report', () => {
    it('prints every row matching the filters, not just the current page', async () => {
      expect(printRows().length).toBe(130);
      expect(el.querySelector('.print-summary')!.textContent).toContain('130 requests');

      component['setTab']('rejected');
      await fixture.whenStable();
      const rejected = service.requests().filter((r) => TAB_STATUSES.rejected.includes(r.status)).length;
      expect(printRows().length).toBe(rejected);
    });

    it('prints only the ticked rows when some are selected', async () => {
      component['toggleRow'](1);
      component['toggleRow'](3);
      await fixture.whenStable();
      expect(printRows().length).toBe(2);
      expect(el.querySelector('.print-summary')!.textContent).toContain('Selected requests only');
    });

    it('describes the active status filter and search in the summary', async () => {
      component['setStatus']('rejected');
      component['onSearch']('BDRS');
      await fixture.whenStable();
      const summary = el.querySelector('.print-summary')!.textContent!;
      expect(summary).toContain('Status: Rejected');
      expect(summary).toContain('Search: "BDRS"');
    });

    it('opens the print dialog after the report has rendered', async () => {
      const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
      component['print']();
      expect(print).not.toHaveBeenCalled();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(print).toHaveBeenCalledTimes(1);
      print.mockRestore();
    });
  });

  describe('details panel', () => {
    const open = async (id: number) => {
      component['view'](service.getById(id)!);
      await fixture.whenStable();
    };

    it('opens from View, puts the request id in the URL and renders the panel', async () => {
      await open(2);
      expect(TestBed.inject(Router).url).toContain('view=2');
      expect(component['viewing']()?.id).toBe(2);
      expect(el.querySelector('app-request-details [role="dialog"]')).not.toBeNull();
      expect(document.body.classList).toContain('overflow-hidden');
    });

    it('opens directly from a link with ?view=<id>', async () => {
      await TestBed.inject(Router).navigateByUrl('/?view=5');
      await fixture.whenStable();
      expect(component['viewing']()?.id).toBe(5);
    });

    it('Esc closes a dialog first, then the panel', async () => {
      await open(2);
      component['deleteFromDetails']();
      component['onEscape']();
      expect(component['pendingDelete']()).toBeNull();
      expect(component['viewing']()).not.toBeNull(); // panel still open

      component['onEscape']();
      await fixture.whenStable();
      expect(component['viewing']()).toBeNull();
      expect(TestBed.inject(Router).url).not.toContain('view=');
    });

    it('approves or approves & sends the open request', async () => {
      service.setStatus([2, 3], 'pending');
      await open(2);
      component['approveFromDetails']('accepted');
      expect(service.getById(2)!.status).toBe('accepted');

      await open(3);
      component['approveFromDetails']('sent');
      expect(service.getById(3)!.status).toBe('sent');
      expect(toast.toasts().at(-1)?.message).toContain('approved and sent');
    });

    it('deleting the open request (after confirming) closes the panel', async () => {
      await open(4);
      component['deleteFromDetails']();
      component['confirmDelete']();
      await fixture.whenStable();
      expect(service.getById(4)).toBeUndefined();
      expect(component['viewing']()).toBeNull();
    });
  });

  describe('bottom action bar', () => {
    it('asks the user to select something when nothing is selected', () => {
      component['sendSelected']();
      expect(toast.toasts().at(-1)?.type).toBe('warning');
    });

    it('sends the selected requests', () => {
      component['toggleRow'](1);
      component['toggleRow'](2);
      component['sendSelected']();
      expect(service.getById(1)!.status).toBe('sent');
      expect(service.getById(2)!.status).toBe('sent');
      expect(component['selectedCount']()).toBe(0); // selection cleared after the action
    });

    it('approveSelected asks for confirmation before changing anything', async () => {
      service.setStatus([1, 2], 'pending');
      component['toggleRow'](1);
      component['toggleRow'](2);
      component['approveSelected']();
      await fixture.whenStable();

      expect(service.getById(1)!.status).toBe('pending');
      expect(el.querySelector('#approve-title')).not.toBeNull();
      expect(el.querySelector('.skip-note')).toBeNull();

      el.querySelector<HTMLButtonElement>('.confirm-approve')!.click();
      await fixture.whenStable();
      expect(service.getById(1)!.status).toBe('accepted');
      expect(component['selectedCount']()).toBe(0);
      expect(component['pendingApprove']()).toBeNull();
      expect(toast.toasts().at(-1)?.type).toBe('success');
    });

    it('cancelling the approve dialog keeps statuses and selection', () => {
      service.setStatus([1], 'pending');
      component['toggleRow'](1);
      component['approveSelected']();
      component['onEscape']();

      expect(component['pendingApprove']()).toBeNull();
      expect(service.getById(1)!.status).toBe('pending');
      expect(component['selectedCount']()).toBe(1);
    });

    it('approveSelected skips finalised requests and keeps only those selected', async () => {
      service.setStatus([1], 'rejected');
      service.setStatus([2], 'pending');
      component['toggleRow'](1);
      component['toggleRow'](2);
      component['approveSelected']();
      await fixture.whenStable();
      expect(el.querySelector('.skip-note')!.textContent).toContain('1 already finalised');
      component['confirmApprove']();

      expect(service.getById(1)!.status).toBe('rejected');
      expect(service.getById(2)!.status).toBe('accepted');
      expect([...component['selected']()]).toEqual([1]);
      expect(toast.toasts().at(-1)?.type).toBe('warning');
      expect(toast.toasts().at(-1)?.message).toContain('1 are already finalised');
    });

    it('approveSelected changes nothing when every selected request is finalised', () => {
      service.setStatus([1], 'closed');
      component['toggleRow'](1);
      component['approveSelected']();

      expect(service.getById(1)!.status).toBe('closed');
      expect([...component['selected']()]).toEqual([1]);
      expect(toast.toasts().at(-1)?.type).toBe('warning');
    });

    it('deleteSelected opens the confirmation for the selection', () => {
      component['toggleRow'](3);
      component['deleteSelected']();
      expect(component['pendingDelete']()?.map((r) => r.id)).toEqual([3]);
    });

    it('back() goes to the previous page', () => {
      const location = TestBed.inject(Location);
      const spy = vi.spyOn(location, 'back');
      component['back']();
      expect(spy).toHaveBeenCalled();
    });
  });

  it('full-screen mode locks page scrolling, Escape restores it', async () => {
    component['expanded'].set(true);
    await fixture.whenStable();
    expect(document.body.classList.contains('overflow-hidden')).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(document.body.classList.contains('overflow-hidden')).toBe(false);
  });

  it('full-screen mode has its own "Exit full screen" button; focus moves between the two', async () => {
    document.body.appendChild(el); // focus needs the element in the document
    expect(el.querySelector('.collapse-btn')).toBeNull();

    el.querySelector<HTMLButtonElement>('.expand-btn')!.click();
    await fixture.whenStable();
    const collapse = el.querySelector<HTMLButtonElement>('.collapse-btn')!;
    expect(collapse.textContent).toContain('Exit full screen');
    expect(document.activeElement).toBe(collapse);

    collapse.click();
    await fixture.whenStable();
    expect(component['expanded']()).toBe(false);
    expect(el.querySelector('.collapse-btn')).toBeNull();
    expect(document.activeElement).toBe(el.querySelector('.expand-btn'));
    el.remove();
  });

  it('a document click closes open menus', () => {
    component['actionsOpen'].set(true);
    document.dispatchEvent(new MouseEvent('click'));
    expect(component['actionsOpen']()).toBe(false);
  });

  describe('summary cards', () => {
    const card = (index: number) => el.querySelectorAll<HTMLElement>('.stat-card')[index];
    const hit = (index: number) => card(index).querySelector<HTMLButtonElement>('.stat-hit')!;

    it('clicking a card shows its tab in the table and highlights the card; again goes back to all', async () => {
      hit(3).click(); // Rejected requests
      await fixture.whenStable();
      expect(component['tab']()).toBe('rejected');
      expect(rows().every((r) => TAB_STATUSES.rejected.includes(r.status))).toBe(true);
      expect(card(3).classList).toContain('active');
      expect(hit(3).getAttribute('aria-pressed')).toBe('true');

      hit(3).click();
      await fixture.whenStable();
      expect(component['tab']()).toBe('all');
      expect(card(0).classList).toContain('active'); // the balance card stands for "all"
    });

    it('clears the exact-status filter so it cannot hide the card\'s requests', () => {
      component['setStatus']('accepted');
      component['selectStat']('inProgress');
      expect(component['status']()).toBe('all');
      expect(component['tab']()).toBe('inProgress');
    });

    it('choosing a tab directly highlights its card', async () => {
      component['setTab']('inProgress');
      await fixture.whenStable();
      expect(card(2).classList).toContain('active');

      component['setTab']('partiallyCompleted'); // no card for this tab
      await fixture.whenStable();
      expect(el.querySelectorAll('.stat-card.active').length).toBe(0);
    });
  });

  describe('workspace tab state', () => {
    it('coming back to the page restores tab, filter, search, sort, page and selection', async () => {
      component['setTab']('inProgress');
      component['setStatus']('pending');
      component['onSearch']('BDRS');
      component['sort'].toggle('date');
      component['sort'].toggle('date');
      component['toggleRow'](1);
      await fixture.whenStable();
      fixture.destroy();

      // The page is created again when its tab is selected.
      const again = TestBed.createComponent(PurchaseRequestsComponent).componentInstance;
      expect(again['tab']()).toBe('inProgress');
      expect(again['status']()).toBe('pending');
      expect(again['search']()).toBe('BDRS');
      expect(again['sort'].key()).toBe('date');
      expect(again['sort'].dir()).toBe('desc');
      expect([...again['selected']()]).toEqual([1]);
    });

    it('drops saved selections of requests that were deleted meanwhile', async () => {
      component['toggleRow'](1);
      component['toggleRow'](2);
      await fixture.whenStable();
      fixture.destroy();
      service.delete([2]);

      const again = TestBed.createComponent(PurchaseRequestsComponent).componentInstance;
      expect([...again['selected']()]).toEqual([1]);
    });
  });
});
