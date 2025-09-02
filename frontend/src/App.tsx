import { Routes, Route } from 'react-router-dom';
import Home from './routes/Home';
import LoanSimulation from './routes/LoanSimulation';
import ScenarioComparison from './routes/ScenarioComparison';
import About from './routes/About';
import Layout from './components/Layout';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/simulacao" element={<LoanSimulation />} />
        <Route path="/comparacao" element={<ScenarioComparison />} />
        <Route path="/sobre" element={<About />} />
      </Routes>
    </Layout>
  );
}
