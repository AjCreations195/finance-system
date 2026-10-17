import { Injectable, computed, signal } from '@angular/core';
import { FinancialStat, LocalizedText, Person } from '../models/dashboard.models';
import {
  ActivityEntry,
  BudgetItem,
  PurchaseRequest,
  PurchaseRequestDetails,
  REQUEST_STATUSES,
  RequestStatus,
  TAB_STATUSES,
  WorkflowStep,
} from '../models/purchase-request.model';

/** Yearly budget for purchase requests (the design's 50 million riyals). */
export const ANNUAL_BUDGET = 50_000_000;

/**
 * PurchaseRequestService
 * ----------------------
 * In-memory store for purchase requests (mock backend).
 * Components read the `requests` signal and call the mutation methods;
 * replacing the seed data with HttpClient calls won't affect them.
 */
@Injectable({ providedIn: 'root' })
export class PurchaseRequestService {
  private readonly _requests = signal<PurchaseRequest[]>(generateRequests(130));
  readonly requests = this._requests.asReadonly();

  /**
   * Summary cards at the top of the page, computed from the requests, so
   * they change as requests are approved, rejected or deleted. Each card
   * (after the balance) matches one of the table's status tabs.
   */
  readonly stats = computed(() => buildStats(this._requests()));

  getById(id: number): PurchaseRequest | undefined {
    return this._requests().find((r) => r.id === id);
  }

  /** Full details for the side panel (mock: derived from the request, so it's stable per id). */
  getDetails(request: PurchaseRequest): PurchaseRequestDetails {
    return buildDetails(request);
  }

  /** Set the status of one or more requests. */
  setStatus(ids: number[], status: RequestStatus): void {
    const set = new Set(ids);
    this._requests.update((list) => list.map((r) => (set.has(r.id) ? { ...r, status } : r)));
  }

  /** Delete one or more requests. */
  delete(ids: number[]): void {
    const set = new Set(ids);
    this._requests.update((list) => list.filter((r) => !set.has(r.id)));
  }
}

// ===========================================================================
// Summary cards
// ===========================================================================

/**
 * Totals helpers over a list of requests, shared by this page's cards and
 * the dashboard's (DashboardDataService), so both calculate the same way.
 * "This month" (`latest`) is the month of the newest request.
 */
export function requestTotals(list: readonly PurchaseRequest[]) {
  /** Months since year 0, so consecutive months differ by 1 across years. */
  const monthOf = (r: PurchaseRequest) => {
    const d = new Date(r.date);
    return d.getFullYear() * 12 + d.getMonth();
  };
  const latest = list.reduce((max, r) => Math.max(max, monthOf(r)), 0);

  /** Sum of amounts with these statuses (optionally only in one month). */
  const total = (statuses: readonly RequestStatus[], month?: number) =>
    list
      .filter((r) => statuses.includes(r.status) && (month === undefined || monthOf(r) === month))
      .reduce((sum, r) => sum + r.amount, 0);

  /** Number of requests with these statuses. */
  const count = (statuses: readonly RequestStatus[]) => list.filter((r) => statuses.includes(r.status)).length;

  /** % change from `before` to `now`, rounded. */
  const change = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 100) : 0);

  /** % change of the total from last month to this month. */
  const monthly = (statuses: readonly RequestStatus[]) => change(total(statuses, latest), total(statuses, latest - 1));

  return { latest, total, count, change, monthly };
}

/**
 * The page's summary cards:
 *  - Available balance: yearly budget minus what requests have committed
 *    (everything except rejected requests); trend = this month's effect.
 *  - Posted / Under procedure / Rejected: total amount and number of
 *    requests in that table tab; trend = this month vs the month before.
 * "This month" is the month of the newest request.
 */
