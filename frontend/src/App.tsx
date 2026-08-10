import { lazy, Suspense } from 'react';
import { Center, Loader, VisuallyHidden } from '@mantine/core';
import { Navigate, Route, Routes } from 'react-router-dom';
import Home from './routes/Home';
import Layout from './components/Layout';

const ScenarioComparison = lazy(() => import('./routes/ScenarioComparison'));
const About = lazy(() => import('./routes/About'));
const DocsLayout = lazy(() => import('./routes/docs/DocsLayout'));
const QuickstartPage = lazy(() => import('./routes/docs/QuickstartPage'));
const CalculationDocsPage = lazy(() => import('./routes/docs/CalculationDocsPage'));
const GlossaryPage = lazy(() => import('./routes/docs/GlossaryPage'));
const StressTest = lazy(() => import('./routes/StressTest'));
const EmergencyFund = lazy(() => import('./routes/EmergencyFund'));
const Fire = lazy(() => import('./routes/Fire'));
const Vehicles = lazy(() => import('./routes/Vehicles'));

function PageFallback() {
  return (
    <Center mih={320} role="status" aria-live="polite">
      <Loader color="ocean" aria-hidden="true" />
      <VisuallyHidden>Carregando página</VisuallyHidden>
    </Center>
  );
}

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/comparacao" element={<ScenarioComparison />} />
          <Route path="/estresse" element={<StressTest />} />
          <Route path="/reserva" element={<EmergencyFund />} />
          <Route path="/fire" element={<Fire />} />
          <Route path="/veiculos" element={<Vehicles />} />
          <Route path="/sobre" element={<About />} />
          <Route path="/docs" element={<DocsLayout />}>
            <Route index element={<Navigate to="quickstart" replace />} />
            <Route path="quickstart" element={<QuickstartPage />} />
            <Route path="calculos" element={<CalculationDocsPage />} />
            <Route path="glossario" element={<GlossaryPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
