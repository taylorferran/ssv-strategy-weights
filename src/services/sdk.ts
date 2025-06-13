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
    return weights as unknown as StrategyTokenWeight[];
  } catch (error) {
    console.error("Error fetching participant weights:", error);
    return [];
  }
};

export const calculateStrategyWeights = (
  strategyTokenWeights: StrategyTokenWeight[],
  options: WeightCalculationOptions,
  calculationType: 'arithmetic' | 'geometric' | 'harmonic'
): Map<string, number> => {
  try {
    switch (calculationType) {
      case 'geometric':
        return sdk.utils.calcGeometricStrategyWeights(strategyTokenWeights as any, options);
      case 'harmonic':
        return sdk.utils.calcHarmonicStrategyWeights(strategyTokenWeights as any, options);
      case 'arithmetic':
      default:
        return sdk.utils.calcArithmeticStrategyWeights(strategyTokenWeights as any, options);
    }
  } catch (error) {
    console.error("Error calculating strategy weights:", error);
    return new Map();
  }
};

export const generateRandomStrategy = (): StrategyTokenWeight => {
  const strategy = Math.floor(Math.random() * 1000) + 1;
  const tokens = {
    "0x9F5d4Ec84fC4785788aB44F9de973cF34F7A038e": {
      amount: (Math.random() * 100).toFixed(2),
      obligatedPercentage: Math.random() * 100
    },
    "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee": {
      amount: (Math.random() * 10).toFixed(2),
      obligatedPercentage: Math.random() * 100
    }
  };
  return { strategy, tokens };
}; 