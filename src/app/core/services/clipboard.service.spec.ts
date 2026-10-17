import { TestBed } from '@angular/core/testing';
import { ClipboardService } from './clipboard.service';
import { ToastService } from './toast.service';

describe('ClipboardService', () => {
  let service: ClipboardService;
  let toast: ToastService;

  beforeEach(() => {
    service = TestBed.inject(ClipboardService);
    toast = TestBed.inject(ToastService);
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('copies the text and confirms with the given message', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    service.copy('BDRS/2026/BR/8008', 'transactions.toast.numberCopied');
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('BDRS/2026/BR/8008');
    expect(toast.toasts().at(-1)?.type).toBe('success');
  });

  it('shows a danger toast when the browser refuses the copy', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    service.copy('x', 'chat.copied');
    await Promise.resolve();
    await Promise.resolve();

    expect(toast.toasts().at(-1)?.type).toBe('danger');
  });

  it('shows a danger toast when there is no clipboard at all', () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });

    service.copy('x', 'chat.copied');

    expect(toast.toasts().at(-1)?.type).toBe('danger');
  });
});
