import { createTheme, rem, MantineColorsTuple, virtualColor } from '@mantine/core';

// Design System: Farol
// Paleta orgânica e natural baseada nas cores:
// #727D73 (Sage Dark), #AAB99A (Sage), #D0DDD0 (Mint), #F0F0D7 (Cream)
// Foco em legibilidade e hierarquia visual clara

// Primary - Sage tones (verde-acinzentado sofisticado)
const sage: MantineColorsTuple = [
  '#f6f8f6', // 0 - lightest
  '#e8ede8', // 1
  '#d0ddd0', // 2 - base light (from palette)
  '#b8ccb8', // 3
  '#aab99a', // 4 - mid (from palette)
  '#94a885', // 5
  '#7d9370', // 6
  '#727d73', // 7 - base dark (from palette)
  '#5c665d', // 8
  '#475048', // 9 - darkest
];

// Cream/Warm neutral tones
const cream: MantineColorsTuple = [
  '#fafaf5', // 0 - lightest bg
  '#f6f6ed', // 1
  '#f0f0d7', // 2 - base (from palette)
  '#e8e8c8', // 3
  '#dedeb8', // 4
  '#d0d0a0', // 5
  '#b8b888', // 6
  '#989870', // 7
  '#787858', // 8
  '#585840', // 9 - darkest
];

// Neutrals - for text and backgrounds
const neutral: MantineColorsTuple = [
  '#fafaf9', // 0 - lightest bg
  '#f5f5f4', // 1 - subtle bg
  '#e7e5e4', // 2 - muted bg
  '#d6d3d1', // 3 - border light
  '#a8a29e', // 4 - border
  '#78716c', // 5 - placeholder
  '#57534e', // 6 - subtle text
  '#44403c', // 7 - secondary text
  '#292524', // 8 - primary text
  '#1c1917', // 9 - heading
];

// Forest - deeper green accent
const forest: MantineColorsTuple = [
  '#f0f7f0', // 0
  '#dceadc', // 1
  '#c5d9c5', // 2
  '#a8c4a8', // 3
  '#8aae8a', // 4
  '#6b946b', // 5
  '#4f7a4f', // 6
  '#3d603d', // 7
  '#2d462d', // 8
  '#1e2e1e', // 9
];

// Success - natural green
const success: MantineColorsTuple = [
  '#ecfdf5',
  '#d1fae5',
  '#a7f3d0',
  '#6ee7b7',
  '#34d399',
  '#10b981',
  '#059669',
  '#047857',
  '#065f46',
  '#064e3b',
];

// Warning - warm amber
const warning: MantineColorsTuple = [
  '#fffbeb',
  '#fef3c7',
  '#fde68a',
  '#fcd34d',
  '#fbbf24',
  '#f59e0b',
  '#d97706',
  '#b45309',
  '#92400e',
  '#78350f',
];

// Error/Danger - soft red
const danger: MantineColorsTuple = [
  '#fef2f2',
  '#fee2e2',
  '#fecaca',
  '#fca5a5',
  '#f87171',
  '#ef4444',
  '#dc2626',
  '#b91c1c',
  '#991b1b',
  '#7f1d1d',
];

// Info - muted blue-sage
const info: MantineColorsTuple = [
  '#f0f7fa',
  '#dceef5',
  '#b8dce8',
  '#8ec5d8',
  '#68acc5',
  '#4a93b0',
  '#3a7a96',
  '#2f6278',
  '#264c5c',
  '#1d3842',
];

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
    sage,
    cream,
    neutral,
    forest,
    success,
    warning,
    danger,
    info,
    // Virtual colors for semantic usage
    primary: virtualColor({ name: 'primary', dark: 'sage', light: 'sage' }),
    accent: virtualColor({ name: 'accent', dark: 'forest', light: 'forest' }),
  },
  primaryColor: 'sage',
  primaryShade: { light: 7, dark: 4 },
  black: '#1c1917',
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
          backgroundColor: 'var(--mantine-color-cream-1)',
          borderColor: 'var(--mantine-color-sage-3)',
        },
      },
    },
    Timeline: {
      styles: {
        itemBullet: {
          backgroundColor: 'var(--mantine-color-cream-1)',
          borderColor: 'var(--mantine-color-sage-4)',
        },
      },
    },
    Progress: {
      styles: {
        root: {
          backgroundColor: 'var(--mantine-color-cream-2)',
        },
      },
    },
  },
});
