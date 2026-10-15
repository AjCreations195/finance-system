import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MainLayoutComponent } from './main-layout.component';

const COLLAPSE_KEY = 'fs-sidebar-collapsed';

@Component({ template: '' })
class EmptyPage {}

describe('MainLayoutComponent', () => {
  let fixture: ComponentFixture<MainLayoutComponent>;
  let component: MainLayoutComponent;
  let el: HTMLElement;

  async function setup(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [provideRouter([{ path: '**', component: EmptyPage }])],
    }).compileComponents();
    fixture = TestBed.createComponent(MainLayoutComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    await fixture.whenStable();
  }

  beforeEach(() => localStorage.clear());

  it('renders the navbar, sidebar, tabs and page outlet', async () => {
    await setup();
    for (const selector of ['app-navbar', 'app-sidebar', 'app-workspace-tabs', 'router-outlet']) {
      expect(el.querySelector(selector), selector).not.toBeNull();
    }
  });

  it('remembers the collapsed sidebar in localStorage', async () => {
    await setup();
    component['toggleCollapsed']();
    await fixture.whenStable();

    expect(el.classList).toContain('sidebar-collapsed');
    expect(localStorage.getItem(COLLAPSE_KEY)).toBe('true');
  });

  it('restores the collapsed state on load', async () => {
    localStorage.setItem(COLLAPSE_KEY, 'true');
    await setup();
    expect(component['sidebarCollapsed']()).toBe(true);
  });

  it('shows a backdrop while the mobile sidebar is open; clicking it closes the sidebar', async () => {
    await setup();
    component['sidebarOpen'].set(true);
    await fixture.whenStable();

    el.querySelector<HTMLElement>('.sidebar-backdrop')!.click();
    await fixture.whenStable();
    expect(component['sidebarOpen']()).toBe(false);
    expect(el.querySelector('.sidebar-backdrop')).toBeNull();
  });

  it('closes the mobile sidebar after navigation and on Escape', async () => {
    await setup();
    component['sidebarOpen'].set(true);
    await TestBed.inject(Router).navigateByUrl('/somewhere');
    expect(component['sidebarOpen']()).toBe(false);

    component['sidebarOpen'].set(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component['sidebarOpen']()).toBe(false);
  });
});
