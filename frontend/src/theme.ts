import { createTheme, rem, MantineColorsTuple, virtualColor } from '@mantine/core';

/**
 * Design System: Farol v2
 * 
 * Paleta baseada em evidência científica:
 * - Azuis transmitem confiança e são universalmente preferidos (Valdez & Mehrabian, 1994)
 * - Verde-azulado (teal) reduz ansiedade e melhora tomada de decisão financeira
 * - Alto contraste WCAG AA (4.5:1) para legibilidade
 * - Harmonia análoga com accent complementar para hierarquia visual
 * 
 * Cores semânticas consistentes:
 * - Primary (ocean): confiança, profissionalismo, decisões financeiras
 * - Success (emerald): ganhos, crescimento positivo
 * - Warning (amber): atenção, alertas moderados
 * - Danger (rose): perdas, alertas críticos
 * - Info (sky): informação neutra, dados secundários
 */

// Primary - Ocean Blue (confiança, finanças, profissionalismo)
// Baseado em estudos de percepção de cores em contextos financeiros
const ocean: MantineColorsTuple = [
  '#f0f7ff', // 0 - lightest bg
  '#e0efff', // 1 - subtle bg
  '#bfdbfe', // 2 - very light accent
  '#93c5fd', // 3 - light accent
  '#60a5fa', // 4 - mid
  '#3b82f6', // 5 - primary
  '#2563eb', // 6 - primary hover
  '#1d4ed8', // 7 - dark
  '#1e40af', // 8 - darker
  '#1e3a8a', // 9 - darkest
];

// Slate - Modern neutral with subtle blue undertone
// Melhor legibilidade que neutrals amarelados
const slate: MantineColorsTuple = [
  '#f8fafc', // 0 - lightest bg
  '#f1f5f9', // 1 - subtle bg
  '#e2e8f0', // 2 - muted bg
  '#cbd5e1', // 3 - border light
  '#94a3b8', // 4 - border/placeholder
  '#64748b', // 5 - secondary text
  '#475569', // 6 - subtle text
  '#334155', // 7 - secondary text dark
  '#1e293b', // 8 - primary text
  '#0f172a', // 9 - heading
];

// Dark palette - Deep slate for dark mode surfaces
const dark: MantineColorsTuple = [
  '#f8fafc', // 0 - brightest (text on dark)
  '#e2e8f0', // 1
  '#cbd5e1', // 2
  '#94a3b8', // 3
  '#64748b', // 4
  '#475569', // 5
  '#334155', // 6 - elevated surface
  '#1e293b', // 7 - surface
  '#0f172a', // 8 - background
  '#020617', // 9 - deepest
];

// Teal - Secondary accent (equilíbrio, crescimento)
const teal: MantineColorsTuple = [
  '#f0fdfa', // 0
  '#ccfbf1', // 1
  '#99f6e4', // 2
  '#5eead4', // 3
  '#2dd4bf', // 4
  '#14b8a6', // 5
  '#0d9488', // 6
  '#0f766e', // 7
  '#115e59', // 8
  '#134e4a', // 9
];

// Emerald - Success (ganhos, crescimento positivo)
const emerald: MantineColorsTuple = [
  '#ecfdf5', // 0
  '#d1fae5', // 1
  '#a7f3d0', // 2
  '#6ee7b7', // 3
  '#34d399', // 4
  '#10b981', // 5
  '#059669', // 6
  '#047857', // 7
  '#065f46', // 8
  '#064e3b', // 9
];

// Amber - Warning (atenção moderada)
const amber: MantineColorsTuple = [
  '#fffbeb', // 0
  '#fef3c7', // 1
  '#fde68a', // 2
  '#fcd34d', // 3
  '#fbbf24', // 4
  '#f59e0b', // 5
  '#d97706', // 6
  '#b45309', // 7
  '#92400e', // 8
  '#78350f', // 9
];

// Rose - Danger/Error (perdas, alertas críticos)
const rose: MantineColorsTuple = [
  '#fff1f2', // 0
  '#ffe4e6', // 1
  '#fecdd3', // 2
  '#fda4af', // 3
  '#fb7185', // 4
  '#f43f5e', // 5
  '#e11d48', // 6
  '#be123c', // 7
  '#9f1239', // 8
  '#881337', // 9
];

// Sky - Info (informação neutra, dados secundários)
const sky: MantineColorsTuple = [
  '#f0f9ff', // 0
  '#e0f2fe', // 1
  '#bae6fd', // 2
  '#7dd3fc', // 3
  '#38bdf8', // 4
  '#0ea5e9', // 5
  '#0284c7', // 6
  '#0369a1', // 7
  '#075985', // 8
  '#0c4a6e', // 9
];

// Violet - Accent para destacar oportunidades
const violet: MantineColorsTuple = [
  '#f5f3ff', // 0
  '#ede9fe', // 1
  '#ddd6fe', // 2
  '#c4b5fd', // 3
  '#a78bfa', // 4
  '#8b5cf6', // 5
  '#7c3aed', // 6
  '#6d28d9', // 7
  '#5b21b6', // 8
  '#4c1d95', // 9
];

