import { Injectable, computed, signal } from '@angular/core';
import {
  ActivityItem,
  BudgetMonth,
  ContractItem,
  FinancialStat,
  LocalizedText,
  NotificationItem,
  Person,
  ProcurementBreakdown,
  TaskItem,
  TaskStatus,
  TransactionItem,
  WarehouseItem,
} from '../models/dashboard.models';

/**
 * DashboardDataService
 * --------------------
 * Mock data source for every dashboard widget. Each dataset is a signal,
 * so widgets get live updates (e.g. approving a task changes its status
 * badge, and marking notifications as read updates the bell counter).
 *
 * To connect a real backend, replace the seed data with HttpClient
 * calls; the components only use the public signals and methods.
 */
@Injectable({ providedIn: 'root' })
export class DashboardDataService {
  // ------------------------------------------------------------------
  // Financial statistics cards
  // ------------------------------------------------------------------
  readonly stats = signal<FinancialStat[]>([
    { id: 'approvedBudget', label: 'dashboard.stats.approvedBudget', amount: 50_000_000, icon: 'stat-document', change: 26, higherIsBetter: false, period: 'dashboard.period.lastMonth' },
    { id: 'cashBalance', label: 'dashboard.stats.cashBalance', amount: 10_000_000, icon: 'stat-document', change: 28, higherIsBetter: false, period: 'dashboard.period.lastMonth' },
    { id: 'paidAmounts', label: 'dashboard.stats.paidAmounts', amount: 15_000_000, icon: 'stat-document', change: 26, higherIsBetter: true, period: 'dashboard.period.lastMonth' },
    { id: 'commitments', label: 'dashboard.stats.commitments', amount: 20_000_000, icon: 'stat-wallet', change: -15, higherIsBetter: true, period: 'dashboard.period.lastYear' },
    { id: 'obligations', label: 'dashboard.stats.obligations', amount: 5_000_000, icon: 'stat-briefcase', change: 26, higherIsBetter: true, period: 'dashboard.period.lastMonth' },
  ]);

  // ------------------------------------------------------------------
  // "My tasks" table
  // ------------------------------------------------------------------
  private readonly _tasks = signal<TaskItem[]>(generateTasks(50));
  readonly tasks = this._tasks.asReadonly();

  /** Change a task's status (Approve / Return actions). */
  setTaskStatus(id: number, status: TaskStatus): void {
    this._tasks.update((list) => list.map((t) => (t.id === id ? { ...t, status } : t)));
  }

  // ------------------------------------------------------------------
  // Recent activities
  // ------------------------------------------------------------------
  readonly activities = signal<ActivityItem[]>(generateActivities());

  // ------------------------------------------------------------------
  // Procurement status: base counts, scaled by category / month
  // ------------------------------------------------------------------
  readonly procurementCategories = ['all', 'itEquipment', 'furniture', 'vehicles', 'services'] as const;

  /** Breakdown for a category + month (0 = this month, 1 = last month …; deterministic mock variation). */
  procurementBreakdown(category: string, monthOffset: number): ProcurementBreakdown[] {
    const factor = category === 'all' ? 1 : 0.35 + (category.length % 4) * 0.12;
    // Repeats every 8 months, so months years back still look realistic.
    const wobble = 1 - (monthOffset % 8) * 0.07;
    const scale = (n: number) => Math.max(1, Math.round(n * factor * wobble));
    return [
      { state: 'new', icon: 'state-new', count: scale(50) },
      { state: 'shipping', icon: 'state-shipping', count: scale(50) },
      { state: 'pending', icon: 'state-pending', count: scale(50) },
      { state: 'cancelled', icon: 'state-cancelled', count: scale(50) },
      { state: 'delivered', icon: 'state-delivered', count: scale(123) },
    ];
  }

  // ------------------------------------------------------------------
  // Recent transactions
  // ------------------------------------------------------------------
  readonly transactions = signal<TransactionItem[]>([
    { id: 1, number: 'BDRS/2026/BR/8008', type: 'financial', employee: PEOPLE[0], duration: { value: 1, unit: 'day' } },
    { id: 2, number: 'BDRS/2026/BR/8009', type: 'custody', employee: PEOPLE[1], duration: { value: 2, unit: 'day' } },
    { id: 3, number: 'BDRS/2026/BR/8010', type: 'purchase', employee: PEOPLE[2], duration: { value: 3, unit: 'week' } },
    { id: 4, number: 'BDRS/2026/BR/8011', type: 'warehouse', employee: PEOPLE[3], duration: { value: 5, unit: 'month' } },
    { id: 5, number: 'BDRS/2026/BR/8012', type: 'maintenance', employee: PEOPLE[4], duration: { value: 5, unit: 'year' } },
  ]);
  /** Total count on the server (for the "show N more" link). */
  readonly transactionsTotal = signal(261);

