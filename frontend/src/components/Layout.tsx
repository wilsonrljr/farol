import { useEffect, useRef } from 'react';
import {
  ActionIcon,
  Box,
  Burger,
  Container,
  Divider,
  Drawer,
  Group,
  Menu,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBook,
  IconBuildingLighthouse,
  IconCar,
  IconChevronDown,
  IconFlame,
  IconHome,
  IconInfoCircle,
  IconMoon,
  IconPigMoney,
  IconScale,
  IconShieldCheck,
  IconSun,
} from '@tabler/icons-react';
import { Link, useLocation, useNavigationType } from 'react-router-dom';
import type { ReactNode } from '../types/react';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Farol — Planejamento financeiro',
  '/comparacao': 'Comprar vs Alugar | Farol',
  '/estresse': 'Teste de estresse | Farol',
  '/reserva': 'Reserva de emergência | Farol',
  '/fire': 'Planejamento FIRE | Farol',
  '/veiculos': 'Comprar vs Assinar veículo | Farol',
  '/sobre': 'Sobre | Farol',
  '/docs': 'Documentação | Farol',
  '/docs/quickstart': 'Guia rápido | Documentação | Farol',
  '/docs/calculos': 'Cálculos | Documentação | Farol',
  '/docs/glossario': 'Glossário | Documentação | Farol',
};

function pageTitle(pathname: string) {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return PAGE_TITLES[normalizedPath] ?? 'Farol — Planejamento financeiro';
}

function hashTarget(hash: string) {
  if (!hash.startsWith('#') || hash.length === 1) return null;

  try {
    return document.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {
    return document.getElementById(hash.slice(1));
  }
}

interface NavItem {
  to: string;
  label: string;
  description?: string;
  icon: ReactNode;
  activePrefix?: string;
}

const primaryNavItems: NavItem[] = [
  { to: '/', label: 'Início', icon: <IconHome size={18} /> },
  {
    to: '/comparacao',
    label: 'Comprar vs Alugar',
    description: 'Compare três estratégias imobiliárias',
    icon: <IconScale size={18} />,
  },
];

const toolNavItems: NavItem[] = [
  {
    to: '/estresse',
    label: 'Teste de estresse',
    description: 'Avalie sua margem diante de imprevistos',
    icon: <IconShieldCheck size={18} />,
  },
  {
    to: '/reserva',
    label: 'Reserva de emergência',
    description: 'Dimensione sua proteção financeira',
    icon: <IconPigMoney size={18} />,
  },
  {
    to: '/fire',
    label: 'Planejamento FIRE',
    description: 'Projete sua independência financeira',
    icon: <IconFlame size={18} />,
  },
  {
    to: '/veiculos',
    label: 'Comprar vs Assinar veículo',
    description: 'Compare posse e assinatura no mesmo período',
    icon: <IconCar size={18} />,
  },
];

const supportNavItems: NavItem[] = [
  {
    to: '/docs/quickstart',
    label: 'Documentação',
    description: 'Metodologia, cálculos e glossário',
    icon: <IconBook size={18} />,
    activePrefix: '/docs',
  },
  {
    to: '/sobre',
    label: 'Sobre',
    description: 'Propósito, limites e autoria',
    icon: <IconInfoCircle size={18} />,
  },
];

function itemIsActive(pathname: string, item: NavItem) {
  const target = item.activePrefix ?? item.to;
  if (target === '/') return pathname === '/';
  return pathname === target || pathname.startsWith(`${target}/`);
}

function DesktopNavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <UnstyledButton
      component={Link}
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={`nav-link${active ? ' nav-link--active' : ''}`}
    >
      <Box component="span" aria-hidden="true" style={{ display: 'flex' }}>
        {item.icon}
      </Box>
      {item.label}
    </UnstyledButton>
  );
}

