import { Tabs, Container } from '@mantine/core';
import { Outlet, useLocation, Link } from 'react-router-dom';

export function DocsLayout() {
  const location = useLocation();
  const current = location.pathname;
  const value = current.includes('quickstart') ? 'quickstart' : current.includes('calculos') ? 'calculos' : current.includes('glossario') ? 'glossario' : 'quickstart';
  return (
    <Container size="lg">
      <Tabs value={value} variant="pills" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="quickstart" renderRoot={(props) => <Link {...props} to="/docs/quickstart" />}>Quickstart</Tabs.Tab>
          <Tabs.Tab value="calculos" renderRoot={(props) => <Link {...props} to="/docs/calculos" />}>Cálculos</Tabs.Tab>
          <Tabs.Tab value="glossario" renderRoot={(props) => <Link {...props} to="/docs/glossario" />}>Glossário</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      <div style={{ marginTop: 16 }}>
        <Outlet />
      </div>
    </Container>
  );
}

export default DocsLayout;
