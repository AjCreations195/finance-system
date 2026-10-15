import { TestBed } from '@angular/core/testing';
import { PageStateService } from './page-state.service';

describe('PageStateService', () => {
  beforeEach(() => sessionStorage.clear());

  it('saves, restores and clears state by key', () => {
    const service = TestBed.inject(PageStateService);
    service.save('procurement', { search: 'cables' });
    service.save('scroll:procurement', 320);
    expect(service.restore('procurement')).toEqual({ search: 'cables' });

    service.clear('procurement', 'scroll:procurement');
    expect(service.restore('procurement')).toBeUndefined();
    expect(service.restore('scroll:procurement')).toBeUndefined();
  });

  it('survives a reload within the browser session', () => {
    TestBed.inject(PageStateService).save('procurement', { page: 3 });
    TestBed.resetTestingModule();
    expect(TestBed.inject(PageStateService).restore('procurement')).toEqual({ page: 3 });
  });

  it('ignores broken stored data', () => {
    sessionStorage.setItem('fs-page-state', '{oops');
    expect(TestBed.inject(PageStateService).restore('procurement')).toBeUndefined();
  });
});
