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
  beaconchainUrl: "https://ethereum-hoodi-beacon-api.publicnode.com",
  publicClient,
  walletClient,
  extendedConfig: {
   subgraph: {
    //url: "https://api.studio.thegraph.com/query/71118/ssv-network-hoodi/version/latest",
     apiKey: "6815e91a3ebffff4748fcc3ab91cf5fa"
   }
 }
})

export const getParticipantWeights = async (bAppId: string): Promise<StrategyTokenWeight[]> => {
  try {
    const weights = await sdk.api.getParticipantWeights({ bAppId: bAppId as `0x${string}` });
    
    // Detailed logging of the raw SDK response
    console.log("🔍 [SDK] RAW getParticipantWeights response for bApp", bAppId);
    console.log("🔍 [SDK] Full response structure:", JSON.stringify(weights, null, 2));
    
    return weights as unknown as StrategyTokenWeight[];
  } catch (error) {
    console.error("Error fetching participant weights:", error);
    return [];
  }
};

export const getDepositedBalancesForStrategy = async (strategyId: string) => {
  try {
    const deposits = await sdk.api.getDepositedBalancesForStrategy({ strategyId: strategyId as `0x${string}` });
    return deposits;
  } catch (error) {
    console.error(`Error fetching deposited balances for strategy ${strategyId}:`, error);
    return null;
  }
};

export const getDelegatedBalances = async (bAppId: string) => {
  try {
    const delegatedBalances = await sdk.api.getDelegatedBalances({ bAppId: bAppId as `0x${string}` });
    
    // Detailed logging of the raw SDK response (BigInt-safe)
    console.log("🔍 [SDK] RAW getDelegatedBalances response for bApp", bAppId);
    console.log("🔍 [SDK] Type of delegatedBalances:", typeof delegatedBalances);
    console.log("🔍 [SDK] Keys in delegatedBalances:", Object.keys(delegatedBalances || {}));
    
    // BigInt-safe JSON serialization
    const bigIntReplacer = (key: string, value: any) => {
      if (typeof value === 'bigint') {
        return value.toString() + 'n'; // Add 'n' suffix to identify BigInt values
      }
      return value;
    };
    
    try {
      console.log("🔍 [SDK] Full delegatedBalances structure (BigInt-safe):", JSON.stringify(delegatedBalances, bigIntReplacer, 2));
    } catch (stringifyError) {
      console.log("🔍 [SDK] Could not stringify delegatedBalances, logging raw object:", delegatedBalances);
    }
    
    // Additional detailed breakdown if it's an object
    if (delegatedBalances && typeof delegatedBalances === 'object') {
      console.log("🔍 [SDK] Detailed breakdown:");
      Object.entries(delegatedBalances).forEach(([key, value]) => {
        console.log(`🔍 [SDK] ${key}:`, typeof value, Array.isArray(value) ? `(array length: ${value.length})` : '');
        
        // Handle BigInt values specially
        if (typeof value === 'bigint') {
          console.log(`🔍 [SDK] ${key} BigInt value:`, value.toString());
        } else if (Array.isArray(value)) {
          console.log(`🔍 [SDK] ${key} array contents:`, value);
          value.forEach((item, index) => {
            console.log(`🔍 [SDK] ${key}[${index}]:`, item);
          });
        } else {
          console.log(`🔍 [SDK] ${key} value:`, value);
        }
      });
    }
    
    return delegatedBalances;
  } catch (error) {
    console.error(`Error fetching delegated balances for BApp ${bAppId}:`, error);
    return null;
  }
};

export const calculateStrategyWeights = (
  strategyTokenWeights: StrategyTokenWeight[],
  options: WeightCalculationOptions,
  calculationType: 'arithmetic' | 'geometric' | 'harmonic'
): Map<string, number> => {
  try {
    if (!strategyTokenWeights?.length) {
      return new Map();
    }
    
    let result: Map<string, number>;
    
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
    
    return result;
  } catch (error: any) {
    console.error(`🚨 [SDK] Error in calculateStrategyWeights (${calculationType}):`, error.message);
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