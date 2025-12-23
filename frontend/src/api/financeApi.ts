import { api } from './client';
import { ComparisonInput, ComparisonResult, EnhancedComparisonResult } from './types';

export async function compareScenarios(input: ComparisonInput, enhanced = false) {
  const endpoint = enhanced ? '/api/compare-scenarios-enhanced' : '/api/compare-scenarios';
  const { data } = await api.post<ComparisonResult | EnhancedComparisonResult>(endpoint, input);
  return data;
}