function MobileNavLink({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <UnstyledButton
      component={Link}
      to={item.to}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`mobile-nav-link${active ? ' mobile-nav-link--active' : ''}`}
    >
      <Box component="span" aria-hidden="true" className="mobile-nav-link__icon">
        {item.icon}
      </Box>
      <Box style={{ minWidth: 0 }}>
        <Text size="sm" fw={650} lh={1.25}>
          {item.label}
        </Text>
        {item.description && (
          <Text size="xs" c="dimmed" lh={1.35} mt={3}>
            {item.description}
          </Text>
        )}
      </Box>
    </UnstyledButton>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Group gap="sm" wrap="nowrap">
      <Box className="farol-brand__mark" aria-hidden="true">
        <IconBuildingLighthouse size={compact ? 18 : 20} stroke={1.8} />
      </Box>
      <Box>
        <Text fw={750} size={compact ? 'md' : 'lg'} lh={1.05}>
          Farol
        </Text>
        {!compact && <div className="farol-brand__tagline">Planejamento financeiro</div>}
      </Box>
    </Group>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const [drawerOpened, { toggle: toggleDrawer, close: closeDrawer }] = useDisclosure(false);
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light');
  const location = useLocation();
  const navigationType = useNavigationType();
  const mainRef = useRef<HTMLElement | null>(null);
  const scrollPositions = useRef(new Map<string, { left: number; top: number }>());
  const toolsActive = toolNavItems.some((item) => itemIsActive(location.pathname, item));

  useEffect(() => {
    document.title = pageTitle(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useEffect(() => {
    const locationKey = location.key;
    const positions = scrollPositions.current;
    let frame = 0;
    let cancelled = false;

    closeDrawer();

    if (location.hash) {
      let attemptsRemaining = 30;
      const scrollToTarget = () => {
        if (cancelled) return;
        const target = hashTarget(location.hash);

        if (target) {
          target.scrollIntoView({ block: 'start' });
          if (target === mainRef.current) {
            mainRef.current.focus({ preventScroll: true });
          }
          return;
        }

        attemptsRemaining -= 1;
        if (attemptsRemaining > 0) frame = window.requestAnimationFrame(scrollToTarget);
      };

      frame = window.requestAnimationFrame(scrollToTarget);
    } else if (navigationType === 'POP') {
      const savedPosition = positions.get(locationKey);

      if (savedPosition) {
        let attemptsRemaining = 30;
        const restorePosition = () => {
          if (cancelled) return;
          window.scrollTo({ left: savedPosition.left, top: savedPosition.top, behavior: 'instant' });

          attemptsRemaining -= 1;
          const restored =
            Math.abs(window.scrollX - savedPosition.left) < 1 &&
            Math.abs(window.scrollY - savedPosition.top) < 1;
          if (!restored && attemptsRemaining > 0) {
            frame = window.requestAnimationFrame(restorePosition);
          }
        };

        frame = window.requestAnimationFrame(restorePosition);
      }
    } else {
      window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
      frame = window.requestAnimationFrame(() => {
        mainRef.current?.focus({ preventScroll: true });
      });
    }

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      positions.set(locationKey, {
        left: window.scrollX,
        top: window.scrollY,
      });
    };
  }, [closeDrawer, location.hash, location.key, navigationType]);

  const toggleColorScheme = () => {
    setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <Box style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box component="a" href="#main-content" className="skip-link">
        Ir para o conteúdo principal
      </Box>

      <Box component="header" className="site-header">
        <Container size="xl">
          <Group className="site-header__inner" justify="space-between" wrap="nowrap" gap="md">
            <UnstyledButton
              component={Link}
              to="/"
              aria-label="Farol — página inicial"
              className="farol-brand"
            >
              <Brand />
            </UnstyledButton>

            <Group
              component="nav"
              aria-label="Navegação principal"
              className="desktop-navigation"
              gap={4}
              wrap="nowrap"
            >
              {primaryNavItems.map((item) => (
                <DesktopNavLink
                  key={item.to}
                  item={item}
                  active={itemIsActive(location.pathname, item)}
                />
              ))}

              <Menu width={310} position="bottom" offset={8} withinPortal>
                <Menu.Target>
                  <UnstyledButton
                    className={`nav-tools-trigger${toolsActive ? ' nav-tools-trigger--active' : ''}`}
                    aria-current={toolsActive ? 'page' : undefined}
                  >
                    Ferramentas
                    <IconChevronDown size={15} aria-hidden="true" />
                  </UnstyledButton>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Planejamento</Menu.Label>
                  {toolNavItems.map((item) => (
                    <Menu.Item
                      key={item.to}
                      component={Link}
                      to={item.to}
                      aria-current={itemIsActive(location.pathname, item) ? 'page' : undefined}
                      leftSection={<span className="nav-menu-item__icon">{item.icon}</span>}
                    >
                      <Text size="sm" fw={650}>
                        {item.label}
                      </Text>
                      <Text size="xs" c="dimmed" mt={2}>
                        {item.description}
                      </Text>
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>

              {supportNavItems.map((item) => (
                <DesktopNavLink
                  key={item.to}
                  item={item}
                  active={itemIsActive(location.pathname, item)}
                />
              ))}
            </Group>

            <Group gap={6} wrap="nowrap">
              <Tooltip
                label={computedColorScheme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              >
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size={44}
                  className="theme-toggle"
                  onClick={toggleColorScheme}
                  aria-label={computedColorScheme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
                >
                  {computedColorScheme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
                </ActionIcon>
              </Tooltip>

              <Burger
                opened={drawerOpened}
                onClick={toggleDrawer}
                className="mobile-navigation-toggle"
                size="sm"
                aria-label={drawerOpened ? 'Fechar menu' : 'Abrir menu'}
                aria-expanded={drawerOpened}
                aria-controls="mobile-navigation"
              />
            </Group>
          </Group>
        </Container>
      </Box>

      <Drawer
        id="mobile-navigation"
        opened={drawerOpened}
        onClose={closeDrawer}
        closeButtonProps={{ 'aria-label': 'Fechar menu' }}
        position="right"
        size="22.5rem"
        padding="md"
        title={<Brand compact />}
        zIndex={200}
      >
        <Stack component="nav" aria-label="Navegação móvel" gap="lg" mt="md">
          <Stack gap={5}>
            <div className="mobile-nav-section-label">Principal</div>
            {primaryNavItems.map((item) => (
              <MobileNavLink
                key={item.to}
                item={item}
                active={itemIsActive(location.pathname, item)}
                onClick={closeDrawer}
              />
            ))}
          </Stack>

          <Stack gap={5}>
            <div className="mobile-nav-section-label">Ferramentas</div>
            {toolNavItems.map((item) => (
              <MobileNavLink
                key={item.to}
                item={item}
                active={itemIsActive(location.pathname, item)}
                onClick={closeDrawer}
              />
            ))}
          </Stack>

          <Stack gap={5}>
            <div className="mobile-nav-section-label">Ajuda e transparência</div>
            {supportNavItems.map((item) => (
              <MobileNavLink
                key={item.to}
                item={item}
                active={itemIsActive(location.pathname, item)}
                onClick={closeDrawer}
              />
            ))}
          </Stack>
        </Stack>

        <Divider my="xl" />
        <Text size="xs" c="dimmed" lh={1.55} px="sm">
          Simulações educativas baseadas nas premissas informadas. Não constituem recomendação
          financeira.
        </Text>
      </Drawer>

      <Box
        component="main"
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        style={{ flex: 1 }}
      >
        {children}
      </Box>

      <Box component="footer" className="site-footer" py="lg">
        <Container size="xl">
          <Group justify="space-between" align="center" gap="md" wrap="wrap">
            <Group gap="sm" wrap="nowrap">
              <Box className="farol-brand__mark" style={{ width: 30, height: 30 }} aria-hidden="true">
                <IconBuildingLighthouse size={16} stroke={1.8} />
              </Box>
              <Box>
                <Text size="sm" fw={650}>
                  Farol © {new Date().getFullYear()}
                </Text>
                <Text size="xs" c="dimmed">
                  Projeções para decisões mais conscientes
                </Text>
              </Box>
            </Group>

            <Group gap="lg">
              <UnstyledButton component={Link} to="/docs/quickstart" className="site-footer__link">
                Documentação
              </UnstyledButton>
              <UnstyledButton component={Link} to="/sobre" className="site-footer__link">
                Sobre
              </UnstyledButton>
            </Group>

            <Text size="xs" c="dimmed" maw={330} lh={1.45}>
              Ferramenta educativa. Resultados dependem das premissas e não são recomendação
              financeira.
            </Text>
          </Group>
        </Container>
      </Box>
    </Box>
  );
}
