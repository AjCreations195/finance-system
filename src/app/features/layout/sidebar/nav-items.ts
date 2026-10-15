/**
 * Sidebar navigation tree, matching the menu in the Figma design.
 * `label` is a translation key; `icon` is a Figma SVG in public/icons
 * (a "bi-…" Bootstrap icon class still works too). Items without `route` belong to modules
 * outside this task, so clicking them shows a "not in demo" notice.
 */
export interface NavNode {
  label: string;
  icon: string;
  route?: string;
  children?: NavNode[];
  /** Small counter bubble (e.g. pending items). */
  badge?: number;
  /** Greyed-out item, as in the design. */
  disabled?: boolean;
}

export const NAV_TREE: NavNode[] = [
  { label: 'nav.home', icon: 'home', route: '/dashboard' },
  {
    label: 'nav.operations',
    icon: 'requests',
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
        icon: 'warehouse-requests',
        children: [
          { label: 'nav.consumables', icon: 'consumables' },
          { label: 'nav.newCustody', icon: 'new-custody' },
          { label: 'nav.custodyProcedures', icon: 'custody-procedures' },
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
  { label: 'nav.accounting', icon: 'accounting', badge: 8 },
  // Procurement opens the purchase requests page directly (as in the design)
  { label: 'nav.procurement', icon: 'procurement', route: '/procurement/purchase-requests' },
];

/** Pinned to the bottom of the sidebar. */
export const NAV_FOOTER: NavNode[] = [
  { label: 'nav.support', icon: 'support' },
  { label: 'nav.settings', icon: 'settings' },
];
