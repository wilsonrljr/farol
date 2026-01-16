import type { CSSProperties } from 'react';

/**
 * Glass morphism styles following iOS 26 Liquid Glass design principles
 */

export const glassStyle: CSSProperties = {
  background: 'var(--glass-bg)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  boxShadow: 'var(--glass-shadow), var(--glass-shadow-glow)',
  borderRadius: 'var(--mantine-radius-xl)',
};

export const glassStyleLg: CSSProperties = {
  ...glassStyle,
  borderRadius: 'var(--mantine-radius-lg)',
};

export const glassSurfaceStyle: CSSProperties = {
  background: 'light-dark(rgba(255, 255, 255, 0.5), rgba(15, 23, 42, 0.5))',
  borderRadius: 'var(--mantine-radius-lg)',
  boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.08)',
};