function buildStats(list: PurchaseRequest[]): FinancialStat[] {
  const { latest, total, count, change, monthly } = requestTotals(list);

  const committing = REQUEST_STATUSES.filter((s) => !TAB_STATUSES.rejected.includes(s));
  const available = ANNUAL_BUDGET - total(committing);
  const availableBeforeThisMonth = available + total(committing, latest);

  const tab = (id: string, statuses: readonly RequestStatus[], icon: string, higherIsBetter: boolean): FinancialStat => ({
    id,
    label: `requests.stats.${id}`,
    amount: total(statuses),
    count: count(statuses),
    icon,
    change: monthly(statuses),
    higherIsBetter,
    period: 'dashboard.period.lastMonth',
  });

  return [
    {
      id: 'available',
      label: 'requests.stats.available',
      amount: available,
      icon: 'stat-document',
      change: change(available, availableBeforeThisMonth),
      higherIsBetter: true,
      period: 'requests.period.year',
      periodParams: { year: Math.floor(latest / 12) },
      trendStyle: 'pill',
    },
    tab('posted', TAB_STATUSES.fullyCompleted, 'stat-document', true),
    // A growing backlog is bad news.
    tab('inProgress', TAB_STATUSES.inProgress, 'stat-wallet', false),
    tab('rejected', TAB_STATUSES.rejected, 'stat-document', false),
  ];
}

// ===========================================================================
// Mock data: the first 13 rows reproduce the Figma table exactly
// ===========================================================================

const t = (en: string, ar: string): LocalizedText => ({ en, ar });

const BUDGET_ITEMS: LocalizedText[] = [
  t('Miscellaneous equipment', 'أجهزة ومعدات متنوعة'),
  t('Computer software costs', 'تكاليف برامج الحاسبات الآلية'),
  t('Security, defence & armament', 'أمن ودفاع وتسليح'),
  t('Miscellaneous equipment', 'أجهزة ومعدات متنوعة'),
  t('Insurance expenses', 'مصروفات تأمين'),
  t('Electrical equipment', 'أجهزة ومعدات كهربائية'),
  t('Stationery & printing', 'قرطاسية ومطبوعات'),
  t('Consulting services', 'خدمات استشارية'),
  t('Travel & transport', 'مصاريف سفر وتنقلات'),
  t('Marketing & advertising', 'تسويق وإعلانات'),
  t('Office supplies', 'أدوات مكتبية'),
  t('Facilities maintenance', 'صيانة وتجديد المرافق'),
  t('Information & communication technology', 'تقنية المعلومات والاتصالات'),
];

const DESCRIPTIONS: LocalizedText[] = [
  t('Supply of modem devices', 'توريد أجهزة مودم'),
  t('License renewal', 'تجديد تراخيص'),
  t('Technology upgrade', 'ترقية وتحديث تكنولوجيا'),
  t('Supply of tablet accessories', 'توريد ملحقات أجهزة لوحية'),
  t("Director's vehicle insurance payment", 'دفع تأمين سيارات المدير'),
  t("Cables for the Minister's office", 'شراء أسلاك لمكتب سعادة الوزير'),
  t("Ink supply for the ministry's needs", 'توريد أحبار تغطية احتياجات الوزارة'),
  t('Equip new workstations', 'تجهيز محطات العمل الجديدة'),
  t('Staff training on new software', 'تدريب الموظفين على البرمجيات الجديدة'),
  t('Supply of new network equipment', 'توريد معدات شبكية جديدة'),
  t('Information security system update', 'تحديث نظام الأمان المعلوماتي'),
  t('Replace old computers', 'استبدال أجهزة الكمبيوتر القديمة'),
  t('Innovation & development workshops', 'تنظيم ورش عمل للابتكار والتطوير'),
];

