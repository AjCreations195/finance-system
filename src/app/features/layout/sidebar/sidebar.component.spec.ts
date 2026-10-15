import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';
import { SidebarComponent } from './sidebar.component';
import { NAV_TREE } from './nav-items';

describe('SidebarComponent', () => {
  let fixture: ComponentFixture<SidebarComponent>;
  let component: SidebarComponent;
  let el: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [SidebarComponent], providers: [provideRouter([])] }).compileComponents();
    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  const operations = NAV_TREE[1];

  async function search(text: string): Promise<void> {
    const input = el.querySelector<HTMLInputElement>('input')!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  it('reflects the collapsed and open inputs as host classes', async () => {
    fixture.componentRef.setInput('collapsed', true);
    fixture.componentRef.setInput('open', true);
    await fixture.whenStable();
    expect(el.classList).toContain('collapsed');
    expect(el.classList).toContain('open');
  });

  describe('menu search', () => {
    it('keeps a parent group when one of its children matches', async () => {
      await search('consumables');
      const [match] = component['primary']();
      expect(match.label).toBe('nav.operations');
      expect(match.children?.[0].children?.map((c) => c.label)).toEqual(['nav.consumables']);
      expect(component['secondary']()).toEqual([]);
    });

    it('expands every group while searching', async () => {
      await search('a');
      expect(component['isExpanded']({ label: 'any.group', icon: '' })).toBe(true);
    });

    it('shows "no results" when nothing matches', async () => {
      await search('zzzz');
      expect(component['noMatches']()).toBe(true);
      expect(el.querySelector('.no-match')).not.toBeNull();
    });
  });

  describe('groups', () => {
    it('starts with every group closed, so only the main menus show', () => {
      expect(component['isExpanded'](operations)).toBe(false);
      expect(fixture.nativeElement.querySelector('.submenu')).toBeNull();
      expect(fixture.nativeElement.querySelectorAll('.group-toggle[aria-expanded="true"]').length).toBe(0);
    });

    it('toggleGroup expands and collapses a group', async () => {
      component['toggleGroup'](operations);
      await fixture.whenStable();
      expect(component['isExpanded'](operations)).toBe(true);
      expect(fixture.nativeElement.querySelector('.submenu')).not.toBeNull();

      component['toggleGroup'](operations);
      expect(component['isExpanded'](operations)).toBe(false);
    });

    it('in the collapsed rail, clicking a group expands the sidebar with that group open', async () => {
      const emitted = vi.fn();
      component.toggleCollapse.subscribe(emitted);
      fixture.componentRef.setInput('collapsed', true);
      await fixture.whenStable();

      component['toggleGroup'](operations);
      expect(emitted).toHaveBeenCalled();
      expect(component['isExpanded'](operations)).toBe(true);
    });

    it('lists the groups leading to a page so they can be opened for it', () => {
      const tree = [{ label: 'a', icon: '', children: [{ label: 'b', icon: '', children: [{ label: 'c', icon: '', route: '/x' }] }] }];
      expect(component['openPath'](tree, '/x')).toEqual(['a', 'b']);
    });
  });

  it('Ctrl+K asks to expand the rail so the search can be focused', async () => {
    const emitted = vi.fn();
    component.toggleCollapse.subscribe(emitted);
    fixture.componentRef.setInput('collapsed', true);
    await fixture.whenStable();

    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(emitted).toHaveBeenCalled();
  });

  it('shows the Ctrl+K hint on the menu search (Ctrl on non-Apple systems) and announces the shortcut', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.kbd-hint')!.textContent!.trim()).toBe('Ctrl K');
    expect(el.querySelector('#menu-search')!.getAttribute('aria-keyshortcuts')).toBe('Control+K Meta+K');
  });

  it('ignores plain "k" key presses', () => {
    const event = new KeyboardEvent('keydown', { key: 'k', cancelable: true });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('items without a page show a notice, disabled items do nothing', () => {
    const toast = TestBed.inject(ToastService);
    component['notAvailable']({ label: 'nav.scrapRequests', icon: '', disabled: true });
    expect(toast.toasts().length).toBe(0);

    component['notAvailable']({ label: 'nav.maintenance', icon: '' });
    expect(toast.toasts().length).toBe(1);
  });
});
