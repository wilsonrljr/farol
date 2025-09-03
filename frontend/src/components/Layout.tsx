import { ReactNode, useState } from 'react';
import { AppShell, Group, Burger, Button, useMantineColorScheme, ActionIcon, Text, Drawer, Stack, ThemeIcon } from '@mantine/core';
import { Link, useLocation } from 'react-router-dom';
import { IconSun, IconMoon, IconHome, IconCalculator, IconArrowsShuffle, IconInfoCircle } from '@tabler/icons-react';

const links = [
  { to: '/', label: 'Início', icon: <IconHome size={16} /> },
  { to: '/simulacao', label: 'Simulação', icon: <IconCalculator size={16} /> },
  { to: '/comparacao', label: 'Comparação', icon: <IconArrowsShuffle size={16} /> },
  { to: '/docs/quickstart', label: 'Docs', icon: <IconInfoCircle size={16} /> },
  { to: '/sobre', label: 'Sobre', icon: <IconInfoCircle size={16} /> }
];

export default function Layout({ children }: { children: ReactNode }) {
  const [opened, setOpened] = useState(false);
  const { setColorScheme, colorScheme } = useMantineColorScheme();
  const location = useLocation();

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={() => setOpened(true)} hiddenFrom="sm" size="sm" aria-label="Abrir menu" />
            <Text fw={700}>Farol</Text>
          </Group>
          <Group visibleFrom="sm" gap="xs">
            {links.map((l) => (
              <Button
                key={l.to}
                leftSection={l.icon}
                variant={location.pathname === l.to ? 'filled' : 'subtle'}
                component={Link}
                to={l.to}
                size="xs"
              >
                {l.label}
              </Button>
            ))}
            <ActionIcon variant="subtle" onClick={() => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')} aria-label="Alternar tema">
              {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
            </ActionIcon>
          </Group>
          <ActionIcon hiddenFrom="sm" variant="subtle" onClick={() => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')} aria-label="Alternar tema">
            {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
          </ActionIcon>
        </Group>
      </AppShell.Header>
      <Drawer opened={opened} onClose={() => setOpened(false)} title="Navegação" padding="md" size="xs">
        <Stack gap="xs">
          {links.map((l) => (
            <Button
              key={l.to}
              leftSection={<ThemeIcon size={20} variant="light" radius="sm">{l.icon}</ThemeIcon>}
              justify="flex-start"
              variant={location.pathname === l.to ? 'light' : 'subtle'}
              component={Link}
              to={l.to}
              onClick={() => setOpened(false)}
            >
              {l.label}
            </Button>
          ))}
        </Stack>
      </Drawer>
      <AppShell.Main style={{ scrollBehavior: 'smooth' }}>{children}</AppShell.Main>
    </AppShell>
  );
}
