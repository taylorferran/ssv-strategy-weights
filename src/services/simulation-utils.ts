import type { StrategyTokenWeight, UIStrategy, TokenCoefficient, WeightCalculationOptions } from '../types';
import { getParticipantWeights } from './sdk';

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
 * Calculate strategy weights using arithmetic weighted average
 */
export const calcArithmeticStrategyWeights = (
  strategyTokenWeights: StrategyTokenWeight[],
  { coefficients, validatorCoefficient = 0 }: WeightCalculationOptions,
): Map<string, number> => {
  // First calculate unnormalized weights
  const unnormalizedWeights = strategyTokenWeights.reduce((weightMap, strategy) => {
    const totalCoefficient = calculateCoefficientsSum(coefficients) + validatorCoefficient;
    const totalWeight = calculateWeightTotals(strategy, coefficients, validatorCoefficient);
    const normalizedWeight = totalWeight / totalCoefficient;
    return weightMap.set(strategy.strategy.toString(), normalizedWeight);
  }, new Map<string, number>());

  // Calculate sum for normalization
  const weightSum = Array.from(unnormalizedWeights.values()).reduce(
    (sum, weight) => sum + weight,
    0,
  );

  // Normalize weights to sum to 1 (same as harmonic and geometric implementations)
  const normalizedWeights = new Map<string, number>();
  for (const [id, weight] of unnormalizedWeights.entries()) {
    normalizedWeights.set(id, weight / weightSum);
  }

  return normalizedWeights;
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
    normalizedWeights.set(id, weight / weightSum);
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
  // First calculate unnormalized weights
  const unnormalizedWeights = strategyTokenWeights.reduce((weightMap, strategy) => {
    const totalCoefficient = calculateCoefficientsSum(coefficients) + validatorCoefficient;
    const logSum = calculateWeightedLogSum(strategy, coefficients, validatorCoefficient);
    // if one of the nominators is 0, we should not calculate exponential, the entire weight is zero
    const finalWeight = logSum != 0 ? Math.exp(logSum / totalCoefficient) : 0;
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
    normalizedWeights.set(id, weight / weightSum);
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
 * Creates the same hybrid format as the calculator tab (with both tokenWeights array AND tokens object)
 */
export const convertUIStrategiesToStrategyTokenWeight = (
  uiStrategies: UIStrategy[],
  delegatedBalances?: any
): StrategyTokenWeight[] => {
  return uiStrategies.map(strategy => {
    const strategyId = Number(strategy.id || strategy.strategy || 0);
    
    // Build tokens object from tokenWeights
    const tokens: { [key: string]: { amount: string; obligatedPercentage: number } } = {};
    const tokenWeights: any[] = [];
    
    strategy.tokenWeights.forEach(tw => {
      if (tw.token && tw.depositAmount) {
        // Convert from wei to ether for the calculation
        const amountInEther = tw.depositAmount ? 
          parseFloat(tw.depositAmount) / Math.pow(10, 18) : 0;
        
        // Only add tokens with positive amounts to avoid geometric calculation issues
        if (amountInEther > 0) {
          // Add to tokens object
          tokens[tw.token] = {
            amount: amountInEther.toString(),
            obligatedPercentage: tw.weight || 0
          };
          
          // Add to tokenWeights array (for SDK compatibility)
          tokenWeights.push({
            id: `${strategyId}-${tw.token}`,
            token: tw.token,
            tokenAmount: tw.depositAmount,
            strategy: strategyId,
            weight: tw.weight || 0
          });
        }
      }
    });
    
    // Always use the original validator balance weight from the strategy
    // Users can only edit token deposits, not validator delegated balances
    let validatorBalanceWeight = strategy.validatorBalanceWeight || 0;
    
    return {
      strategy: strategyId,
      tokens,
      validatorBalanceWeight,
      // Add hybrid fields for SDK compatibility (same as calculator tab)
      id: strategyId.toString(),
      tokenWeights
    } as any;
  });
}; 

/**
 * Calculate participant weights using the same logic as SDK's getParticipantWeights
 * but with simulation/editable data instead of API data
 */
export const calculateSimulationParticipantWeights = async (
  simulationStrategies: UIStrategy[],
  tokenCoefficients: TokenCoefficient[]
): Promise<any[]> => {
  // Get original API data to know which tokens should have weights
  // This ensures we only calculate weights for tokens that had non-zero weights originally
  const originalApiData = await getParticipantWeights(simulationStrategies[0]?.id ? 
    // Extract bAppId from the simulation context - this is a bit hacky but works
    "0x24d1f83f9028236841429aab770b0efcc13ebeb5" : "0x24d1f83f9028236841429aab770b0efcc13ebeb5"
  );

  // Create a map of which tokens should have weights for each strategy
  // Include both original API tokens AND tokens that are configured in tokenCoefficients (user-added tokens)
  const originalTokensWithWeights = new Map<string, Set<string>>();
  const allConfiguredTokens = new Set<string>(tokenCoefficients.map(tc => tc.token.toLowerCase()));
  
  originalApiData.forEach((strategy: any) => {
    const strategyId = strategy.id;
    const tokensWithWeights = new Set<string>();
    
    // Add original API tokens that had weights
    if (strategy.tokenWeights) {
      strategy.tokenWeights.forEach((tw: any) => {
        if (tw.weight && tw.weight > 0) {
          tokensWithWeights.add(tw.token.toLowerCase());
        }
      });
    }
    
    // Also add all configured tokens (including user-added ones) to this strategy
    allConfiguredTokens.forEach(token => {
      tokensWithWeights.add(token);
    });
    
    originalTokensWithWeights.set(strategyId, tokensWithWeights);
  });

  // Initialize strategy weights map
  const strategyWeightsMap = new Map<string, any>();
  const riskByTokenAndStrategy = new Map<string, Map<string, number>>();

  // First pass: Initialize strategy weights and calculate risks
  for (const strategy of simulationStrategies) {
    const strategyId = (strategy.id || strategy.strategy)?.toString();
    if (!strategyId) continue;

    // Initialize strategy weight object
    strategyWeightsMap.set(strategyId, {
      id: strategyId,
      tokenWeights: [],
    });

    // Calculate risks for each token in this strategy
    const tokenRisks = new Map<string, number>();
    const allowedTokens = originalTokensWithWeights.get(strategyId) || new Set();
    
    if (strategy.tokenWeights && strategy.tokenWeights.length > 0) {
      for (const tokenWeight of strategy.tokenWeights) {
        if (!tokenWeight.token || !tokenWeight.depositAmount) continue;
        
        const token = tokenWeight.token.toLowerCase();
        const depositAmount = parseFloat(tokenWeight.depositAmount);
        
        // Only process tokens that had non-zero weights in the original API
        if (depositAmount > 0 && allowedTokens.has(token)) {
          // Use weight as risk percentage (can be modified later)
          const risk = (tokenWeight.weight || 0) / 10000; // Convert from basis points
          const currentRisk = tokenRisks.get(token) ?? 0;
          tokenRisks.set(token, currentRisk + risk);
        }
      }
    }

    // Store risks for each token and strategy
    for (const [token, risk] of tokenRisks) {
      if (!riskByTokenAndStrategy.has(token)) {
        riskByTokenAndStrategy.set(token, new Map());
      }
      riskByTokenAndStrategy.get(token)!.set(strategyId, risk);
    }
  }

  // Process only tokens that had weights in the original API
  const tokenAddresses = Array.from(new Set(
    simulationStrategies.flatMap(s => {
      const strategyId = (s.id || s.strategy)?.toString();
      if (!strategyId) return [];
      
      const allowedTokens = originalTokensWithWeights.get(strategyId) || new Set();
      return s.tokenWeights?.map(tw => tw.token.toLowerCase()).filter(token => allowedTokens.has(token)) || [];
    })
  ));

  for (const tokenAddress of tokenAddresses) {
    // Calculate total obligated balance for this token across all strategies
    let totalObligatedBalance = 0n;
    for (const strategy of simulationStrategies) {
      const strategyId = (strategy.id || strategy.strategy)?.toString();
      if (!strategyId) continue;
      
      const allowedTokens = originalTokensWithWeights.get(strategyId) || new Set();
      
      if (allowedTokens.has(tokenAddress)) {
        const tokenWeight = strategy.tokenWeights?.find(tw => 
          tw.token.toLowerCase() === tokenAddress
        );
        if (tokenWeight?.depositAmount) {
          totalObligatedBalance += BigInt(tokenWeight.depositAmount);
        }
      }
    }

    if (totalObligatedBalance === 0n) {
      continue;
    }

    // Use default beta value (can be made configurable later)
    const beta = 0.05; // 5% default shared risk level

    // Calculate normalization constant c_token
    let normalizationDenominator = 0;
    const tempWeights: { strategyId: string; weight: number }[] = [];

    // Calculate the denominator sum for c_token
    for (const strategy of simulationStrategies) {
      const strategyId = (strategy.id || strategy.strategy)?.toString();
      if (!strategyId) continue;

      const allowedTokens = originalTokensWithWeights.get(strategyId) || new Set();
      if (!allowedTokens.has(tokenAddress)) continue;

      const tokenWeight = strategy.tokenWeights?.find(tw => 
        tw.token.toLowerCase() === tokenAddress
      );
      
      if (!tokenWeight?.depositAmount) continue;

      const obligatedBalance = BigInt(tokenWeight.depositAmount);
      if (obligatedBalance === 0n) continue;

      const risk = Math.max(1, riskByTokenAndStrategy.get(tokenAddress)?.get(strategyId) ?? 0);

      const exponentialTerm = Math.exp(-beta * risk);
      const term = (Number(obligatedBalance) / Number(totalObligatedBalance)) * exponentialTerm;
      normalizationDenominator += term;

      tempWeights.push({
        strategyId,
        weight: term,
      });
    }

    // Calculate c_token as the inverse of the sum
    const cToken = normalizationDenominator === 0 ? 0 : 1 / normalizationDenominator;

    // Calculate final weights using c_token
    for (const { strategyId, weight } of tempWeights) {
      const strategyWeight = strategyWeightsMap.get(strategyId);
      if (strategyWeight) {
        const finalWeight = weight * cToken;
        strategyWeight.tokenWeights.push({
          token: tokenAddress,
          weight: finalWeight,
        });
      }
    }
  }

  // Handle validator balances - preserve original values since users can only edit token deposits
  for (const strategy of simulationStrategies) {
    const strategyId = (strategy.id || strategy.strategy)?.toString();
    if (!strategyId) continue;

    const strategyWeight = strategyWeightsMap.get(strategyId);
    if (strategyWeight && strategy.validatorBalanceWeight !== undefined) {
      // Preserve the original validator balance weight from the strategy
      strategyWeight.validatorBalanceWeight = strategy.validatorBalanceWeight;
    }
  }

  const result = Array.from(strategyWeightsMap.values());
  
  // Add detailed logging similar to getParticipantWeights
  console.log("🔍 [SIMULATION] RAW calculateSimulationParticipantWeights result");
  console.log("🔍 [SIMULATION] Full response structure:", JSON.stringify(result, null, 2));
  
  return result;
}; 