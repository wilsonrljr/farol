import { api } from './client';
import type {
  EmergencyFundPlanInput,
  EmergencyFundPlanResult,
  StressTestInput,
  StressTestResult,
  VehicleComparisonInput,
  VehicleComparisonResult,
} from './types';

export async function runStressTest(input: StressTestInput) {
  const { data } = await api.post<StressTestResult>('/api/stress-test', input);
  return data;
}

export async function planEmergencyFund(input: EmergencyFundPlanInput) {
  const { data } = await api.post<EmergencyFundPlanResult>('/api/emergency-fund', input);
  return data;
}

export async function compareVehicleOptions(input: VehicleComparisonInput) {
  const { data } = await api.post<VehicleComparisonResult>('/api/vehicle-compare', input);
  return data;
}