  // ------------------------------------------------------------------
  // Warehouses
  // ------------------------------------------------------------------
  readonly warehouseItems = signal<WarehouseItem[]>([
    { id: 1, number: 'BDRS/2026/BR/8008', product: t('Sugar', 'سكر'), quantity: 1, unit: t('bag', 'كيس'), minLevel: 1, maxLevel: 31 },
    { id: 2, number: 'BDRS/2026/BR/8014', product: t('Tea', 'شاي'), quantity: 2, unit: t('piece', 'قطعة'), minLevel: 1, maxLevel: 21 },
    { id: 3, number: 'BDRS/2026/BR/8030', product: t('Desks', 'مكاتب'), quantity: 3, unit: t('unit', 'وحدة'), minLevel: 1, maxLevel: 11 },
    { id: 4, number: 'BDRS/2026/BR/8031', product: t('Curtains', 'ستائر'), quantity: 4, unit: t('meter', 'متر'), minLevel: 2, maxLevel: 15 },
    { id: 5, number: 'BDRS/2026/BR/8042', product: t('Tables', 'طاولات'), quantity: 5, unit: t('set', 'طقم'), minLevel: 1, maxLevel: 41 },
    { id: 6, number: 'BDRS/2026/BR/8050', product: t('Printer paper', 'ورق طباعة'), quantity: 48, unit: t('box', 'صندوق'), minLevel: 10, maxLevel: 60 },
    { id: 7, number: 'BDRS/2026/BR/8051', product: t('Coffee', 'قهوة'), quantity: 36, unit: t('bag', 'كيس'), minLevel: 8, maxLevel: 40 },
  ]);
  readonly warehouseTotal = signal(263);

  // ------------------------------------------------------------------
  // Contracts
  // ------------------------------------------------------------------
  readonly contracts = signal<ContractItem[]>([
    { id: 1, number: 'BDRS/2026/BR/8008', supplier: t('Qatar National Bank', 'البنك الوطني القطري'), logoUrl: 'images/suppliers/qnb.svg', logoColor: '#1e5aa8', date: daysAgo(18), progress: 25 },
    { id: 2, number: 'BDRS/2026/BR/8009', supplier: t('Ooredoo Qatar', 'أوريدو قطر'), logoUrl: 'images/suppliers/ooredoo.svg', logoColor: '#e30613', date: daysAgo(25), progress: 55 },
    { id: 3, number: 'BDRS/2026/BR/8010', supplier: t('Qatar Industries', 'مصانع قطر'), logoUrl: 'images/suppliers/qatar-industries.svg', logoColor: '#8b1d6b', date: daysAgo(21), progress: 85 },
    { id: 4, number: 'BDRS/2026/BR/8011', supplier: t('Woqod Qatar', 'وقود قطر'), logoUrl: 'images/suppliers/woqod.svg', logoColor: '#1c8c3c', date: daysAgo(19), progress: 15 },
    { id: 5, number: 'BDRS/2026/BR/8012', supplier: t('Vodafone Qatar', 'فودافون قطر'), logoUrl: 'images/suppliers/vodafone-logo.png', logoColor: '#e60000', date: daysAgo(23), progress: 70 },
  ]);
  readonly contractsTotal = signal(260);

  // ------------------------------------------------------------------
  // Budget items: stacked bars per month, per year
  // ------------------------------------------------------------------
  readonly budgetYears = [2026, 2025, 2024];

  budgetItems(year: number): BudgetMonth[] {
    // Base values approximate the design; other years vary slightly.
    const base: [number, number][] = [
      [42_000, 38_000], [31_000, 27_000], [6_000, 34_000], [25_000, 15_000],
      [31_000, 27_000], [53_000, 27_000], [53_000, 59_000], [25_000, 12_000],
      [7_000, 11_000], [41_000, 58_000], [16_000, 22_000], [29_000, 43_000],
    ];
    const f = year === 2025 ? 1 : year === 2026 ? 1.08 : 0.9;
    return base.map(([spent, remaining], month) => ({
      month,
      spent: Math.round(spent * f),
      remaining: Math.round(remaining * f),
    }));
  }

  // ------------------------------------------------------------------
  // Notifications (navbar bell)
  // ------------------------------------------------------------------
  private readonly _notifications = signal<NotificationItem[]>([
    { id: 1, message: 'notifications.awaitingApproval', reference: 'BDS/ANS/0000/2545', date: minutesAgo(35), unread: true, actions: true },
    { id: 2, message: 'notifications.approved', reference: 'BDS/ANS/0000/7777', date: minutesAgo(120), unread: true, attachment: { name: 'Datasheet_draft_02.pdf', size: '720 KB' } },
    {
      id: 3,
      message: 'notifications.commentAdded',
      reference: 'BDS/ANS/0000/2548',
      date: minutesAgo(60 * 26),
      unread: false,
      comment: t(
        'The purchase request has been reviewed. We confirm the requested items are essential for business continuity, subject to budget availability. Please complete the purchase as soon as possible given the operational need.',
        'تمت مراجعة طلب المشتريات، ونؤكد أن المواد المطلوبة ضرورية لاستمرارية العمل، مع مراعاة توفر الميزانية. نرجو استكمال إجراءات الشراء في أقرب وقت ممكن نظراً للحاجة التشغيلية للطلب.',
      ),
    },
  ]);
  readonly notifications = this._notifications.asReadonly();
  readonly unreadCount = computed(() => this._notifications().filter((n) => n.unread).length);

