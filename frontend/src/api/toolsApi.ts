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

export async function runStressTest(input: StressTestInput, signal?: AbortSignal) {
  const { data } = await api.post<StressTestResult>('/api/stress-test', input, { signal });
  return data;
}

export async function planEmergencyFund(input: EmergencyFundPlanInput, signal?: AbortSignal) {
  const { data } = await api.post<EmergencyFundPlanResult>('/api/emergency-fund', input, { signal });
  return data;
}

export async function planFire(input: FIREPlanInput, signal?: AbortSignal) {
  const { data } = await api.post<FIREPlanResult>('/api/fire', input, { signal });
  return data;
}

export async function compareVehicleOptions(input: VehicleComparisonInput, signal?: AbortSignal) {
  const { data } = await api.post<VehicleComparisonResult>('/api/vehicle-compare', input, { signal });
  return data;
}
