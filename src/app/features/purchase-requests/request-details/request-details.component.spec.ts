import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RequestStatus } from '../../../core/models/purchase-request.model';
import { PurchaseRequestService } from '../../../core/services/purchase-request.service';
import { ToastService } from '../../../core/services/toast.service';
import { RequestDetailsComponent } from './request-details.component';

describe('RequestDetailsComponent', () => {
  let fixture: ComponentFixture<RequestDetailsComponent>;
  let el: HTMLElement;
  let service: PurchaseRequestService;

  async function setup(status: RequestStatus = 'pending') {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [RequestDetailsComponent] });
    service = TestBed.inject(PurchaseRequestService);
    service.setStatus([1], status);
    fixture = TestBed.createComponent(RequestDetailsComponent);
    fixture.componentRef.setInput('request', service.getById(1)!);
    el = fixture.nativeElement;
    await fixture.whenStable();
  }

  const stepStates = () => Array.from(el.querySelectorAll('.step')).map((s) => s.className.match(/step-(\w+)/)![1]);

  it('is a labelled modal dialog showing the request number and fields', async () => {
    await setup();
    const panel = el.querySelector('[role="dialog"]')!;
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(el.querySelector('#request-details-title')!.textContent).toContain('Purchase request details');
    expect(el.textContent).toContain('BDRS/2016/019/0008');
    expect(el.textContent).toContain('General Directorate of Supply and Equipment');
    expect(el.querySelectorAll('.fields > div').length).toBe(10);
    expect(el.querySelectorAll('.attachment').length).toBe(4);
  });

  it('moves focus into the panel when it opens', async () => {
    await setup();
    expect(document.activeElement).toBe(el.querySelector('.panel'));
  });

  it('timeline follows the status: awaiting approval', async () => {
    await setup('pending');
    expect(stepStates()).toEqual(['done', 'current', 'pending']);
    expect(el.querySelector('[aria-current="step"]')!.textContent).toContain('Approval');
  });

  it('timeline follows the status: returned for changes', async () => {
    await setup('inCorrection');
    expect(stepStates()).toEqual(['done', 'done', 'current', 'pending']);
    expect(el.querySelector('[aria-current="step"]')!.textContent).toContain('Returned for changes');
  });

  it('timeline follows the status: rejected', async () => {
    await setup('rejected');
    expect(stepStates()).toEqual(['done', 'done', 'rejected']);
  });

  it('emits approve / approve & send, and disables both for finalised requests', async () => {
    await setup('pending');
    const emitted: string[] = [];
    fixture.componentInstance.approve.subscribe((s) => emitted.push(s));
    const [approve, approveSend] = Array.from(el.querySelectorAll<HTMLButtonElement>('.btn-action'));
    approve.click();
    approveSend.click();
    expect(emitted).toEqual(['accepted', 'sent']);

    fixture.componentRef.setInput('request', { ...service.getById(1)!, status: 'closed' });
    await fixture.whenStable();
    expect(Array.from(el.querySelectorAll<HTMLButtonElement>('.btn-action')).every((b) => b.disabled)).toBe(true);
    expect(el.querySelector('.final-note')).not.toBeNull();
  });

  it('the more menu deletes (via the parent) and closes on Esc', async () => {
    await setup();
    let removed = false;
    fixture.componentInstance.remove.subscribe(() => (removed = true));

    el.querySelector<HTMLButtonElement>('.more-menu > button')!.click();
    await fixture.whenStable();
    el.querySelector('.panel')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(el.querySelector('.menu')).toBeNull();

    el.querySelector<HTMLButtonElement>('.more-menu > button')!.click();
    await fixture.whenStable();
    el.querySelector<HTMLButtonElement>('.menu .text-danger')!.click();
    expect(removed).toBe(true);
  });

  it('Share copies the page link and confirms with a toast', async () => {
    await setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    el.querySelector<HTMLButtonElement>('.share-btn')!.click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(TestBed.inject(ToastService).toasts().at(-1)?.type).toBe('success');
  });

  it('close button and backdrop both ask the parent to close', async () => {
    await setup();
    let closes = 0;
    fixture.componentInstance.closed.subscribe(() => closes++);
    el.querySelector<HTMLButtonElement>('.header-tools .tool:last-child')!.click();
    el.querySelector<HTMLElement>('.backdrop')!.click();
    expect(closes).toBe(2);
  });

  it('keeps Tab focus inside the panel', async () => {
    await setup();
    const buttons = Array.from(el.querySelectorAll<HTMLElement>('.panel button:not([disabled]), .panel a[href]'));
    buttons.at(-1)!.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    buttons.at(-1)!.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons[0]);
  });
});