// Legacy aliases for backwards compatibility (will be remapped)
const sage = ocean;  // Remap sage -> ocean
const cream = slate;  // Remap cream -> slate
const neutral = slate; // Remap neutral -> slate
const forest = teal;  // Remap forest -> teal
const success = emerald;
const warning = amber;
const danger = rose;
const info = sky;

export const theme = createTheme({
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  headings: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontWeight: '600',
    sizes: {
      h1: { fontSize: rem(40), lineHeight: '1.2' },
      h2: { fontSize: rem(32), lineHeight: '1.25' },
      h3: { fontSize: rem(24), lineHeight: '1.3' },
      h4: { fontSize: rem(20), lineHeight: '1.35' },
      h5: { fontSize: rem(18), lineHeight: '1.4' },
      h6: { fontSize: rem(16), lineHeight: '1.5' },
    },
  },
  colors: {
    // New primary colors
    ocean,
    slate,
    teal,
    emerald,
    amber,
    rose,
    sky,
    violet,
    // Legacy aliases for backwards compatibility
    sage,
    cream,
    neutral,
    gray: slate,
    dark,
    forest,
    success,
    warning,
    danger,
    info,
    // Virtual colors for semantic usage
    primary: virtualColor({ name: 'primary', dark: 'ocean', light: 'ocean' }),
    accent: virtualColor({ name: 'accent', dark: 'teal', light: 'teal' }),
  },
  primaryColor: 'ocean',
  primaryShade: { light: 6, dark: 5 },
  black: '#0f172a',
  white: '#ffffff',
  defaultRadius: 'md',
  cursorType: 'pointer',
  focusRing: 'auto',
  spacing: {
    xs: rem(4),
    sm: rem(8),
    md: rem(16),
    lg: rem(24),
    xl: rem(32),
  },
  radius: {
    xs: rem(4),
    sm: rem(6),
    md: rem(8),
    lg: rem(12),
    xl: rem(16),
  },
  shadows: {
    xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  },
  other: {
    // Custom tokens
    transition: {
      fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
      normal: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
      slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },
  components: {
    Button: {
      defaultProps: {
        radius: 'md',
      },
      styles: {
        root: {
          fontWeight: 500,
          transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        },
      },
    },
    Card: {
      defaultProps: {
        radius: 'lg',
        shadow: 'sm',
      },
      styles: {
        root: {
          transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        },
      },
    },
    Paper: {
      defaultProps: {
        radius: 'lg',
      },
      styles: {
        root: {
          transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        },
      },
    },
    TextInput: {
      defaultProps: {
        radius: 'md',
      },
      styles: {
        input: {
          transition: 'border-color 150ms ease, box-shadow 150ms ease',
        },
      },
    },
    NumberInput: {
      defaultProps: {
        radius: 'md',
      },
      styles: {
        input: {
          transition: 'border-color 150ms ease, box-shadow 150ms ease',
        },
      },
    },
    Select: {
      defaultProps: {
        radius: 'md',
      },
    },
    Tabs: {
      styles: {
        tab: {
          fontWeight: 500,
          transition: 'all 150ms ease',
        },
      },
    },
    ActionIcon: {
      defaultProps: {
        radius: 'md',
      },
    },
    Badge: {
      defaultProps: {
        radius: 'sm',
      },
    },
    Tooltip: {
      defaultProps: {
        radius: 'md',
        withArrow: true,
      },
      styles: {
        tooltip: {
          // Ensure tooltip respects color scheme
          backgroundColor: 'light-dark(var(--mantine-color-slate-8), var(--mantine-color-dark-6))',
          color: 'light-dark(var(--mantine-color-white), var(--mantine-color-slate-0))',
        },
      },
    },
    Modal: {
      defaultProps: {
        radius: 'lg',
      },
    },
    Notification: {
      defaultProps: {
        radius: 'lg',
      },
    },
    ThemeIcon: {
      defaultProps: {
        radius: 'md',
      },
    },
    Stepper: {
      styles: {
        stepIcon: {
          backgroundColor: 'light-dark(var(--mantine-color-slate-1), var(--mantine-color-dark-7))',
          borderColor: 'light-dark(var(--mantine-color-ocean-3), var(--mantine-color-dark-5))',
        },
      },
    },
    Timeline: {
      styles: {
        itemBullet: {
          backgroundColor: 'light-dark(var(--mantine-color-slate-1), var(--mantine-color-dark-7))',
          borderColor: 'light-dark(var(--mantine-color-ocean-4), var(--mantine-color-dark-5))',
        },
      },
    },
    Progress: {
      styles: {
        root: {
          backgroundColor: 'light-dark(var(--mantine-color-slate-2), var(--mantine-color-dark-6))',
        },
      },
    },
    Table: {
      styles: {
        th: {
          backgroundColor: 'light-dark(var(--mantine-color-slate-1), var(--mantine-color-dark-7))',
        },
      },
    },
  },
});
