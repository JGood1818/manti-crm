export const PIPELINE_TYPES = {
  SALES_BD: 'sales_bd',
  INVESTOR: 'investor',
};

export const CATEGORIES = [
  'Sales/BD', 'Investor', 'Advisor', 'Legal', 'Banking', 'Operations', 'Team', 'Other'
];

export const CATEGORY_COLORS = {
  'Sales/BD': { bg: '#DBEAFE', text: '#1E40AF' },
  'Investor': { bg: '#D1FAE5', text: '#065F46' },
  'Advisor': { bg: '#FEF3C7', text: '#92400E' },
  'Legal': { bg: '#E0E7FF', text: '#3730A3' },
  'Banking': { bg: '#FCE7F3', text: '#9D174D' },
  'Operations': { bg: '#F3E8FF', text: '#6B21A8' },
  'Team': { bg: '#CCFBF1', text: '#0F766E' },
  'Other': { bg: '#F5F5F4', text: '#44403C' },
};

export const DAYS_SINCE_COLORS = {
  fresh: { bg: '#D1FAE5', text: '#065F46', max: 7 },     // 0-7 days: green
  recent: { bg: '#FEF3C7', text: '#92400E', max: 30 },   // 8-30 days: yellow
  stale: { bg: '#FEE2E2', text: '#991B1B', max: Infinity }, // 30+ days: red
};

export const getDaysSinceColor = (days) => {
  if (days === null || days === undefined) return { bg: '#F5F5F4', text: '#71717A' };
  if (days <= DAYS_SINCE_COLORS.fresh.max) return DAYS_SINCE_COLORS.fresh;
  if (days <= DAYS_SINCE_COLORS.recent.max) return DAYS_SINCE_COLORS.recent;
  return DAYS_SINCE_COLORS.stale;
};
