import { createTheme, rem, type MantineColorsTuple, virtualColor } from '@mantine/core';

/*
 * Farol design system
 *
 * The interface is intentionally quiet: one primary blue, restrained semantic
 * colours, opaque surfaces and borders that remain legible in both schemes.
 * Legacy colour aliases are kept because calculation screens still consume
 * them while the product UI is consolidated.
 */

const ocean: MantineColorsTuple = [
  '#eff6ff',
  '#dbeafe',
  '#bfdbfe',
  '#93c5fd',
  '#60a5fa',
  '#3b82f6',
  '#2563eb',
  '#1d4ed8',
  '#1e40af',
  '#172554',
];

const slate: MantineColorsTuple = [
  '#f8fafc',
  '#f1f5f9',
  '#e2e8f0',
  '#cbd5e1',
  '#94a3b8',
  '#64748b',
  '#475569',
  '#334155',
  '#1e293b',
  '#0f172a',
];

const dark: MantineColorsTuple = [
  '#f8fafc',
  '#e2e8f0',
  '#cbd5e1',
  '#94a3b8',
  '#64748b',
  '#475569',
  '#334155',
  '#1e293b',
  '#0f172a',
  '#070d19',
];

const teal: MantineColorsTuple = [
  '#f0fdfa',
  '#ccfbf1',
  '#99f6e4',
  '#5eead4',
  '#2dd4bf',
  '#14b8a6',
  '#0d9488',
  '#0f766e',
  '#115e59',
  '#134e4a',
];

