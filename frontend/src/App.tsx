import { Routes, Route } from 'react-router-dom';
import Home from './routes/Home';
import LoanSimulation from './routes/LoanSimulation';
import ScenarioComparison from './routes/ScenarioComparison';
import About from './routes/About';
import DocsLayout from './routes/docs/DocsLayout';
import QuickstartPage from './routes/docs/QuickstartPage';
import CalculationDocsPage from './routes/docs/CalculationDocsPage';
import GlossaryPage from './routes/docs/GlossaryPage';
import Layout from './components/Layout';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/simulacao" element={<LoanSimulation />} />
        <Route path="/comparacao" element={<ScenarioComparison />} />
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
