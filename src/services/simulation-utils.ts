import type { StrategyTokenWeight, UIStrategy } from '../types';

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

/**
 * Calculate strategy weights for simulation using the exact same logic as the SDK's getParticipantWeights
 * but with user-provided data instead of on-chain data
 */
export const calculateSimulationWeights = (config: SimulationConfig): SimulationWeightResult[] => {
  const { strategies, tokenConfigs } = config;
  
  const strategyWeightsMap = new Map<string | number, SimulationWeightResult>();
  const riskByTokenAndStrategy = new Map<string, Map<string | number, number>>();
  
  // Initialize strategy weights map (exact replica of SDK logic)
  for (const strategy of strategies) {
    strategyWeightsMap.set(strategy.id, {
      id: strategy.id,
      tokenWeights: []
    });
    
    const tokenRisks = new Map<string, number>();
    
    // Calculate token risks for this strategy (replicated from SDK)
    for (const tokenWeight of strategy.tokenWeights) {
      const token = tokenWeight.token.toLowerCase();
      const currentRisk = tokenRisks.get(token) ?? 0;
      // Use weight as percentage (converting to same format as SDK: percentage / 10000)
      tokenRisks.set(token, currentRisk + Number(tokenWeight.weight) / 10000);
    }
    
    // Store risks by token and strategy (exact replica)
    for (const [token, risk] of tokenRisks) {
      if (!riskByTokenAndStrategy.has(token)) {
        riskByTokenAndStrategy.set(token, new Map());
      }
      riskByTokenAndStrategy.get(token)!.set(strategy.id, risk);
    }
  }
  
  // Calculate weights for each token (exact replica of SDK logic)
  for (const tokenConfig of tokenConfigs) {
    const token = tokenConfig.token;
    const tokenLower = token.toLowerCase();
    const beta = Number(tokenConfig.sharedRiskLevel) / 10000; // Convert to decimal (exact replica)
    const totalObligatedBalance = BigInt(tokenConfig.totalObligatedBalance);
    
    if (totalObligatedBalance === 0n) continue;
    
    let normalizationDenominator = 0;
    const tempWeights: { strategyId: string | number; weight: number }[] = [];
    
    for (const strategy of strategies) {
      const strategyId = strategy.id;
      
      // Find the token weight for this strategy (replicated logic)
      const tokenWeight = strategy.tokenWeights.find(
        (tw) => tw.token.toLowerCase() === tokenLower
      );
      
      if (!tokenWeight) continue;
      
      // Use depositAmount as obligatedBalance (replicated logic)
      if (!tokenWeight.depositAmount) continue;
      
      const obligatedBalance = BigInt(tokenWeight.depositAmount);
      const risk = Math.max(1, riskByTokenAndStrategy.get(tokenLower)?.get(strategyId) ?? 0);
      
      // Calculate exponential term and weight (exact replica)
      const exponentialTerm = Math.exp(-beta * risk);
      const term = Number(obligatedBalance) / Number(totalObligatedBalance) * exponentialTerm;
      
      normalizationDenominator += term;
      tempWeights.push({
        strategyId,
        weight: term
      });
    }
    
    // Normalize weights (exact replica)
    const cToken = normalizationDenominator === 0 ? 0 : 1 / normalizationDenominator;
    
    for (const { strategyId, weight } of tempWeights) {
      const strategyWeight = strategyWeightsMap.get(strategyId);
      if (strategyWeight) {
        strategyWeight.tokenWeights.push({
          token,
          weight: weight * cToken
        });
      }
    }
  }
  
  // Calculate validator balance weights (exact replica of SDK logic)
  const validatorBalances = new Map<string | number, number>();
  let totalBAppBalance = 0;
  
  // In simulation, we use the user-provided validatorBalanceWeight values
  // as the "delegated balance" equivalent
  for (const strategy of strategies) {
    const validatorBalance = strategy.validatorBalanceWeight || 0;
    validatorBalances.set(strategy.id, validatorBalance);
    totalBAppBalance += validatorBalance;
  }
  
  // Set validator balance weights (exact replica)
  for (const [strategyId, validatorBalance] of validatorBalances.entries()) {
    const strategyWeight = strategyWeightsMap.get(strategyId);
    if (strategyWeight && totalBAppBalance > 0) {
      strategyWeight.validatorBalanceWeight = Number(validatorBalance) / Number(totalBAppBalance);
    }
  }
  
  return Array.from(strategyWeightsMap.values());
};

/**
 * Auto-generate token configs from strategies with default values
 * Ensures all tokens from all strategies are included in the calculation
 */
export const generateTokenConfigsFromStrategies = (strategies: SimulationStrategy[]): SimulationTokenConfig[] => {
  const tokenMap = new Map<string, { totalBalance: bigint; count: number }>();
  
  // Collect all unique tokens and their total balances
  for (const strategy of strategies) {
    for (const tokenWeight of strategy.tokenWeights) {
      const token = tokenWeight.token.toLowerCase();
      const depositAmount = tokenWeight.depositAmount ? BigInt(tokenWeight.depositAmount) : 0n;
      
      if (tokenMap.has(token)) {
        const existing = tokenMap.get(token)!;
        existing.totalBalance += depositAmount;
        existing.count += 1;
      } else {
        tokenMap.set(token, { totalBalance: depositAmount, count: 1 });
      }
    }
  }
  
  // Generate configs with default risk levels for all tokens
  return Array.from(tokenMap.entries()).map(([token, data]) => ({
    token,
    sharedRiskLevel: 500, // Default 5% risk level (can be made configurable later)
    totalObligatedBalance: data.totalBalance.toString()
  }));
};

/**
 * Convert UI strategies to simulation format
 */
export const convertUIStrategiesToSimulation = (uiStrategies: UIStrategy[]): SimulationStrategy[] => {
  return uiStrategies.map(strategy => ({
    id: strategy.id || strategy.strategy || 0, // Ensure id is never undefined
    tokenWeights: strategy.tokenWeights.map((tw: any) => ({
      token: tw.token,
      weight: tw.weight || 0,
      depositAmount: tw.depositAmount || "0"
    })),
    validatorBalanceWeight: strategy.validatorBalanceWeight || 0
  }));
}; 