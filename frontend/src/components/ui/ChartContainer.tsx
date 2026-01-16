import type { ReactNode } from '../../types/react';
import { Box, Text, Group, rem } from '@mantine/core';

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  height?: number;
}

export function ChartContainer({
  title,
  subtitle,
  action,
  children,
  height = 300,
}: ChartContainerProps) {
  return (
    <Box
      p="lg"
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: 'var(--glass-shadow), var(--glass-shadow-glow)',
        borderRadius: rem(20),
      }}
    >
      <Group justify="space-between" align="flex-start" mb="lg">
        <Box>
          <Text fw={600} size="lg" c="bright">
            {title}
          </Text>
          {subtitle && (
            <Text size="sm" c="dimmed" mt={2}>
              {subtitle}
            </Text>
          )}
        </Box>
        {action}
      </Group>
      <Box style={{ height }}>{children}</Box>
    </Box>
  );
}
