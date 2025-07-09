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

/**
 * Helper function to calculate the sum of all token coefficients
 */
const calculateCoefficientsSum = (coefficients: TokenCoefficient[]): number => {
  return coefficients.reduce((sum, coeff) => sum + coeff.coefficient, 0);
};

/**
 * Helper function to calculate weighted totals for arithmetic mean
 * This combines token amounts weighted by coefficients + delegated balance weighted by validator coefficient
 */
const calculateWeightTotals = (
  strategy: StrategyTokenWeight,
  coefficients: TokenCoefficient[],
  validatorCoefficient: number
): number => {
  // Calculate token portion
  const tokenTotal = coefficients.reduce((sum, coeff) => {
    const tokenData = strategy.tokens[coeff.token];
    if (tokenData && tokenData.amount && parseFloat(tokenData.amount) > 0) {
      return sum + (parseFloat(tokenData.amount) * coeff.coefficient);
    }
    return sum;
  }, 0);
  
  // Calculate delegated balance portion
  const delegatedTotal = (strategy.validatorBalanceWeight || 0) * validatorCoefficient;
  
  return tokenTotal + delegatedTotal;
};

/**
 * Helper function to calculate weighted ratio sum for harmonic mean
 * This is sum of (coefficient / amount) for tokens + (validatorCoeff / delegatedBalance)
 */
const calculateWeightedRatioSum = (
  strategy: StrategyTokenWeight,
  coefficients: TokenCoefficient[],
  validatorCoefficient: number
): number => {
  // Calculate token ratios
  const tokenRatioSum = coefficients.reduce((sum, coeff) => {
    const tokenData = strategy.tokens[coeff.token];
    if (tokenData && tokenData.amount && parseFloat(tokenData.amount) > 0) {
      return sum + (coeff.coefficient / parseFloat(tokenData.amount));
    }
    return sum;
  }, 0);
  
  // Calculate delegated balance ratio
  const delegatedRatio = (strategy.validatorBalanceWeight || 0) > 0 
    ? validatorCoefficient / (strategy.validatorBalanceWeight || 1)
    : 0;
  
  return tokenRatioSum + delegatedRatio;
};

/**
 * Helper function to calculate weighted products for geometric mean using logarithms for numerical stability
 * This calculates log(product) = sum(coefficient * log(amount)) + validatorCoeff * log(delegatedBalance)
 */
const calculateWeightedLogSum = (
  strategy: StrategyTokenWeight,
  coefficients: TokenCoefficient[],
  validatorCoefficient: number
): number => {
  let logSum = 0;
  let hasValidTokens = false;
  
  // Calculate token contribution using logarithms
  for (const coeff of coefficients) {
    const tokenData = strategy.tokens[coeff.token];
    
    if (tokenData && tokenData.amount && parseFloat(tokenData.amount) > 0) {
      const amount = parseFloat(tokenData.amount);
      const logContribution = coeff.coefficient * Math.log(amount);
      logSum += logContribution;
      hasValidTokens = true;
    } else {
      // If coefficient > 0 but token is missing/0, the entire product should be 0
      if (coeff.coefficient > 0) {
        return -Infinity; // log(0) = -Infinity, which will give us 0 when we exp() it
      }
      // If coefficient is 0, token doesn't contribute (log(amount^0) = log(1) = 0)
    }
  }
  
  // Calculate delegated balance contribution using logarithms
  const delegatedBalance = strategy.validatorBalanceWeight || 0;
  
  if (validatorCoefficient > 0) {
    if (delegatedBalance > 0) {
      const delegatedLogContribution = validatorCoefficient * Math.log(delegatedBalance);
      logSum += delegatedLogContribution;
    } else {
      // No delegated balance but positive coefficient - result should be 0
      return -Infinity;
    }
  }
  // validatorCoefficient is 0, so delegatedBalance^0 = 1, log(1) = 0 (no contribution)
  
  return logSum;
};

