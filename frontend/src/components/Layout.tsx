import { useState } from 'react';
import type { ReactNode } from '../types/react';
import {
  Box,
  Container,
  Group,
  Text,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
  ActionIcon,
  Drawer,
  Stack,
  Divider,
  rem,
  Burger,
  Badge,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link, useLocation } from 'react-router-dom';
import {
  IconSun,
  IconMoon,
  IconHome,
  IconScale,
  IconInfoCircle,
  IconBook,
  IconLeaf,
  IconShieldCheck,
  IconPigMoney,
  IconCar,
  IconFlame,
} from '@tabler/icons-react';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const mainNavItems: NavItem[] = [
  { to: '/', label: 'Início', icon: <IconHome size={18} /> },
  { to: '/comparacao', label: 'Comprar vs Alugar', icon: <IconScale size={18} /> },
  { to: '/estresse', label: 'Teste de estresse', icon: <IconShieldCheck size={18} /> },
  { to: '/reserva', label: 'Reserva', icon: <IconPigMoney size={18} /> },
  { to: '/fire', label: 'FIRE', icon: <IconFlame size={18} /> },
  { to: '/veiculos', label: 'Veículos', icon: <IconCar size={18} /> },
];

const secondaryNavItems: NavItem[] = [
  { to: '/docs/quickstart', label: 'Documentação', icon: <IconBook size={18} /> },
  { to: '/sobre', label: 'Sobre', icon: <IconInfoCircle size={18} /> },
];

function NavLink({ to, label, icon, active, onClick }: NavItem & { active: boolean; onClick?: () => void }) {
  return (
    <UnstyledButton
      component={Link}
      to={to}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: rem(8),
        padding: `${rem(8)} ${rem(14)}`,
        borderRadius: rem(8),
        fontWeight: 500,
        fontSize: rem(14),
        color: active ? 'var(--mantine-primary-color-filled)' : 'var(--mantine-color-dimmed)',
        backgroundColor: active ? 'var(--mantine-color-default-hover)' : 'transparent',
        transition: 'all 150ms ease',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = 'var(--mantine-color-default-hover)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      {icon}
      {label}
    </UnstyledButton>
  );
}

function MobileNavLink({ to, label, icon, active, onClick }: NavItem & { active: boolean; onClick?: () => void }) {
  return (
    <UnstyledButton
      component={Link}
      to={to}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: rem(12),
        padding: `${rem(14)} ${rem(16)}`,
        borderRadius: rem(8),
        fontWeight: 500,
        fontSize: rem(16),
        color: active ? 'var(--mantine-primary-color-filled)' : 'var(--mantine-color-text)',
        backgroundColor: active ? 'var(--mantine-color-default-hover)' : 'transparent',
        transition: 'all 150ms ease',
      }}
    >
      {icon}
      {label}
    </UnstyledButton>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false);
  const { setColorScheme, colorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light');
  const location = useLocation();

  const isActive = (to: string) => {
    if (to === '/') return location.pathname === '/';
    return location.pathname === to || location.pathname.startsWith(to + '/');
  };

  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--mantine-color-body)',
      }}
    >
      {/* Header */}
      <Box
        component="header"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          borderBottom: '1px solid var(--mantine-color-default-border)',
          backgroundColor: 'color-mix(in srgb, var(--mantine-color-body) 92%, transparent)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Container size="xl" py="sm">
          <Group justify="space-between" wrap="nowrap">
            {/* Logo */}
            <UnstyledButton component={Link} to="/">
              <Group gap="xs">
                <Box
                  style={{
                    width: rem(36),
                    height: rem(36),
                    borderRadius: rem(10),
                    background: 'linear-gradient(135deg, var(--mantine-color-ocean-6) 0%, var(--mantine-color-ocean-7) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(44, 112, 163, 0.25)',
                  }}
                >
                  <IconLeaf size={20} />
                </Box>
                <Box>
                  <Text fw={700} size="lg" lh={1.1} c="light-dark(var(--mantine-color-ocean-8), var(--mantine-color-text))">
                    Farol
                  </Text>
                  <Text size="xs" c="dimmed" lh={1}>
                    Planejamento Financeiro
                  </Text>
                </Box>
              </Group>
            </UnstyledButton>

            {/* Desktop Navigation */}
            <Group gap="xs" visibleFrom="md">
              {mainNavItems.map((item) => (
                <NavLink key={item.to} {...item} active={isActive(item.to)} />
              ))}
              <Box
                style={{
                  width: 1,
                  height: rem(24),
                  background: 'var(--mantine-color-default-border)',
                  margin: `0 ${rem(8)}`,
                }}
              />
              {secondaryNavItems.map((item) => (
                <NavLink key={item.to} {...item} active={isActive(item.to)} />
              ))}
            </Group>

            {/* Actions */}
            <Group gap="xs">
              <ActionIcon
                variant="subtle"
                color="ocean"
                size="lg"
                radius="lg"
                onClick={() => setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark')}
                aria-label="Alternar tema"
              >
                {computedColorScheme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
              </ActionIcon>

              <Burger
                opened={drawerOpened}
                onClick={openDrawer}
                hiddenFrom="md"
                size="sm"
                aria-label="Abrir menu"
              />
            </Group>
          </Group>
        </Container>
      </Box>

      {/* Mobile Drawer */}
      <Drawer
        opened={drawerOpened}
        styles={{
          content: {
            backgroundColor: 'var(--mantine-color-body)',
          },
        }}
        onClose={closeDrawer}
        size="100%"
        padding="lg"
        title={
          <Group gap="xs">
            <Box
              style={{
                width: rem(32),
                height: rem(32),
                borderRadius: rem(8),
                background: 'linear-gradient(135deg, var(--mantine-color-ocean-6) 0%, var(--mantine-color-ocean-7) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
              }}
            >
              <IconLeaf size={16} />
            </Box>
            <Text fw={700} c="light-dark(var(--mantine-color-ocean-8), var(--mantine-color-text))">Farol</Text>
          </Group>
        }
        zIndex={200}
      >
        <Stack gap="xs" mt="md">
          {mainNavItems.map((item) => (
            <MobileNavLink
              key={item.to}
              {...item}
              active={isActive(item.to)}
              onClick={closeDrawer}
            />
          ))}
          <Divider my="sm" color="var(--mantine-color-default-border)" />
          {secondaryNavItems.map((item) => (
            <MobileNavLink
              key={item.to}
              {...item}
              active={isActive(item.to)}
              onClick={closeDrawer}
            />
          ))}
        </Stack>
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        style={{
          flex: 1,
        }}
      >
        {children}
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        py="xl"
        style={{
          borderTop: '1px solid var(--mantine-color-default-border)',
          backgroundColor: 'var(--mantine-color-default)',
        }}
      >
        <Container size="xl">
          <Group justify="space-between" wrap="wrap" gap="md">
            <Group gap="xs">
              <Box
                style={{
                  width: rem(24),
                  height: rem(24),
                  borderRadius: rem(6),
                  background: 'linear-gradient(135deg, var(--mantine-color-ocean-6) 0%, var(--mantine-color-ocean-7) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                }}
              >
                <IconLeaf size={12} />
              </Box>
              <Text size="sm" c="dimmed">
                Farol © {new Date().getFullYear()}
              </Text>
            </Group>
            <Text size="xs" c="dimmed">
              Simulador educativo • Não é recomendação financeira
            </Text>
          </Group>
        </Container>
      </Box>
    </Box>
  );
}
