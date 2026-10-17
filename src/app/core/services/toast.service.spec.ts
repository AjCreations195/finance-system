import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = TestBed.inject(ToastService);
  });

  afterEach(() => vi.useRealTimers());

  it('starts with no toasts', () => {
    expect(service.toasts()).toEqual([]);
  });

  it('adds a toast with a unique id and "success" as the default type', () => {
    service.show('Saved');
    service.show('Oops', 'danger');

    const [first, second] = service.toasts();
    expect(first).toEqual({ id: expect.any(Number), message: 'Saved', type: 'success' });
    expect(second.type).toBe('danger');
    expect(first.id).not.toBe(second.id);
  });

  it('removes a toast automatically after its duration', () => {
    service.show('Short', 'info', 1000);
    service.show('Long', 'info', 5000);

    vi.advanceTimersByTime(1000);
    expect(service.toasts().map((t) => t.message)).toEqual(['Long']);

    vi.advanceTimersByTime(4000);
    expect(service.toasts()).toEqual([]);
  });

  it('dismisses a single toast by id', () => {
    service.show('A');
    service.show('B');
    const idA = service.toasts()[0].id;

    service.dismiss(idA);
    expect(service.toasts().map((t) => t.message)).toEqual(['B']);
  });

  it('ignores a dismiss for an unknown id', () => {
    service.show('A');
    service.dismiss(9999);
    expect(service.toasts().length).toBe(1);
  });

  it('unavailable() shows the shared info notice', () => {
    service.unavailable();
    expect(service.toasts().at(-1)?.type).toBe('info');
  });
});

