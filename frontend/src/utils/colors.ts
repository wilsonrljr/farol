/**
 * Farol Design System v2 - Color Constants
 * 
 * Centralized color definitions for consistent usage across components.
 * Based on scientific color psychology research for financial applications.
 */

/**
 * Chart colors optimized for:
 * - Legibility and contrast
 * - Colorblind accessibility (deuteranopia, protanopia)
 * - Clear visual hierarchy
 */
export const CHART_COLORS = {
  // Primary series colors (ordered for contrast and accessibility)
  series: [
    'ocean.6',    // Primary blue - trustworthy, professional
    'teal.5',     // Secondary teal - growth, balance
    'violet.5',   // Accent purple - opportunity, distinction
    'amber.5',    // Warning amber - attention, caution
    'rose.5',     // Danger rose - losses, critical
    'sky.5',      // Info sky - neutral, secondary data
  ] as const,
  
  // Dark mode series (lighter for visibility on dark backgrounds)
  seriesDark: [
    'ocean.4',
    'teal.4',
    'violet.4',
    'amber.4',
    'rose.4',
    'sky.4',
  ] as const,
  
  // Semantic colors for specific data types
  positive: 'emerald.6',
  positiveDark: 'emerald.4',
  negative: 'rose.5',
  negativeDark: 'rose.4',
  neutral: 'slate.5',
  neutralDark: 'slate.4',
  
  // Scenario-specific colors (for comparison charts)
  scenarios: {
    buy: 'ocean.6',
    buyDark: 'ocean.4',
    rent: 'teal.5',
    rentDark: 'teal.4',
    invest: 'violet.5',
    investDark: 'violet.4',
  },
} as const;

/**
 * Preset colors for batch comparison (distinct enough for up to 10 presets)
 */
export const PRESET_COLORS = [
  { main: 'ocean', light: 'ocean.0', dark: 'ocean.7' },
  { main: 'teal', light: 'teal.0', dark: 'teal.7' },
  { main: 'violet', light: 'violet.0', dark: 'violet.7' },
  { main: 'amber', light: 'amber.0', dark: 'amber.7' },
  { main: 'rose', light: 'rose.0', dark: 'rose.7' },
  { main: 'sky', light: 'sky.0', dark: 'sky.7' },
  { main: 'emerald', light: 'emerald.0', dark: 'emerald.7' },
  { main: 'slate', light: 'slate.0', dark: 'slate.7' },
] as const;

/**
 * Semantic colors for UI elements
 */
export const SEMANTIC_COLORS = {
  success: {
    light: 'emerald.6',
    dark: 'emerald.4',
    bg: {
      light: 'emerald.0',
      dark: 'dark.7',
    },
  },
  warning: {
    light: 'amber.6',
    dark: 'amber.4',
    bg: {
      light: 'amber.0',
      dark: 'dark.7',
    },
  },
  danger: {
    light: 'rose.6',
    dark: 'rose.4',
    bg: {
      light: 'rose.0',
      dark: 'dark.7',
    },
  },
  info: {
    light: 'sky.6',
    dark: 'sky.4',
    bg: {
      light: 'sky.0',
      dark: 'dark.7',
    },
  },
  primary: {
    light: 'ocean.6',
    dark: 'ocean.4',
    bg: {
      light: 'ocean.0',
      dark: 'dark.8',
    },
  },
} as const;

/**
 * Get chart series color based on index
 */
export function getChartColor(index: number, isDark = false): string {
  const colors = isDark ? CHART_COLORS.seriesDark : CHART_COLORS.series;
  return colors[index % colors.length];
}

/**
 * Get scenario comparison colors
 */
export function getScenarioColors(isDark = false) {
  return {
    buy: isDark ? CHART_COLORS.scenarios.buyDark : CHART_COLORS.scenarios.buy,
    rent: isDark ? CHART_COLORS.scenarios.rentDark : CHART_COLORS.scenarios.rent,
    invest: isDark ? CHART_COLORS.scenarios.investDark : CHART_COLORS.scenarios.invest,
  };
}