const CREATORS: Person[] = [
  { name: t('Fares Osama Tariq', 'فارس أسامة طارق'), email: 'farestarek@moi.gov.qa' },
  { name: t('Hamed Hadi Zaeem', 'حامد هادي زعيم'), email: 'hamedzaiim@moi.gov.qa' },
  { name: t('Jassim Mohammed Hamed', 'جاسم محمد حامد'), email: 'jassem@moi.gov.qa' },
  { name: t('Amir Ali Al-Zawi', 'أمير علي الزاوي'), email: 'amirzawi@moi.gov.qa' },
  { name: t('Hiba Hatem Hijab', 'هيبة حاتم حجاب'), email: 'hibahijab@moi.gov.qa' },
  { name: t('Shujaa Ibrahim Khalil', 'شجاع إبراهيم خليل'), email: 'shaaakhalil@moi.gov.qa' },
  { name: t('Salma Sami Jaradat', 'سلمى سامي جرادات'), email: 'salamjradate@moi.gov.qa' },
  { name: t('Alyaa Youssef Al-Salem', 'علياء يوسف السالم'), email: 'aliyaalsalem@moi.gov.qa' },
  { name: t('Marwan Khaled Al-Taei', 'مروان خالد الطائي'), email: 'marwanaltai@moi.gov.qa' },
  { name: t('Fatima Nasser Al-Jubouri', 'فاطمة ناصر الجبوري'), email: 'fatimajabouri@moi.gov.qa' },
  { name: t('Saif Al-Din Mansour', 'سيف الدين منصور'), email: 'saifmana@moi.gov.qa' },
  { name: t('Manar Aziz Al-Makki', 'منار عزيز المكي'), email: 'manaralmaki@moi.gov.qa' },
  { name: t('Hassan Latif Al-Ali', 'حسن لطيف العلي'), email: 'hassanalali@moi.gov.qa' },
];

/** Status of each design row, in order. 'delivered' is extra (task brief), so it first appears on page 2. */
const STATUSES: RequestStatus[] = [
  'accepted', 'inProgress', 'finished', 'forReview', 'sent', 'rejected', 'pending',
  'completed', 'inCorrection', 'suspended', 'verified', 'notExecutable', 'closed', 'delivered',
];

/** Notes count and day of January from the design rows. */
const NOTES = [5, 2, 8, 11, 14, 20, 23, 31, 37, 42, 48, 53, 60];
const JAN_DAYS = [22, 20, 24, 26, 18, 28, 16, 30, 14, 12, 8, 6, 4];

function generateRequests(count: number): PurchaseRequest[] {
  return Array.from({ length: count }, (_, i) => {
    const k = i % 13; // position within the design's 13 rows
    const cycle = Math.floor(i / 13); // later pages vary a little
    const budget: BudgetItem = {
      name: BUDGET_ITEMS[k],
      code: `14027-${1303139 + k}-${String(k).padStart(3, '0')}`,
    };
    // Page 1 = January 2025 (design); later pages go back month by month.
    const date = new Date(2025, -cycle, JAN_DAYS[k]);
    return {
      id: i + 1,
      number: `BDRS/2016/019/${String(8 + i).padStart(4, '0')}`,
      budgetItem: budget,
      description: DESCRIPTIONS[(k + cycle) % DESCRIPTIONS.length],
      products: 5,
      notes: NOTES[k],
      status: STATUSES[(k + cycle * 3) % STATUSES.length],
      creator: CREATORS[k],
      date: date.toISOString(),
      amount: 25_000 + ((i * 7919) % 400_000),
    };
  });
}

// ===========================================================================
// Mock request details (side panel). Values follow the Figma panel; the
// workflow is derived from the request's status so the timeline matches it.
// ===========================================================================

const APPROVER = t('Mohammed Khaled Al-Tamimi', 'محمد خالد التميمي');
const MANAGER = t('Salim Abu Al-Haj', 'سليم أبو الحاج');
const REVIEWER = t('Jassim Mohammed Hamed', 'جاسم محمد حامد');
const PURCHASING = t('Purchasing department', 'إدارة المشتريات');