/**
 * Helper function to calculate weighted products for geometric mean
 * This is product of (amount^coefficient) for tokens * (delegatedBalance^validatorCoeff)
 */
const calculateWeightedProducts = (
  strategy: StrategyTokenWeight,
  coefficients: TokenCoefficient[],
  validatorCoefficient: number
): number => {
  // Use logarithmic calculation for numerical stability
  const logSum = calculateWeightedLogSum(strategy, coefficients, validatorCoefficient);
  
  if (logSum === -Infinity) {
    return 0;
  }
  
  // Convert back from log space, but check for overflow
  const result = Math.exp(logSum);
  
  // Handle potential overflow/underflow
  if (!isFinite(result)) {
    return logSum > 0 ? Number.MAX_SAFE_INTEGER : Number.MIN_VALUE;
  }
  
  return result;
};

/**
 * Calculate strategy weights using arithmetic weighted average
 */
export const calcArithmeticStrategyWeights = (
  strategyTokenWeights: StrategyTokenWeight[],
  { coefficients, validatorCoefficient = 0 }: WeightCalculationOptions,
): Map<string, number> => {
  const strategyWeights = strategyTokenWeights.reduce((weightMap, strategy) => {
    const totalCoefficient = calculateCoefficientsSum(coefficients) + validatorCoefficient;
    const totalWeight = calculateWeightTotals(strategy, coefficients, validatorCoefficient);
    const finalWeight = totalCoefficient > 0 ? totalWeight / totalCoefficient : 0;
    return weightMap.set(strategy.strategy.toString(), finalWeight);
  }, new Map<string, number>());

  return strategyWeights;
};

/**
 * Calculate strategy weights using harmonic weighted average
 */
export const calcHarmonicStrategyWeights = (
  strategyTokenWeights: StrategyTokenWeight[],
  { coefficients, validatorCoefficient = 0 }: WeightCalculationOptions,
): Map<string, number> => {
  // the numerator of weighted harmonic is the sum of all weights (coefficients)
  const coeffSum = calculateCoefficientsSum(coefficients) + validatorCoefficient;

  const unnormalizedWeights = strategyTokenWeights.reduce((weightMap, strategy) => {
    // the denominator of weighted harmonic is the sum of all ratios between the value and its related weight (coefficient)
    const denom = calculateWeightedRatioSum(strategy, coefficients, validatorCoefficient);
    // if the denominator is 0, we should not calculate division, the entire weight is zero
    const finalWeight = denom != 0 ? coeffSum / denom : 0;
    return weightMap.set(strategy.strategy.toString(), finalWeight);
  }, new Map<string, number>());

  // Calculate sum for normalization
  const weightSum = Array.from(unnormalizedWeights.values()).reduce(
    (sum, weight) => sum + weight,
    0,
  );

  // Normalize weights to sum to 1
  const normalizedWeights = new Map<string, number>();
  for (const [id, weight] of unnormalizedWeights.entries()) {
    const normalizedWeight = weightSum > 0 ? weight / weightSum : 0;
    normalizedWeights.set(id, normalizedWeight);
  }

  return normalizedWeights;
};

/**
 * Calculate strategy weights using geometric weighted average
 */
