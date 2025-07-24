import type { StrategyTokenWeight, UIStrategy, TokenCoefficient, WeightCalculationOptions } from '../types';

// Types for simulation data
export interface SimulationStrategy {
  id: string | number;
  tokenWeights: {
    token: string;
    weight: number;
    depositAmount?: string; // In wei
  }[];
  validatorBalanceWeight?: number;
}

export interface SimulationTokenConfig {
  token: string;
  sharedRiskLevel: number; // Beta value (0-10000, where 10000 = 100%)
  totalObligatedBalance: string; // Total balance across all strategies in wei
}

export interface SimulationConfig {
  strategies: SimulationStrategy[];
  tokenConfigs: SimulationTokenConfig[];
}

// Results interface for simulation weights
export interface SimulationWeightResult {
  id: string | number;
  tokenWeights: {
    token: string;
    weight: number;
  }[];
  validatorBalanceWeight?: number;
}

// Note: calculateSimulationParticipantWeights function has been removed
// as we now use the mocked SDK approach in sdk.ts for better consistency 