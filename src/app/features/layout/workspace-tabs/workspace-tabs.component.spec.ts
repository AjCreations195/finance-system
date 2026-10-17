import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { PurchaseRequestService } from '../../../core/services/purchase-request.service';
import { ToastService } from '../../../core/services/toast.service';
import { WorkspaceTabsService } from '../../../core/services/workspace-tabs.service';
import { WorkspaceTabsComponent } from './workspace-tabs.component';

@Component({ template: '' })
class EmptyPage {}

describe('WorkspaceTabsComponent', () => {
  let fixture: ComponentFixture<WorkspaceTabsComponent>;
  let component: WorkspaceTabsComponent;
  let el: HTMLElement;
  let router: Router;
  let workspace: WorkspaceTabsService;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [WorkspaceTabsComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: EmptyPage, data: { breadcrumb: ['layout.tabs.dashboard'] } },
          { path: 'procurement/purchase-requests', component: EmptyPage, data: { breadcrumb: ['nav.procurement', 'requests.title'] } },
        ]),
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    workspace = TestBed.inject(WorkspaceTabsService);
    fixture = TestBed.createComponent(WorkspaceTabsComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    await go('/dashboard');
  });

  const go = async (url: string) => {
    await router.navigateByUrl(url);
    await fixture.whenStable();
  };
  /** Let navigations started by the component finish. */
  const settle = async () => {
    await new Promise((r) => setTimeout(r));
    await fixture.whenStable();
  };
  const labels = () => [...el.querySelectorAll<HTMLButtonElement>('.tab-label')];
  const label = (id: string) => el.querySelector<HTMLButtonElement>(`[data-tab="${id}"]`)!;
  const view = (id: string) => component['views']().find((v) => v.tab.id === id)!;
  const key = (target: Element, init: KeyboardEventInit) => target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));

  describe('breadcrumb', () => {
    it('is built from the active route data', async () => {
      expect(component['breadcrumb']().map((c) => c.label)).toEqual(['Dashboard']);

      await go('/procurement/purchase-requests');
      expect(component['breadcrumb']().map((c) => c.label)).toEqual(['Procurement', 'Purchase request']);
    });

    it('adds the request number when a request is open, with a link back to the list', async () => {
      const request = TestBed.inject(PurchaseRequestService).getById(3)!;
      await go('/procurement/purchase-requests?view=3');
      const crumbs = component['breadcrumb']();
      expect(crumbs.at(-1)).toEqual({ label: request.number });
      expect(crumbs.at(-2)!.link).toBe('/procurement/purchase-requests');
    });
  });

  describe('tabs', () => {
    it('marks the current page with aria-current and gives it the only tab stop', () => {
      expect(label('dashboard').getAttribute('aria-current')).toBe('page');
      expect(labels().filter((b) => b.tabIndex === 0)).toEqual([label('dashboard')]);
    });

    it('the pinned dashboard has no close button', () => {
      expect(label('dashboard').parentElement!.querySelector('.tab-close')).toBeNull();
      expect(label('custody').parentElement!.querySelector('.tab-close')).not.toBeNull();
    });

    it('shows open requests as tabs with their number and status color', async () => {
      const request = TestBed.inject(PurchaseRequestService).getById(5)!;
      await go('/procurement/purchase-requests?view=5');
      const tab = label('request-5');
      expect(tab.textContent).toContain(request.number);
      expect(tab.querySelector<HTMLElement>('.status-dot')!.style.background).toContain('--fs-badge-');
    });

    it('counts requests under procedure on the Purchase request tab', () => {
      expect(view('procurement').badge).toBeGreaterThan(0);
      expect(label('procurement').querySelector('.tab-count')!.textContent!.trim()).toBe(String(view('procurement').badge));
    });


    it('clicking a module outside the demo shows a notice', () => {
      const show = vi.spyOn(TestBed.inject(ToastService), 'show');
      label('custody').click();
      expect(show).toHaveBeenCalledWith(expect.any(String), 'info');
    });

    it('× and middle-click close a tab', async () => {
      label('custody').parentElement!.querySelector<HTMLButtonElement>('.tab-close')!.click();
      el.querySelector('[data-tab="budget"]')!.parentElement!.dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true }));
      await fixture.whenStable();
      expect(labels().map((b) => b.dataset['tab'])).not.toContain('custody');
      expect(labels().map((b) => b.dataset['tab'])).not.toContain('budget');
    });
  });

  describe('tooltip', () => {
    const hover = async (id: string) => {
      label(id).parentElement!.dispatchEvent(new MouseEvent('mouseenter'));
      await new Promise((r) => setTimeout(r, 500)); // hover delay
      await fixture.whenStable();
      return el.querySelector<HTMLElement>('.tab-tip');
    };

    it('appears after hovering a moment and explains the count', async () => {
      label('procurement').parentElement!.dispatchEvent(new MouseEvent('mouseenter'));
      await fixture.whenStable();
      expect(el.querySelector('.tab-tip')).toBeNull(); // not instantly

      const tip = (await hover('procurement'))!;
      expect(tip.getAttribute('role')).toBe('tooltip');
      expect(tip.querySelector('.tip-count')!.textContent).toContain(`${view('procurement').badge} under procedure`);
      expect(label('procurement').getAttribute('aria-describedby')).toBe('tab-tip');
    });

    it('shows a request tab\'s number, status badge and description', async () => {
      const request = TestBed.inject(PurchaseRequestService).getById(5)!;
      await go('/procurement/purchase-requests?view=5');
      const tip = (await hover('request-5'))!;
      expect(tip.querySelector('strong')!.textContent).toBe(request.number);
      expect(tip.querySelector('.task-badge')!.textContent!.trim()).toBeTruthy();
      expect(tip.querySelector('.tip-detail')!.textContent).toBe(request.description.en);
    });

    it('stays while the pointer moves onto it, Escape dismisses it', async () => {
      const tip = (await hover('dashboard'))!;
      label('dashboard').parentElement!.dispatchEvent(new MouseEvent('mouseleave'));
      tip.dispatchEvent(new MouseEvent('mouseenter'));
      await new Promise((r) => setTimeout(r, 200));
      await fixture.whenStable();
      expect(el.querySelector('.tab-tip')).not.toBeNull();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await fixture.whenStable();
      expect(el.querySelector('.tab-tip')).toBeNull();
    });

    it('the "+" button uses the same tooltip, and opening its menu hides it', async () => {
      const add = el.querySelector<HTMLButtonElement>('.tab-add')!;
      expect(add.hasAttribute('title')).toBe(false); // no native tooltip on top of ours
      add.dispatchEvent(new MouseEvent('mouseenter'));
      await new Promise((r) => setTimeout(r, 500));
      await fixture.whenStable();
      expect(el.querySelector('.tab-tip strong')!.textContent).toBe('Open a new tab');

      add.click();
      await fixture.whenStable();
      expect(el.querySelector('.tab-tip')).toBeNull();
    });

    it('clicking the tab hides it', async () => {
      await hover('procurement');
      label('procurement').click();
      await fixture.whenStable();
      expect(el.querySelector('.tab-tip')).toBeNull();
    });
  });

  describe('keyboard', () => {
    it('arrow keys move focus along the strip (wrapping), Home/End jump', async () => {
      label('dashboard').focus();
      key(label('dashboard'), { key: 'ArrowRight' });
      await fixture.whenStable();
      expect(document.activeElement).toBe(label('procurement'));

      key(label('procurement'), { key: 'End' });
      await fixture.whenStable();
      expect(document.activeElement).toBe(label('budget'));

      key(label('budget'), { key: 'ArrowRight' });
      await fixture.whenStable();
      expect(document.activeElement).toBe(label('dashboard'));
    });

    it('Delete closes the focused tab and keeps focus in the strip', async () => {
      label('custody').focus();
      key(label('custody'), { key: 'Delete' });
      await fixture.whenStable();
      expect(label('custody')).toBeNull();
      expect(document.activeElement).toBe(label('requests'));
    });

    it('Alt+2 switches to the second tab, Alt+W closes the active one, Alt+Shift+T reopens it', async () => {
      key(document.body, { altKey: true, code: 'Digit2' });
      await settle();
      expect(router.url).toBe('/procurement/purchase-requests');

      key(document.body, { altKey: true, code: 'KeyW' });
      await settle();
      expect(workspace.tabs().map((t) => t.id)).not.toContain('procurement');
      expect(router.url).toBe('/dashboard');

      key(document.body, { altKey: true, shiftKey: true, code: 'KeyT' });
      await settle();
      expect(workspace.tabs().map((t) => t.id)).toContain('procurement');
      expect(router.url).toBe('/procurement/purchase-requests');
    });

    it('Alt+W does nothing on the pinned dashboard', async () => {
      key(document.body, { altKey: true, code: 'KeyW' });
      await fixture.whenStable();
      expect(workspace.tabs().map((t) => t.id)).toContain('dashboard');
    });
  });

  describe('context menu', () => {
    const openMenu = async (id: string) => {
      label(id).parentElement!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 60 }));
      await fixture.whenStable();
      return el.querySelector<HTMLElement>('.tab-menu')!;
    };
    const item = (menu: HTMLElement, text: string) =>
      [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((b) => b.textContent!.includes(text))!;

    it('opens at the pointer with the tab actions', async () => {
      const menu = await openMenu('invoices');
      expect(menu.style.top).toBe('60px');
      expect(item(menu, 'Close other tabs').disabled).toBe(false);
      expect(item(menu, 'Reopen closed tab').disabled).toBe(true);
    });

    it('"Close tabs to the right" closes the tabs after it', async () => {
      item(await openMenu('invoices'), 'Close tabs to the right').click();
      await fixture.whenStable();
      expect(workspace.tabs().map((t) => t.id)).toEqual(['dashboard', 'procurement', 'custody', 'requests', 'invoices']);
      expect(el.querySelector('.tab-menu')).toBeNull();
    });

    it('can\'t close the pinned tab', async () => {
      expect(item(await openMenu('dashboard'), 'Close tab').disabled).toBe(true);
    });

    it('Escape closes it and returns focus to the tab', async () => {
      const menu = await openMenu('invoices');
      key(menu, { key: 'Escape' });
      await fixture.whenStable();
      expect(el.querySelector('.tab-menu')).toBeNull();
      expect(document.activeElement).toBe(label('invoices'));
    });
  });

  describe('"+" quick-open menu', () => {
    const openAdd = async () => {
      el.querySelector<HTMLButtonElement>('.tab-add')!.click();
      await fixture.whenStable();
      return el.querySelector<HTMLElement>('.add-menu')!;
    };
    const search = async (menu: HTMLElement, text: string) => {
      const input = menu.querySelector('input')!;
      input.value = text;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      return input;
    };

    it('lists the pages, marking the open ones', async () => {
      const menu = await openAdd();
      expect(menu.querySelectorAll('[role="menuitem"]').length).toBe(7);
      expect(menu.textContent).toContain('Open');
    });

    it('finds a request by number and opens it in a tab with Enter', async () => {
      const request = TestBed.inject(PurchaseRequestService).getById(9)!;
      const menu = await openAdd();
      const input = await search(menu, request.number);
      expect(menu.querySelector('.result-number')!.textContent).toBe(request.number);

      key(input, { key: 'Enter' });
      await settle();
      expect(router.url).toBe('/procurement/purchase-requests?view=9');
      expect(workspace.tabs().map((t) => t.id)).toContain('request-9');
      expect(el.querySelector('.add-menu')).toBeNull();
    });

    it('says when nothing matches', async () => {
      const menu = await openAdd();
      await search(menu, 'zzzz-nothing');
      expect(menu.querySelector('.menu-empty')).not.toBeNull();
    });

    it('lists recently closed tabs and reopens them', async () => {
      workspace.close('contracts');
      const menu = await openAdd();
      const reopen = [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((b) =>
        b.textContent!.includes('Contracts & tenders') && b.querySelector('[data-icon="undo"]'),
      )!;
      reopen.click();
      await fixture.whenStable();
      expect(workspace.tabs().map((t) => t.id)).toContain('contracts');
    });
  });
});
