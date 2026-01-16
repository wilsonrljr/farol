import type { ReactNode } from '../../types/react';
import { Box, rem } from '@mantine/core';

interface GlassCardProps {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'subtle' | 'accent';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  interactive?: boolean;
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
  interactive = false,
  accentColor,
  className = '',
  style,
}: GlassCardProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'elevated':
        return {
          background: 'var(--glass-bg-elevated)',
          backdropFilter: 'blur(var(--glass-blur-heavy))',
          WebkitBackdropFilter: 'blur(var(--glass-blur-heavy))',
          boxShadow: 'var(--glass-shadow-lg), var(--glass-shadow-glow)',
        };
      case 'subtle':
        return {
          background: 'var(--glass-bg-subtle)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: 'var(--glass-shadow-glow)',
        };
      case 'accent':
        return {
          background: `light-dark(
            linear-gradient(135deg, var(--mantine-color-${accentColor || 'ocean'}-0) 0%, rgba(255, 255, 255, 0.9) 100%),
            linear-gradient(135deg, var(--mantine-color-${accentColor || 'ocean'}-9) 0%, rgba(30, 41, 59, 0.85) 100%)
          )`,
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          boxShadow: `var(--glass-shadow), 0 0 0 1px var(--mantine-color-${accentColor || 'ocean'}-2) inset`,
        };
      default:
        return {
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          boxShadow: 'var(--glass-shadow), var(--glass-shadow-glow)',
        };
    }
  };

  const variantStyles = getVariantStyles();

  return (
    <Box
      className={`${interactive ? 'card-hover' : ''} ${className}`}
      style={{
        padding: paddingMap[padding],
        borderRadius: rem(20),
        border: 'none',
        transition: 'all 250ms cubic-bezier(0.2, 0, 0, 1)',
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
        background: 'light-dark(rgba(248, 250, 252, 0.6), rgba(15, 23, 42, 0.5))',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: rem(24),
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
        background: 'light-dark(rgba(0, 0, 0, 0.05), rgba(255, 255, 255, 0.06))',
        margin: `${rem(16)} 0`,
      }}
    />
  );
}
