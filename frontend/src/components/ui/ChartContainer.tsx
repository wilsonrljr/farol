import { ReactNode } from 'react';
import { Paper, Box, Text, Group, rem } from '@mantine/core';

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
    <Paper
      p="lg"
      radius="xl"
      style={{
        border: '1px solid var(--mantine-color-sage-2)',
      }}
    >
      <Group justify="space-between" align="flex-start" mb="lg">
        <Box>
          <Text fw={600} size="lg" c="sage.8">
            {title}
          </Text>
          {subtitle && (
            <Text size="sm" c="sage.6">
              {subtitle}
            </Text>
          )}
        </Box>
        {action}
      </Group>
      <Box style={{ height }}>{children}</Box>
    </Paper>
  );
}