const emerald: MantineColorsTuple = [
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

const amber: MantineColorsTuple = [
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

const rose: MantineColorsTuple = [
  '#fff1f2',
  '#ffe4e6',
  '#fecdd3',
  '#fda4af',
  '#fb7185',
  '#f43f5e',
  '#e11d48',
  '#be123c',
  '#9f1239',
  '#881337',
];

const sky: MantineColorsTuple = [
  '#f0f9ff',
  '#e0f2fe',
  '#bae6fd',
  '#7dd3fc',
  '#38bdf8',
  '#0ea5e9',
  '#0284c7',
  '#0369a1',
  '#075985',
  '#0c4a6e',
];

const violet: MantineColorsTuple = [
  '#f5f3ff',
  '#ede9fe',
  '#ddd6fe',
  '#c4b5fd',
  '#a78bfa',
  '#8b5cf6',
  '#7c3aed',
  '#6d28d9',
  '#5b21b6',
  '#4c1d95',
];

const controlInputStyles = {
  input: {
    minHeight: rem(44),
    border: '1px solid var(--mantine-color-default-border)',
    backgroundColor: 'var(--farol-surface-raised)',
    transition: 'border-color 140ms ease, box-shadow 140ms ease',
  },
};

export const theme = createTheme({
  fontFamily:
    'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  headings: {
    fontFamily:
      'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontWeight: '650',
    sizes: {
      h1: { fontSize: rem(42), lineHeight: '1.12' },
      h2: { fontSize: rem(32), lineHeight: '1.2' },
      h3: { fontSize: rem(25), lineHeight: '1.28' },
      h4: { fontSize: rem(20), lineHeight: '1.35' },
      h5: { fontSize: rem(18), lineHeight: '1.4' },
      h6: { fontSize: rem(16), lineHeight: '1.45' },
    },
  },
  colors: {
    ocean,
    slate,
    teal,
    emerald,
    amber,
    rose,
    sky,
    violet,
    dark,
    gray: slate,
    // Compatibility aliases used by existing result and form components.
    sage: ocean,
    cream: slate,
    neutral: slate,
    forest: teal,
    success: emerald,
    warning: amber,
    danger: rose,
    info: sky,
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
    xs: rem(5),
    sm: rem(9),
    md: rem(16),
    lg: rem(24),
    xl: rem(32),
  },
  radius: {
    xs: rem(5),
    sm: rem(8),
    md: rem(10),
    lg: rem(14),
    xl: rem(18),
  },
  shadows: {
    xs: '0 1px 2px rgba(15, 23, 42, 0.04)',
    sm: '0 4px 12px rgba(15, 23, 42, 0.06)',
    md: '0 10px 28px rgba(15, 23, 42, 0.08)',
    lg: '0 18px 42px rgba(15, 23, 42, 0.1)',
    xl: '0 28px 64px rgba(15, 23, 42, 0.14)',
  },
  other: {
    transition: {
      fast: '140ms ease',
      normal: '200ms ease',
      slow: '280ms ease',
      spring: '280ms ease',
    },
  },
  components: {
    Button: {
      defaultProps: { radius: 'md' },
      styles: {
        root: {
          minHeight: rem(44),
          fontWeight: 650,
          transition: 'background-color 140ms ease, border-color 140ms ease, color 140ms ease',
        },
      },
    },
    Card: {
      defaultProps: { radius: 'lg', shadow: 'xs', withBorder: true },
      styles: {
        root: {
          backgroundColor: 'var(--farol-surface-raised)',
          borderColor: 'var(--mantine-color-default-border)',
        },
      },
    },
    Paper: {
      defaultProps: { radius: 'lg' },
      styles: {
        root: {
          backgroundColor: 'var(--farol-surface-raised)',
        },
      },
    },
    TextInput: { defaultProps: { radius: 'md' }, styles: controlInputStyles },
    NumberInput: { defaultProps: { radius: 'md' }, styles: controlInputStyles },
    Select: { defaultProps: { radius: 'md' }, styles: controlInputStyles },
    MultiSelect: { defaultProps: { radius: 'md' }, styles: controlInputStyles },
    PasswordInput: { defaultProps: { radius: 'md' }, styles: controlInputStyles },
    Textarea: { defaultProps: { radius: 'md' }, styles: controlInputStyles },
    Tabs: {
      styles: {
        tab: {
          minHeight: rem(44),
          borderRadius: rem(9),
          fontWeight: 600,
          transition: 'background-color 140ms ease, color 140ms ease',
        },
        list: { gap: rem(4) },
      },
    },
    ActionIcon: {
      defaultProps: { radius: 'md' },
      styles: { root: { transition: 'background-color 140ms ease, color 140ms ease' } },
    },
    Badge: {
      defaultProps: { radius: 'sm' },
      styles: { root: { fontWeight: 650, letterSpacing: rem(0.15) } },
    },
    Tooltip: {
      defaultProps: {
        radius: 'sm',
        withArrow: true,
        openDelay: 250,
        events: { hover: true, focus: true, touch: true },
      },
      styles: {
        tooltip: {
          backgroundColor: 'light-dark(var(--mantine-color-slate-9), var(--mantine-color-slate-0))',
          color: 'light-dark(var(--mantine-color-white), var(--mantine-color-slate-9))',
          boxShadow: 'var(--mantine-shadow-sm)',
        },
      },
    },
    Modal: {
      defaultProps: { radius: 'lg' },
      styles: {
        content: {
          border: '1px solid var(--mantine-color-default-border)',
          boxShadow: 'var(--mantine-shadow-xl)',
        },
      },
    },
    Drawer: {
      styles: {
        content: { backgroundColor: 'var(--farol-surface-raised)' },
        header: { borderBottom: '1px solid var(--mantine-color-default-border)' },
      },
    },
    Notification: {
      defaultProps: { radius: 'md', withBorder: true },
      styles: { root: { boxShadow: 'var(--mantine-shadow-md)' } },
    },
    ThemeIcon: { defaultProps: { radius: 'md' } },
    Progress: {
      styles: {
        root: { borderRadius: rem(999) },
        section: { borderRadius: rem(999) },
      },
    },
    Table: {
      styles: {
        th: {
          backgroundColor: 'var(--farol-surface-muted)',
          borderBottom: '1px solid var(--mantine-color-default-border)',
          color: 'var(--mantine-color-dimmed)',
          fontWeight: 650,
        },
        td: { borderBottom: '1px solid var(--mantine-color-default-border)' },
      },
    },
    SegmentedControl: {
      styles: {
        root: {
          padding: rem(4),
          border: '1px solid var(--mantine-color-default-border)',
          backgroundColor: 'var(--farol-surface-muted)',
        },
        indicator: {
          border: '1px solid var(--mantine-color-default-border)',
          boxShadow: 'var(--mantine-shadow-xs)',
        },
      },
    },
    Accordion: {
      styles: {
        item: { borderColor: 'var(--mantine-color-default-border)' },
        control: { minHeight: rem(48) },
      },
    },
    Menu: {
      styles: {
        dropdown: {
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: rem(12),
          backgroundColor: 'var(--farol-surface-raised)',
          boxShadow: 'var(--mantine-shadow-lg)',
        },
        item: { minHeight: rem(44), borderRadius: rem(8) },
      },
    },
    Popover: {
      styles: {
        dropdown: {
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: rem(12),
          backgroundColor: 'var(--farol-surface-raised)',
          boxShadow: 'var(--mantine-shadow-lg)',
        },
      },
    },
  },
});
