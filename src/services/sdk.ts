import { BasedAppsSDK, chains } from "@ssv-labs/bapps-sdk";
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { BAppConfig, StrategyTokenWeight, WeightCalculationOptions } from '../types';

const hoodi = chains.hoodi;
const transport = http();

const publicClient = createPublicClient({
  chain: hoodi,
  transport,
});

// dummy private key as we're not sending any transactions
const account = privateKeyToAccount('0x038a19490182749393089be8459dd80843d6d3a84bf8270614252c1ad46f2d11');
const walletClient = createWalletClient({
  account,
  chain: hoodi,
  transport,
});

const sdk = new BasedAppsSDK({
  beaconchainUrl: "https://eth-beacon-chain-hoodi.drpc.org/rest/",
  publicClient,
  walletClient,
  _: {
      subgraphUrl: "https://api.studio.thegraph.com/query/71118/ssv-network-hoodi/version/latest",
    },
})

export const getParticipantWeights = async (bAppId: string): Promise<StrategyTokenWeight[]> => {
  try {
    const weights = await sdk.api.getParticipantWeights({ bAppId });
    console.log("WEIGHTS:::::", weights);
    return weights as unknown as StrategyTokenWeight[];
  } catch (error) {
    console.error("Error fetching participant weights:", error);
    return [];
  }
};

export const getDepositedBalancesForStrategy = async (strategyId: string) => {
  try {
    const deposits = await sdk.api.getDepositedBalancesForStrategy({ strategyId });
    return deposits;
  } catch (error) {
    console.error(`Error fetching deposited balances for strategy ${strategyId}:`, error);
    return null;
  }
};

export const calculateStrategyWeights = (
  strategyTokenWeights: StrategyTokenWeight[],
  options: WeightCalculationOptions,
  calculationType: 'arithmetic' | 'geometric' | 'harmonic'
): Map<string, number> => {
  try {
    // Enhanced debug logging
    console.log(`🔍 [SDK] calculateStrategyWeights called with:`, {
      calculationType,
      validatorCoefficient: options.validatorCoefficient,
      coefficientsCount: options.coefficients?.length || 0,
      strategyCount: strategyTokenWeights?.length || 0
    });
    
    // Log detailed strategy analysis
    strategyTokenWeights?.forEach((strategy, idx) => {
      const tokenCount = Object.keys(strategy.tokens || {}).length;
      const tokenWeights = Object.entries(strategy.tokens || {}).map(([token, data]) => ({
        token: token.slice(0, 10) + '...',
        amount: data.amount,
        obligatedPercentage: data.obligatedPercentage
      }));
      
      console.log(`🔍 [SDK] Strategy ${idx + 1} (ID: ${strategy.strategy}):`, {
        tokenCount,
        tokenWeights,
        hasValidatorBalance: strategy.validatorBalanceWeight !== undefined
      });
    });
    
    // Log coefficients
    console.log(`🔍 [SDK] Token coefficients:`, options.coefficients?.map(c => ({
      token: c.token.slice(0, 10) + '...',
      coefficient: c.coefficient
    })));
    
    let result: Map<string, number>;
    
    console.log(`🔍 [SDK] Calling ${calculationType} calculation...`);
    
    switch (calculationType) {
      case 'geometric':
        result = sdk.utils.calcGeometricStrategyWeights(strategyTokenWeights as any, options);
        break;
      case 'harmonic':
        result = sdk.utils.calcHarmonicStrategyWeights(strategyTokenWeights as any, options);
        break;
      case 'arithmetic':
      default:
        result = sdk.utils.calcArithmeticStrategyWeights(strategyTokenWeights as any, options);
        break;
    }
    
    console.log(`🔍 [SDK] ${calculationType} calculation completed`);
    console.log(`🔍 [SDK] Result type:`, typeof result);
    console.log(`🔍 [SDK] Result is Map:`, result instanceof Map);
    console.log(`🔍 [SDK] Result size:`, result?.size || 'undefined');
    console.log(`🔍 [SDK] Result entries:`, result ? Array.from(result.entries()) : 'no entries');
    console.log(`🔍 [SDK] Result values:`, result ? Array.from(result.values()) : 'no values');
    
    // Check for empty or invalid results
    if (!result || result.size === 0) {
      console.warn(`🔍 [SDK] Empty result from ${calculationType} calculation!`);
      return new Map();
    }
    
    // Check for NaN or invalid values
    const hasInvalidValues = Array.from(result.values()).some(value => 
      isNaN(value) || !isFinite(value) || value < 0
    );
    
    if (hasInvalidValues) {
      console.warn(`🔍 [SDK] Invalid values detected in ${calculationType} result:`, 
        Array.from(result.entries()).filter(([_, value]) => 
          isNaN(value) || !isFinite(value) || value < 0
        )
      );
    }
    
    return result;
  } catch (error) {
    console.error(`🔍 [SDK] Error in calculateStrategyWeights (${calculationType}):`, error);
    console.error(`🔍 [SDK] Error stack:`, error.stack);
    console.error(`🔍 [SDK] Input data that caused error:`, {
      strategyTokenWeights,
      options,
      calculationType
    });
    return new Map();
  }
};

export const generateRandomStrategy = (): StrategyTokenWeight => {
  const strategy = Math.floor(Math.random() * 1000000) + Date.now(); // More unique IDs
  const tokens = {
    "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee": {
      amount: (Math.random() * 2 + 0.1).toFixed(2), // Random 0.1 to 2.1 ETH
      obligatedPercentage: Math.random() * 100
    }
  };
  return { strategy, tokens };
}; 