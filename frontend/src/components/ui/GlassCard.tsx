import type { ReactNode } from '../../types/react';
import { Box, rem } from '@mantine/core';

interface GlassCardProps {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'subtle' | 'accent';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  accentColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

const paddingMap = {
  none: 0,
  sm: rem(12),
  md: rem(16),
  lg: rem(24),
  xl: rem(32),
};

export function GlassCard({
  children,
  variant = 'default',
  padding = 'lg',
  accentColor,
  className = '',
  style,
}: GlassCardProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'elevated':
        return {
          background: 'var(--farol-surface-raised)',
          border: '1px solid var(--farol-border)',
          boxShadow: 'var(--mantine-shadow-xs)',
        };
      case 'subtle':
        return {
          background: 'var(--farol-surface-muted)',
          border: '1px solid var(--farol-border)',
          boxShadow: 'none',
        };
      case 'accent':
        return {
          background: `light-dark(var(--mantine-color-${accentColor || 'ocean'}-0), var(--mantine-color-dark-7))`,
          border: `1px solid var(--mantine-color-${accentColor || 'ocean'}-3)`,
          boxShadow: 'none',
        };
      default:
        return {
          background: 'var(--farol-surface-raised)',
          border: '1px solid var(--farol-border)',
          boxShadow: 'none',
        };
    }
  };

  const variantStyles = getVariantStyles();

  return (
    <Box
      className={className}
      style={{
        padding: paddingMap[padding],
        borderRadius: rem(14),
        transition: 'border-color 180ms ease, box-shadow 180ms ease',
        ...variantStyles,
        ...style,
      }}
    >
      {children}
    </Box>
  );
}

// Glass Surface - for larger areas
interface GlassSurfaceProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function GlassSurface({ children, className = '', style }: GlassSurfaceProps) {
  return (
    <Box
      className={className}
      style={{
        background: 'var(--farol-surface-muted)',
        border: '1px solid var(--farol-border)',
        borderRadius: rem(16),
        ...style,
      }}
    >
      {children}
    </Box>
  );
}

// Glass Divider - subtle separation
export function GlassDivider() {
  return (
    <Box
      style={{
        height: 1,
        background: 'var(--farol-border)',
        margin: `${rem(16)} 0`,
      }}
    />
  );
}
