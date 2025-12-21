import { ReactNode, useState } from 'react';
import {
  Box,
  Container,
  Group,
  Text,
  UnstyledButton,
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
  IconCalculator,
  IconScale,
  IconInfoCircle,
  IconBook,
  IconLeaf,
} from '@tabler/icons-react';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const mainNavItems: NavItem[] = [
  { to: '/', label: 'Início', icon: <IconHome size={18} /> },
  { to: '/simulacao', label: 'Simulação', icon: <IconCalculator size={18} /> },
  { to: '/comparacao', label: 'Comparação', icon: <IconScale size={18} /> },
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
        color: active ? 'var(--mantine-color-sage-7)' : 'var(--mantine-color-neutral-7)',
        backgroundColor: active ? 'var(--mantine-color-sage-0)' : 'transparent',
        transition: 'all 150ms ease',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = 'var(--mantine-color-cream-1)';
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
        color: active ? 'var(--mantine-color-sage-7)' : 'var(--mantine-color-neutral-8)',
        backgroundColor: active ? 'var(--mantine-color-sage-0)' : 'transparent',
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
        backgroundColor: 'var(--mantine-color-cream-0)',
      }}
    >
      {/* Header */}
      <Box
        component="header"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          borderBottom: '1px solid var(--mantine-color-sage-2)',
          backgroundColor: 'rgba(250, 250, 245, 0.95)',
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
                    background: 'linear-gradient(135deg, var(--mantine-color-sage-6) 0%, var(--mantine-color-sage-7) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(114, 125, 115, 0.25)',
                  }}
                >
                  <IconLeaf size={20} />
                </Box>
                <Box>
                  <Text fw={700} size="lg" lh={1.1} c="sage.8">
                    Farol
                  </Text>
                  <Text size="xs" c="sage.5" lh={1}>
                    Simulador Imobiliário
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
                  background: 'var(--mantine-color-sage-3)',
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
                color="sage"
                size="lg"
                radius="lg"
                onClick={() => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')}
                aria-label="Alternar tema"
              >
                {colorScheme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
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
                background: 'linear-gradient(135deg, var(--mantine-color-sage-6) 0%, var(--mantine-color-sage-7) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
              }}
            >
              <IconLeaf size={16} />
            </Box>
            <Text fw={700} c="sage.8">Farol</Text>
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
          <Divider my="sm" color="sage.2" />
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
          borderTop: '1px solid var(--mantine-color-sage-2)',
          backgroundColor: 'var(--mantine-color-cream-1)',
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
                  background: 'linear-gradient(135deg, var(--mantine-color-sage-6) 0%, var(--mantine-color-sage-7) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                }}
              >
                <IconLeaf size={12} />
              </Box>
              <Text size="sm" c="sage.6">
                Farol © {new Date().getFullYear()}
              </Text>
            </Group>
            <Text size="xs" c="sage.5">
              Simulador educativo • Não é recomendação financeira
            </Text>
          </Group>
        </Container>
      </Box>
    </Box>
  );
}