export const calcGeometricStrategyWeights = (
  strategyTokenWeights: StrategyTokenWeight[],
  { coefficients, validatorCoefficient = 0 }: WeightCalculationOptions,
): Map<string, number> => {
  const totalCoefficient = calculateCoefficientsSum(coefficients) + validatorCoefficient;
  
  // Use logarithmic calculations throughout for numerical stability
  const logWeights: Array<{ id: string; logWeight: number }> = [];
  
  for (const strategy of strategyTokenWeights) {
    
    // Get the log sum directly for numerical stability
    const logSum = calculateWeightedLogSum(strategy, coefficients, validatorCoefficient);
    
    // Calculate log of nth root: log(x^(1/n)) = log(x)/n
    const logWeight = totalCoefficient > 0 && logSum !== -Infinity 
      ? logSum / totalCoefficient 
      : -Infinity;
      
    logWeights.push({
      id: strategy.strategy.toString(),
      logWeight
    });
  }

  // Convert back to regular weights and calculate normalization in log space
  const validLogWeights = logWeights.filter(w => w.logWeight !== -Infinity);
  
  if (validLogWeights.length === 0) {
    const result = new Map<string, number>();
    for (const { id } of logWeights) {
      result.set(id, 0);
    }
    return result;
  }
  
  // For numerical stability, subtract the maximum log weight before exponentiating
  const maxLogWeight = Math.max(...validLogWeights.map(w => w.logWeight));
  
  const adjustedWeights = logWeights.map(({ id, logWeight }) => ({
    id,
    weight: logWeight === -Infinity ? 0 : Math.exp(logWeight - maxLogWeight)
  }));
  
  // Calculate sum for normalization
  const weightSum = adjustedWeights.reduce((sum, { weight }) => sum + weight, 0);

  // Normalize weights to sum to 1
  const normalizedWeights = new Map<string, number>();
  for (const { id, weight } of adjustedWeights) {
    const normalizedWeight = weightSum > 0 ? weight / weightSum : 0;
    normalizedWeights.set(id, normalizedWeight);
  }

  return normalizedWeights;
};

/**
 * Calculate strategy weights for simulation using the same algorithms as the SDK
 * Now matches the SDK interface exactly
 */
export const calculateSimulationWeights = (
  strategyTokenWeights: StrategyTokenWeight[],
  options: WeightCalculationOptions,
  calculationType: 'arithmetic' | 'geometric' | 'harmonic'
): Map<string, number> => {
  
  if (!strategyTokenWeights?.length) {
    return new Map();
  }

  let result: Map<string, number>;
  
  switch (calculationType) {
    case 'geometric':
      result = calcGeometricStrategyWeights(strategyTokenWeights, options);
      break;
    case 'harmonic':
      result = calcHarmonicStrategyWeights(strategyTokenWeights, options);
      break;
    case 'arithmetic':
    default:
      result = calcArithmeticStrategyWeights(strategyTokenWeights, options);
      break;
  }
  
  return result;
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

/**
 * Convert UI strategies to StrategyTokenWeight format for the calculation functions
 * This includes both token data and delegated balance data
 */
export const convertUIStrategiesToStrategyTokenWeight = (
  uiStrategies: UIStrategy[],
  delegatedBalances?: any
): StrategyTokenWeight[] => {
  return uiStrategies.map(strategy => {
    const strategyId = Number(strategy.id || strategy.strategy || 0);
    
    // Build tokens object from tokenWeights
    const tokens: { [key: string]: { amount: string; obligatedPercentage: number } } = {};
    strategy.tokenWeights.forEach(tw => {
      if (tw.token && tw.depositAmount) {
        // Convert from wei to ether for the calculation
        const amountInEther = tw.depositAmount ? 
          parseFloat(tw.depositAmount) / Math.pow(10, 18) : 0;
        
        tokens[tw.token] = {
          amount: amountInEther.toString(),
          obligatedPercentage: tw.weight || 0
        };
      }
    });
    
    // Get delegated balance for this strategy
    let validatorBalanceWeight = strategy.validatorBalanceWeight || 0;
    
    // If we have delegated balances data, use it
    if (delegatedBalances?.bAppTotalDelegatedBalances) {
      const delegatedBalance = delegatedBalances.bAppTotalDelegatedBalances.find(
        (balance: any) => balance.strategyId === strategyId.toString()
      );
      
      if (delegatedBalance?.delegation) {
        // Convert from wei to ether
        validatorBalanceWeight = parseFloat(delegatedBalance.delegation) / Math.pow(10, 18);
      }
    }
    
    return {
      strategy: strategyId,
      tokens,
      validatorBalanceWeight
    };
  });
}; 