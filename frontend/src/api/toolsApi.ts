import { api } from './client';
import type {
  EmergencyFundPlanInput,
  EmergencyFundPlanResult,
  FIREPlanInput,
  FIREPlanResult,
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

export async function planFire(input: FIREPlanInput) {
  const { data } = await api.post<FIREPlanResult>('/api/fire', input);
  return data;
}

export async function compareVehicleOptions(input: VehicleComparisonInput) {
  const { data } = await api.post<VehicleComparisonResult>('/api/vehicle-compare', input);
  return data;
}
