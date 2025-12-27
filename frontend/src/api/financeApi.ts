import { api } from './client';
import { 
  ComparisonInput, 
  ComparisonResult, 
  EnhancedComparisonResult,
  BatchComparisonInput,
  BatchComparisonResult,
  SensitivityAnalysisInput,
  SensitivityAnalysisResult,
} from './types';

export async function compareScenarios(input: ComparisonInput, enhanced = false) {
  const endpoint = enhanced ? '/api/compare-scenarios-enhanced' : '/api/compare-scenarios';
  const { data } = await api.post<ComparisonResult | EnhancedComparisonResult>(endpoint, input);
  return data;
}

export async function compareScenariosBatch(input: BatchComparisonInput): Promise<BatchComparisonResult> {
  const { data } = await api.post<BatchComparisonResult>('/api/compare-scenarios-batch', input);
  return data;
}

export async function runSensitivityAnalysis(input: SensitivityAnalysisInput): Promise<SensitivityAnalysisResult> {
  const { data } = await api.post<SensitivityAnalysisResult>('/api/sensitivity-analysis', input);
  return data;
}
