/**
 * Sidebar navigation tree, matching the menu in the Figma design.
 * `label` is a translation key; `icon` is an SVG in public/icons.
 * Items without `route` belong to modules
 * outside this task, so clicking them shows a "not in demo" notice.
 */
export interface NavNode {
  label: string;
  icon: string;
  route?: string;
  children?: NavNode[];
  /** Small counter bubble (e.g. pending items). */
  badge?: number;
  /** Counter bubble filled from live data, by key (see SidebarComponent.liveBadges). */
  liveBadge?: 'procurement';
  /** Greyed-out item, as in the design. */
  disabled?: boolean;
}

/** Main group: Home, then the Operations tree (up to three levels deep). */
export const NAV_TREE: NavNode[] = [
  { label: 'nav.home', icon: 'home', route: '/dashboard' },
  {
    label: 'nav.operations',
    icon: 'tasks',
    children: [
      {
        label: 'nav.departmentRequests',
        icon: 'department-requests',
        children: [
          { label: 'nav.additionalFunds', icon: 'additional-funds' },
          { label: 'nav.cameraApproval', icon: 'camera-approval' },
          { label: 'nav.centralItems', icon: 'central-items' },
          { label: 'nav.budgetProposals', icon: 'budget-proposals' },
        ],
      },
      {
        label: 'nav.warehouseRequests',
        icon: 'warehouses',
        children: [
          { label: 'nav.consumables', icon: 'consumables' },
          { label: 'nav.newCustody', icon: 'new-custody' },
          { label: 'nav.custodyProcedures', icon: 'custody-procedures' },
          // Greyed out as in the design, so it can't be opened from the menu
          { label: 'nav.scrapRequests', icon: 'scrap-requests', disabled: true },
        ],
      },
      { label: 'nav.maintenance', icon: 'maintenance' },
      { label: 'nav.inquiries', icon: 'inquiries' },
    ],
  },
];

/** Second group, shown after the divider. */
export const NAV_TREE_SECONDARY: NavNode[] = [
  { label: 'nav.warehouses', icon: 'warehouses' },
  { label: 'nav.accounting', icon: 'accounting' },
  // Procurement opens the purchase requests page directly (as in the design).
  // Its badge counts requests still in progress.
  { label: 'nav.procurement', icon: 'procurement', route: '/procurement/purchase-requests', liveBadge: 'procurement' },
];

/** Pinned to the bottom of the sidebar. */
export const NAV_FOOTER: NavNode[] = [
  { label: 'nav.support', icon: 'support' },
  { label: 'nav.settings', icon: 'settings' },
];