const IN_APPROVAL: RequestStatus[] = ['pending', 'forReview', 'sent', 'inProgress', 'suspended'];
const APPROVED: RequestStatus[] = ['accepted', 'completed', 'finished', 'closed', 'delivered'];
const REJECTED: RequestStatus[] = ['rejected', 'notExecutable'];

function buildWorkflow(request: PurchaseRequest): WorkflowStep[] {
  const s = request.status;
  const steps: WorkflowStep[] = [{ key: 'created', state: 'done', person: request.creator.name }];

  steps.push({ key: 'approval', state: IN_APPROVAL.includes(s) ? 'current' : 'done', person: APPROVER });
  if (s === 'inCorrection') steps.push({ key: 'returned', state: 'current', person: APPROVER });

  if (REJECTED.includes(s)) {
    steps.push({ key: 'rejected', state: 'rejected', person: PURCHASING });
  } else {
    const state = APPROVED.includes(s) ? 'done' : s === 'verified' ? 'current' : 'pending';
    steps.push({ key: 'accepted', state, person: PURCHASING });
  }
  return steps;
}

function buildActivity(request: PurchaseRequest): ActivityEntry[] {
  const at = (hours: number) => new Date(new Date(request.date).getTime() + hours * 3_600_000).toISOString();
  return [
    {
      id: 3,
      person: REVIEWER,
      date: at(48 + 13.5),
      message: t('Took 3 actions on the request', 'تم العمل على 3 إجراءات على الطلب'),
      tags: [
        { label: t('Add appendix', 'إضافة ملحق') },
        { label: t('Add attachment', 'إضافة مرفق') },
        { label: t('Remove appendix', 'حذف ملحق'), tone: 'danger' },
      ],
    },
    {
      id: 2,
      person: REVIEWER,
      date: at(24 + 11.75),
      message: t('Added a file to', 'تمت إضافة ملف إلى'),
      highlight: t('Correct the transfer location', 'إعادة تصحيح موقع التحويل'),
      attachment: { name: 'technical-specifications.pdf', size: '220 KB' },
    },
    {
      id: 1,
      person: REVIEWER,
      date: at(10 + 25 / 60),
      message: t('Transferred the request to the department manager', 'تم تحويل الطلب على مدير الإدارة'),
      highlight: MANAGER,
    },
  ];
}

function buildDetails(request: PurchaseRequest): PurchaseRequestDetails {
  const id = request.id;
  return {
    request,
    directorate: t('General Directorate of Supply and Equipment', 'الإدارة العامة للإمداد والتجهيز'),
    department: t('General Warehouses Department | Purchasing Section', 'إدارة المستودعات العامة | قسم المشتريات'),
    fiscalYear: new Date(request.date).getFullYear(),
    letterNumber: `${request.budgetItem.code.replace(/-/g, '').slice(0, 12)}-${String(id).padStart(3, '0')}`,
    supplierType: id % 4 === 0 ? 'international' : 'local',
    reason: (['departmentNeeds', 'replacement', 'newProject'] as const)[id % 3],
    requestType: id % 5 === 0 ? 'tender' : 'direct',
    confidentiality: id % 6 === 0 ? 'confidential' : 'normal',
    privacy: id % 7 === 0 ? 'restricted' : 'none',
    urgency: id % 3 === 0 ? 'normal' : 'urgent',
    views: (id * 7) % 23,
    workflow: buildWorkflow(request),
    activity: buildActivity(request),
    creatorRole: t('Requesting officer', 'مسؤول الطلب'),
    creatorPhone: `(+974) ${String(70_000_000 + ((id * 104_729) % 9_999_999)).replace(/(\d{2})(\d{3})(\d{3})/, '$1 $2 $3')}`,
    attachments: [1, 2, 3, 4].map((n) => ({ id: n, name: t(`Image ${n}`, `الصورة ${n}`), kind: 'image' as const, size: `${180 + n * 35} KB` })),
  };
}
