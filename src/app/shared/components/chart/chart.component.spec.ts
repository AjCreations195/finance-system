import { TestBed } from '@angular/core/testing';
import ApexCharts from 'apexcharts';
import { LanguageService } from '../../../core/services/language.service';
import { ThemeService } from '../../../core/services/theme.service';
import { ChartComponent } from './chart.component';

describe('ChartComponent', () => {
  // jsdom can't lay out SVG, so the ApexCharts drawing calls are replaced with spies.
  let render: ReturnType<typeof vi.spyOn>;
  let update: ReturnType<typeof vi.spyOn>;
  let destroy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    render = vi.spyOn(ApexCharts.prototype, 'render').mockImplementation(function (this: ApexCharts) {
      return Promise.resolve(this);
    });
    update = vi.spyOn(ApexCharts.prototype, 'updateOptions').mockImplementation(function (this: ApexCharts) {
      return Promise.resolve(this);
    });
    destroy = vi.spyOn(ApexCharts.prototype, 'destroy').mockReturnValue(undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  async function create() {
    const fixture = TestBed.createComponent(ChartComponent);
    fixture.componentRef.setInput('options', { chart: { type: 'bar' }, series: [{ data: [1, 2] }] });
    await fixture.whenStable();
    return fixture;
  }

  /** Options the component built for ApexCharts. */
  function merged(fixture: Awaited<ReturnType<typeof create>>): ApexCharts.ApexOptions {
    return fixture.componentInstance['mergedOptions']();
  }

  it('creates the chart once after the first render', async () => {
    const fixture = await create();
    expect(render).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.getAttribute('dir')).toBe('ltr');
  });

  it('keeps the caller options and adds theme defaults', async () => {
    TestBed.inject(ThemeService).setTheme('light');
    const fixture = await create();
    const options = merged(fixture);

    expect(options.chart?.type).toBe('bar');
    expect(options.chart?.toolbar?.show).toBe(false);
    expect(options.theme?.mode).toBe('light');
    expect(options.series).toEqual([{ data: [1, 2] }]);
  });

  it('switches to dark colors and the Arabic font, and updates the existing chart', async () => {
    const fixture = await create();
    TestBed.inject(ThemeService).setTheme('dark');
    TestBed.inject(LanguageService).setLanguage('ar');
    await fixture.whenStable();

    const options = merged(fixture);
    expect(options.theme?.mode).toBe('dark');
    expect(options.tooltip?.theme).toBe('dark');
    expect(options.chart?.fontFamily).toContain('IBM Plex Sans Arabic');
    expect(update).toHaveBeenCalled();
    expect(render).toHaveBeenCalledTimes(1); // updated, not re-created
  });

  it('destroys the chart with the component', async () => {
    const fixture = await create();
    fixture.destroy();
    expect(destroy).toHaveBeenCalled();
  });
});
