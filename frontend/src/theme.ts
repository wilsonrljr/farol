import { createTheme, rem, MantineColorsTuple, virtualColor } from '@mantine/core';

/**
 * Design System: Farol v3 - Liquid Glass
 * 
 * Inspirado no iOS 26 Liquid Glass e princípios de design espacial da Apple:
 * - Superfícies translúcidas com blur
 * - Sem bordas rígidas - sombras suaves para profundidade
 * - Transições fluidas e orgânicas
 * - Hierarquia visual através de opacidade e blur
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
    xs: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
    sm: '0 2px 8px -2px rgba(0, 0, 0, 0.06), 0 4px 16px -4px rgba(0, 0, 0, 0.04)',
    md: '0 4px 16px -4px rgba(0, 0, 0, 0.08), 0 8px 32px -8px rgba(0, 0, 0, 0.06)',
    lg: '0 8px 24px -6px rgba(0, 0, 0, 0.1), 0 16px 48px -12px rgba(0, 0, 0, 0.08)',
    xl: '0 16px 40px -8px rgba(0, 0, 0, 0.12), 0 24px 64px -16px rgba(0, 0, 0, 0.1)',
  },
  other: {
    // Custom tokens
    transition: {
      fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
      normal: '250ms cubic-bezier(0.2, 0, 0, 1)',
      slow: '400ms cubic-bezier(0.2, 0, 0, 1)',
      spring: '500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
  },
  components: {
    Button: {
      defaultProps: {
        radius: 'xl',
      },
      styles: {
        root: {
          fontWeight: 500,
          transition: 'all 250ms cubic-bezier(0.2, 0, 0, 1)',
          border: 'none',
        },
      },
    },
    Card: {
      defaultProps: {
        radius: 'xl',
        shadow: 'sm',
        withBorder: false,
      },
      styles: {
        root: {
          transition: 'all 250ms cubic-bezier(0.2, 0, 0, 1)',
          border: 'none',
        },
      },
    },
    Paper: {
      defaultProps: {
        radius: 'xl',
        shadow: 'sm',
      },
      styles: {
        root: {
          transition: 'all 250ms cubic-bezier(0.2, 0, 0, 1)',
          border: 'none',
        },
      },
    },
    TextInput: {
      defaultProps: {
        radius: 'lg',
      },
      styles: {
        input: {
          transition: 'all 200ms ease',
          border: '1.5px solid light-dark(rgba(0, 0, 0, 0.08), rgba(255, 255, 255, 0.08))',
          backgroundColor: 'light-dark(rgba(255, 255, 255, 0.8), rgba(30, 41, 59, 0.6))',
          '&:focus': {
            borderColor: 'var(--mantine-color-ocean-5)',
            backgroundColor: 'light-dark(rgba(255, 255, 255, 1), rgba(30, 41, 59, 0.8))',
          },
        },
      },
    },
    NumberInput: {
      defaultProps: {
        radius: 'lg',
      },
      styles: {
        input: {
          transition: 'all 200ms ease',
          border: '1.5px solid light-dark(rgba(0, 0, 0, 0.08), rgba(255, 255, 255, 0.08))',
          backgroundColor: 'light-dark(rgba(255, 255, 255, 0.8), rgba(30, 41, 59, 0.6))',
          '&:focus': {
            borderColor: 'var(--mantine-color-ocean-5)',
          },
        },
      },
    },
    Select: {
      defaultProps: {
        radius: 'lg',
      },
      styles: {
        input: {
          border: '1.5px solid light-dark(rgba(0, 0, 0, 0.08), rgba(255, 255, 255, 0.08))',
          backgroundColor: 'light-dark(rgba(255, 255, 255, 0.8), rgba(30, 41, 59, 0.6))',
        },
      },
    },
    Tabs: {
      styles: {
        tab: {
          fontWeight: 500,
          transition: 'all 200ms ease',
          borderRadius: rem(12),
        },
        list: {
          gap: rem(4),
        },
      },
    },
    ActionIcon: {
      defaultProps: {
        radius: 'xl',
      },
      styles: {
        root: {
          border: 'none',
        },
      },
    },
    Badge: {
      defaultProps: {
        radius: 'xl',
      },
      styles: {
        root: {
          border: 'none',
          fontWeight: 600,
        },
      },
    },
    Tooltip: {
      defaultProps: {
        radius: 'lg',
        withArrow: false,
      },
      styles: {
        tooltip: {
          backgroundColor: 'light-dark(rgba(15, 23, 42, 0.9), rgba(248, 250, 252, 0.95))',
          color: 'light-dark(var(--mantine-color-white), var(--mantine-color-dark-9))',
          backdropFilter: 'blur(12px)',
          border: 'none',
          boxShadow: '0 4px 16px -4px rgba(0, 0, 0, 0.15)',
        },
      },
    },
    Modal: {
      defaultProps: {
        radius: 'xl',
      },
      styles: {
        content: {
          border: 'none',
          boxShadow: '0 24px 80px -16px rgba(0, 0, 0, 0.25)',
        },
      },
    },
    Notification: {
      defaultProps: {
        radius: 'xl',
      },
      styles: {
        root: {
          border: 'none',
          boxShadow: 'var(--glass-shadow)',
        },
      },
    },
    ThemeIcon: {
      defaultProps: {
        radius: 'xl',
      },
    },
    Stepper: {
      styles: {
        stepIcon: {
          backgroundColor: 'light-dark(rgba(255, 255, 255, 0.9), rgba(30, 41, 59, 0.8))',
          border: 'none',
          boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.08)',
        },
      },
    },
    Timeline: {
      styles: {
        itemBullet: {
          backgroundColor: 'light-dark(rgba(255, 255, 255, 0.9), rgba(30, 41, 59, 0.8))',
          border: 'none',
          boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.08)',
        },
      },
    },
    Progress: {
      styles: {
        root: {
          backgroundColor: 'light-dark(rgba(0, 0, 0, 0.06), rgba(255, 255, 255, 0.08))',
          borderRadius: rem(999),
        },
        section: {
          borderRadius: rem(999),
        },
      },
    },
    Table: {
      styles: {
        th: {
          backgroundColor: 'light-dark(rgba(248, 250, 252, 0.8), rgba(30, 41, 59, 0.6))',
          border: 'none',
        },
        td: {
          border: 'none',
          borderBottom: '1px solid light-dark(rgba(0, 0, 0, 0.04), rgba(255, 255, 255, 0.04))',
        },
      },
    },
    SegmentedControl: {
      styles: {
        root: {
          backgroundColor: 'light-dark(rgba(0, 0, 0, 0.04), rgba(255, 255, 255, 0.06))',
          border: 'none',
          borderRadius: rem(12),
        },
        indicator: {
          boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.12)',
          borderRadius: rem(10),
        },
      },
    },
    Accordion: {
      styles: {
        item: {
          border: 'none',
          backgroundColor: 'transparent',
        },
        control: {
          borderRadius: rem(12),
        },
        content: {
          paddingTop: rem(8),
        },
      },
    },
    Menu: {
      styles: {
        dropdown: {
          border: 'none',
          boxShadow: '0 8px 32px -8px rgba(0, 0, 0, 0.15)',
          backdropFilter: 'blur(20px)',
          backgroundColor: 'light-dark(rgba(255, 255, 255, 0.95), rgba(30, 41, 59, 0.95))',
          borderRadius: rem(16),
        },
        item: {
          borderRadius: rem(10),
        },
      },
    },
    Popover: {
      styles: {
        dropdown: {
          border: 'none',
          boxShadow: '0 8px 32px -8px rgba(0, 0, 0, 0.15)',
          backdropFilter: 'blur(20px)',
          backgroundColor: 'light-dark(rgba(255, 255, 255, 0.95), rgba(30, 41, 59, 0.95))',
          borderRadius: rem(16),
        },
      },
    },
  },
});
