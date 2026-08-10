import { Box, Container, Group, Text, Title, UnstyledButton } from '@mantine/core';
import { IconBook2, IconCalculator, IconRocket, IconVocabulary } from '@tabler/icons-react';
import { Link, Outlet, useLocation } from 'react-router-dom';

function activeDocument(pathname: string) {
  if (pathname.includes('/calculos')) return 'calculos';
  if (pathname.includes('/glossario')) return 'glossario';
  return 'quickstart';
}

export function DocsLayout() {
  const location = useLocation();

  return (
    <Container size="lg" className="docs-shell">
      <Box className="docs-header">
        <Box className="section-heading">
          <Group gap="xs" mb="xs" wrap="nowrap">
            <IconBook2
              size={19}
              color="var(--mantine-color-ocean-6)"
              aria-hidden="true"
            />
            <Text className="eyebrow">Central de ajuda</Text>
          </Group>
          <Title order={1} className="page-hero__title" mb="sm">
            Documentação
          </Title>
          <Text className="page-hero__description">
            Aprenda a configurar uma simulação, confira a metodologia e consulte os termos usados
            nos resultados.
          </Text>
        </Box>
      </Box>

      <Box component="nav" className="docs-tabs" aria-label="Seções da documentação">
        <Group className="docs-nav-list" gap={4} wrap="nowrap">
          <UnstyledButton
            component={Link}
            to="/docs/quickstart"
            className="docs-nav-link"
            aria-current={activeDocument(location.pathname) === 'quickstart' ? 'page' : undefined}
          >
            <IconRocket size={17} aria-hidden="true" />
            Guia rápido
          </UnstyledButton>
          <UnstyledButton
            component={Link}
            to="/docs/calculos"
            className="docs-nav-link"
            aria-current={activeDocument(location.pathname) === 'calculos' ? 'page' : undefined}
          >
            <IconCalculator size={17} aria-hidden="true" />
            Cálculos
          </UnstyledButton>
          <UnstyledButton
            component={Link}
            to="/docs/glossario"
            className="docs-nav-link"
            aria-current={activeDocument(location.pathname) === 'glossario' ? 'page' : undefined}
          >
            <IconVocabulary size={17} aria-hidden="true" />
            Glossário
          </UnstyledButton>
        </Group>
      </Box>

      <Box mt="lg">
        <Outlet />
      </Box>
    </Container>
  );
}

export default DocsLayout;
