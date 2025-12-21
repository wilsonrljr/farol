import { ReactNode } from 'react';
import { AppShell, Group, Burger, useMantineColorScheme, ActionIcon, Text, NavLink, ScrollArea, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
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
  const [opened, { toggle, close }] = useDisclosure(false);
  const { setColorScheme, colorScheme } = useMantineColorScheme();
  const location = useLocation();

  const isActive = (to: string) => {
    if (to === '/') return location.pathname === '/';
    return location.pathname === to || location.pathname.startsWith(to + '/');
  };

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{ width: 280, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Abrir menu" />
            <div>
              <Text fw={800} lh={1.1}>Farol</Text>
              <Text size="xs" c="dimmed" lh={1.2}>Simulador financeiro imobiliário</Text>
            </div>
          </Group>
          <ActionIcon
            variant="subtle"
            onClick={() => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')}
            aria-label="Alternar tema"
          >
            {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
          </ActionIcon>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <AppShell.Section component={ScrollArea} scrollbarSize={6} offsetScrollbars grow>
          <Stack gap={4}>
            {links.map((l) => (
              <NavLink
                key={l.to}
                label={l.label}
                leftSection={l.icon}
                component={Link}
                to={l.to}
                active={isActive(l.to)}
                onClick={close}
                variant="subtle"
              />
            ))}
          </Stack>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main style={{ scrollBehavior: 'smooth' }}>{children}</AppShell.Main>
    </AppShell>
  );
}
