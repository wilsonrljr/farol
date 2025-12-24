import { Routes, Route } from 'react-router-dom';
import Home from './routes/Home';
import ScenarioComparison from './routes/ScenarioComparison';
import About from './routes/About';
import DocsLayout from './routes/docs/DocsLayout';
import QuickstartPage from './routes/docs/QuickstartPage';
import CalculationDocsPage from './routes/docs/CalculationDocsPage';
import GlossaryPage from './routes/docs/GlossaryPage';
import StressTest from './routes/StressTest';
import EmergencyFund from './routes/EmergencyFund';
import Vehicles from './routes/Vehicles';
import Layout from './components/Layout';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/comparacao" element={<ScenarioComparison />} />
        <Route path="/estresse" element={<StressTest />} />
        <Route path="/reserva" element={<EmergencyFund />} />
        <Route path="/veiculos" element={<Vehicles />} />
        <Route path="/sobre" element={<About />} />
        <Route path="/docs" element={<DocsLayout />}>
          <Route path="quickstart" element={<QuickstartPage />} />
          <Route path="calculos" element={<CalculationDocsPage />} />
          <Route path="glossario" element={<GlossaryPage />} />
        </Route>
      </Routes>
    </Layout>
  );
}