  markAllRead(): void {
    this._notifications.update((list) => list.map((n) => ({ ...n, unread: false })));
  }

  dismissNotification(id: number): void {
    this._notifications.update((list) => list.filter((n) => n.id !== id));
  }
}

// ===========================================================================
// Mock data helpers
// ===========================================================================

/** Shorthand for a LocalizedText. */
function t(en: string, ar: string): LocalizedText {
  return { en, ar };
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

/** Employees used across the widgets (names taken from the design). */
const PEOPLE: Person[] = [
  { name: t('Fares Osama Tariq', 'فارس أسامة طارق'), email: 'faresotarek@moi.gov.qa' },
  { name: t('Hamed Hani Naeem', 'حامد هاني نعيم'), email: 'hamedhani@moi.gov.qa' },
  { name: t('Jassim Mohammed Hamed', 'جاسم محمد حامد'), email: 'jassem@moi.gov.qa' },
  { name: t('Amir Ali Al-Zawi', 'أمير علي الزاوي'), email: 'amirali@moi.gov.qa' },
  { name: t('Haifa Hatem Hijab', 'هيفاء حاتم حجاب'), email: 'haifahatem@moi.gov.qa' },
];

const TASK_DESCRIPTIONS: LocalizedText[] = [
  t('Supply of computers', 'توريد أجهزة حواسيب'),
  t('License renewal', 'تجديد تراخيص'),
  t('Technology upgrade', 'ترقية وتحديث تكنولوجيا'),
  t('Supply of tablet accessories', 'توريد ملحقات أجهزة لوحية'),
  t("Director's vehicle insurance payment", 'دفع تأمين سيارات المدير'),
  t('Office furniture purchase', 'شراء أثاث مكتبي'),
  t('Network maintenance contract', 'عقد صيانة الشبكة'),
  t('Printing supplies', 'مستلزمات الطباعة'),
  t('Security cameras approval', 'اعتماد شراء كاميرات مراقبة'),
  t('Training program fees', 'رسوم برنامج تدريبي'),
];

const TASK_STATUS_CYCLE: TaskStatus[] = ['completed', 'inProgress', 'executed', 'review', 'sent'];

/** Build `count` tasks; the first five match the design rows. */
function generateTasks(count: number): TaskItem[] {
  const notes = [1, 2, 8, 9, 14];
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    number: `BDRS/2026/BR/${8008 + i}`,
    description: TASK_DESCRIPTIONS[i % TASK_DESCRIPTIONS.length],
    attachments: i % 2 === 0 ? 4 : 5,
    notes: notes[i % notes.length] + Math.floor(i / 5),
    status: TASK_STATUS_CYCLE[i % TASK_STATUS_CYCLE.length],
    creator: PEOPLE[i % PEOPLE.length],
    date: daysAgo([2, 4, 0, 1, 6][i % 5] + Math.floor(i / 5) * 3),
  }));
}

/** Activities spread over today, yesterday and earlier dates. */
function generateActivities(): ActivityItem[] {
  const actor = t('Ibrahim Khalil Abdulrahman', 'إبراهيم خليل عبد الرحمن');
  const officer = t('Lt. Col. Abdulaziz Al-Ruwaili', 'المقدم: عبد العزيز الرويلي');
  const finance = t('Finance Department', 'قسم المالية');

  const yesterdayNoon = new Date();
  yesterdayNoon.setDate(yesterdayNoon.getDate() - 1);
  yesterdayNoon.setHours(12, 30, 0, 0);

  const at = (days: number, h: number, m: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  return [
    { id: 1, kind: 'message', date: minutesAgo(1), actor, action: 'activities.sentMessageTo', target: officer },
    { id: 2, kind: 'reply', date: minutesAgo(1), actor, action: 'activities.answeredRequest', target: officer, replyTo: 1 },
    { id: 3, kind: 'accepted', date: yesterdayNoon.toISOString(), actor, action: 'activities.acceptedFrom', target: finance },
    { id: 4, kind: 'answered', date: at(4, 11, 28), actor, action: 'activities.answeredRequest', target: finance },
    { id: 5, kind: 'accepted', date: at(4, 13, 30), actor, action: 'activities.acceptedFrom', target: finance },
    { id: 6, kind: 'answered', date: at(5, 11, 28), actor, action: 'activities.answeredRequest', target: finance },
    { id: 7, kind: 'message', date: at(12, 9, 15), actor, action: 'activities.sentMessageTo', target: officer },
    { id: 8, kind: 'accepted', date: at(20, 10, 5), actor, action: 'activities.acceptedFrom', target: finance },
  ];
}
