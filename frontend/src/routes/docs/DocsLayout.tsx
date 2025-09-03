import { AppShell, Tabs, Container } from '@mantine/core';
import { Outlet, useLocation, Link } from 'react-router-dom';

export function DocsLayout() {
  const location = useLocation();
  const current = location.pathname;
  const value = current.includes('quickstart') ? 'quickstart' : current.includes('calculos') ? 'calculos' : current.includes('glossario') ? 'glossario' : 'quickstart';
  return (
    <AppShell padding="md">
      <AppShell.Main>
        <Container size="lg">
          <Tabs value={value} variant="outline" radius="md" keepMounted={false}>
            <Tabs.List>
              <Tabs.Tab value="quickstart"><Link to="/docs/quickstart" style={{ textDecoration:'none' }}>Quickstart</Link></Tabs.Tab>
              <Tabs.Tab value="calculos"><Link to="/docs/calculos" style={{ textDecoration:'none' }}>Cálculos</Link></Tabs.Tab>
              <Tabs.Tab value="glossario"><Link to="/docs/glossario" style={{ textDecoration:'none' }}>Glossário</Link></Tabs.Tab>
            </Tabs.List>
          </Tabs>
          <div style={{ marginTop: 20 }}>
            <Outlet />
          </div>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}

export default DocsLayout;
