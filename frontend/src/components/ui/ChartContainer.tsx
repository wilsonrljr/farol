import { useId } from 'react';
import type { ReactNode } from '../../types/react';
import { Box, Group, Paper, Text } from '@mantine/core';

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
  const titleId = useId();

  return (
    <Paper
      component="section"
      aria-labelledby={titleId}
      p={{ base: 'md', sm: 'lg' }}
      radius="lg"
      shadow="none"
      withBorder
      style={{ background: 'var(--farol-surface-raised)', overflow: 'hidden' }}
    >
      <Group justify="space-between" align="flex-start" mb="lg" wrap="wrap" gap="sm">
        <Box style={{ minWidth: 0 }}>
          <Text id={titleId} component="h3" fw={650} size="lg" c="bright">
            {title}
          </Text>
          {subtitle && (
            <Text size="sm" c="dimmed" mt={2} lh={1.45}>
              {subtitle}
            </Text>
          )}
        </Box>
        {action && <Box>{action}</Box>}
      </Group>
      <Box style={{ height, minHeight: 240, width: '100%', minWidth: 0 }}>{children}</Box>
    </Paper>
  );
}
