import { Group, Tooltip, Text, ActionIcon } from '@mantine/core';
import { IconHelpCircle } from '@tabler/icons-react';
import { ReactNode } from 'react';

interface LabelWithHelpProps {
  label: string;
  help: ReactNode;
  id?: string;
}

export function LabelWithHelp({ label, help, id }: LabelWithHelpProps) {
  return (
    <Group gap={4} align="center" wrap="nowrap" style={{ lineHeight: 1 }}>
      <Text component="label" size="sm" fw={500} htmlFor={id}>
        {label}
      </Text>
      <Tooltip label={help} multiline w={300} withArrow position="top-start">
        <ActionIcon variant="subtle" color="gray" size="xs" aria-label={`Ajuda: ${label}`}>
          <IconHelpCircle size={14} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
