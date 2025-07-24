import { BasedAppsSDK, chains } from "@ssv-labs/bapps-sdk";
import { createPublicClient, createWalletClient, http, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { BAppConfig, StrategyTokenWeight, WeightCalculationOptions, UIStrategy } from '../types';
import { GraphQLClient } from 'graphql-request';

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
     apiKey: "0e4cbf919a4e7ace964f16e8a8df17ed"
   }
 }
})

/**
 * Fetch the real owner address for a strategy from the subgraph
 */
const getStrategyOwner = async (strategyId: string): Promise<string> => {
  try {
    // Use the correct subgraph URL and include the API key in the headers
    const client = new GraphQLClient('https://api.studio.thegraph.com/query/71118/ssv-network-hoodi/version/latest', {
      headers: {
        'x-api-key': '0e4cbf919a4e7ace964f16e8a8df17ed'
      }
    });
    const query = `
      query GetStrategyOwner($id: ID!) {
        strategy(id: $id) {
          owner {
            id
          }
        }
      }
    `;
    const result = await client.request(query, { id: strategyId }) as { strategy?: { owner?: { id?: string } } };
    const ownerId = result?.strategy?.owner?.id;
    if (!ownerId) {
      return "0x0000000000000000000000000000000000000000"; // fallback
    }
    return ownerId;
  } catch (error) {
    return "0x0000000000000000000000000000000000000000"; // fallback
  }
};

/**
 * Transform simulation data to the format expected by the subgraph API
 */
const transformSimulationToSubgraphResponse = async (simulationStrategies: UIStrategy[], bAppId: string, graphqlClient: any) => {
  // Extract unique tokens across all strategies
  const uniqueTokens = new Set<string>();
  simulationStrategies.forEach(strategy => {
    strategy.tokenWeights?.forEach(tokenWeight => {
      if (tokenWeight.token) {
        uniqueTokens.add(tokenWeight.token.toLowerCase());
      }
    });
  });
  const allTokens = Array.from(uniqueTokens);

  // Calculate total obligated balance per token (across all strategies)
  const tokenTotals = new Map<string, bigint>();
  allTokens.forEach(token => {
    let total = 0n;
    simulationStrategies.forEach(strategy => {
      const tw = strategy.tokenWeights?.find(tw => tw.token.toLowerCase() === token);
      if (tw && tw.depositAmount) {
        total += BigInt(tw.depositAmount);
      }
    });
    tokenTotals.set(token, total);
  });

  // Build bApp tokens array (match real subgraph scaling and fields)
  const bAppTokens = allTokens.map(token => ({
    token: token as `0x${string}`,
    sharedRiskLevel: "1000000",
    totalObligatedBalance: (tokenTotals.get(token) || 0n).toString()
  }));

  // Build strategies array with real owner addresses and correct scaling
  const strategies = await Promise.all(simulationStrategies.map(async (strategy) => {
    const strategyId = (strategy.id || strategy.strategy)?.toString() || "";
    const realOwnerAddress = await getStrategyOwner(strategyId);
    // For each token in allTokens, ensure an entry exists
    const obligations = allTokens.map(token => {
      const tw = strategy.tokenWeights?.find(tw => tw.token.toLowerCase() === token);
      const obligatedBalance = tw && tw.depositAmount ? tw.depositAmount : "0";
      const totalObligatedBalance = tokenTotals.get(token) || 0n;
      let percentage = "0";
      if (totalObligatedBalance > 0n) {
        percentage = ((BigInt(obligatedBalance) * 10000n) / totalObligatedBalance).toString();
      }
      return {
        obligatedBalance,
        token: token as `0x${string}`,
        percentage
      };
    });
    const balances = allTokens.map(token => {
      const tw = strategy.tokenWeights?.find(tw => tw.token.toLowerCase() === token);
      const obligatedBalance = tw && tw.depositAmount ? tw.depositAmount : "0";
      const totalObligatedBalance = tokenTotals.get(token) || 0n;
      let riskValue = "0";
      if (totalObligatedBalance > 0n) {
        riskValue = ((BigInt(obligatedBalance) * 10000n) / totalObligatedBalance).toString();
      }
      return {
        token: token as `0x${string}`,
        riskValue
      };
    });
    const delegators: any[] = [];
    return {
      obligations,
      strategy: {
        id: strategyId,
        owner: {
          id: realOwnerAddress as `0x${string}`,
          delegators
        },
        balances
      }
    };
  }));

  const result = {
    bapp: {
      bAppTokens,
      id: bAppId,
      strategies
    }
  };

  return result;
};

/**
 * Create a mockable SDK instance that can intercept GraphQL requests
 */
const createMockableSDK = (simulationData?: { strategies: UIStrategy[]; bAppId: string }) => {
  
  if (simulationData) {
  }
  
  const originalSdk = new BasedAppsSDK({
    beaconchainUrl: "https://ethereum-hoodi-beacon-api.publicnode.com",
    publicClient,
    walletClient,
    extendedConfig: {
      subgraph: {
        apiKey: "6815e91a3ebffff4748fcc3ab91cf5fa"
      }
    }
  });

  if (simulationData) {
    
    // Store original request method
    const originalRequest = originalSdk.core.graphs.bam.client.request;
    
    // Override with interceptor
    originalSdk.core.graphs.bam.client.request = async (query: any, variables?: any) => {
      // Safely log the query
      const queryStr = typeof query === 'string' ? query : JSON.stringify(query);
      
      // Check if this is the getParticipantWeightInput query
      const isParticipantWeightQuery = (
        (typeof query === 'string' && (query.includes('getParticipantWeightInput') || query.includes('ParticipantWeightInput'))) ||
        (queryStr.includes('getParticipantWeightInput') || queryStr.includes('ParticipantWeightInput'))
      );
      
      // Check if this is a bApp metadata query (might be causing "bApp not found")
      const isBAppMetadataQuery = (
        (typeof query === 'string' && (query.includes('getBappMetadata') || query.includes('BappMetadata'))) ||
        (queryStr.includes('getBappMetadata') || queryStr.includes('BappMetadata'))
      );
      
      // Check if this is any other bApp-related query that might fail
      const isOtherBAppQuery = (
        (typeof query === 'string' && (query.includes('bApp') || query.includes('Bapp'))) ||
        (queryStr.includes('bApp') || queryStr.includes('Bapp')) ||
        (queryStr.includes('GetAllStrategiesForBapp')) ||
        (queryStr.includes('GetBAppDelegators')) ||
        (queryStr.includes('GetTotalDelegatedPercentageForAccount'))
      );
      
      if (isParticipantWeightQuery) {
        // Log the mock subgraph query result
        const mockResponse = await transformSimulationToSubgraphResponse(simulationData.strategies, simulationData.bAppId, originalSdk.core.graphs.bam.client);
        console.log('[MOCKED SUBGRAPH] getParticipantWeightInput:', mockResponse);
        return mockResponse;
      }
      
      if (isBAppMetadataQuery) {
        
        // Return a mock bApp metadata response
        const mockBAppResponse = {
          id: simulationData.bAppId,
          metadataUri: "https://example.com/metadata",
          // Add other required fields as needed
        };
        
        return mockBAppResponse;
      }
      
      if (isOtherBAppQuery) {
        
        // Return a generic mock response for other bApp queries
        const mockGenericResponse = {
          id: simulationData.bAppId,
          // Add minimal required fields
        };
        
        return mockGenericResponse;
      }
      
      // For all other queries, use the original request method
      try {
        const originalResult = await originalRequest.call(originalSdk.core.graphs.bam.client, query, variables);
        return originalResult;
      } catch (error) {
        // If it's any error that might be bApp-related, return a mock response
        if (error instanceof Error && (
          error.message.includes('bApp not found') ||
          error.message.includes('bApp') ||
          error.message.includes('not found') ||
          error.message.includes('404')
        )) {
          
          // Return a more complete mock response based on the query type
          if (queryStr.includes('GetAllStrategiesForBapp')) {
            return simulationData.strategies.map(s => ({
              id: s.id || s.strategy,
              strategy: { id: s.id || s.strategy }
            }));
          } else if (queryStr.includes('GetBAppDelegators')) {
            return [];
          } else if (queryStr.includes('GetTotalDelegatedPercentageForAccount')) {
            return { percentage: "0" };
          } else {
            return {
              id: simulationData.bAppId,
              bAppTokens: [],
              strategies: []
            };
          }
        }
        
        throw error;
      }
    };
  } else {
  }

  return originalSdk;
};

export const getParticipantWeights = async (
  bAppId: string,
  simulationData?: UIStrategy[]
): Promise<StrategyTokenWeight[]> => {
  try {
    
    if (simulationData) {
    }
    
    // Use mockable SDK if simulation data is provided
    if (!simulationData) {
      // Remove debug logging for real subgraph query and variables
      const realQuery = `query getParticipantWeightInput($bAppId: ID!) { bapp(id: $bAppId) { id bAppTokens { token sharedRiskLevel totalObligatedBalance } strategies { obligations { obligatedBalance token percentage } strategy { id owner { id delegators { id percentage } } balances { token riskValue } } } } }`;
      const realVariables = { bAppId };
      // Log the real subgraph query result
      const realBAppData = await sdk.core.graphs.bam.client.request(
        realQuery,
        realVariables
      );
      console.log('[REAL SUBGRAPH] getParticipantWeightInput:', realBAppData);
    }
    
    const sdkToUse = simulationData ? 
      createMockableSDK({ strategies: simulationData, bAppId }) : 
      sdk;
    
    // Try the SDK call - let it fail if the mock doesn't work
    
    try {
      // Remove debug logging for mock SDK query and variables
      const weights = await sdkToUse.api.getParticipantWeights({ bAppId: bAppId as `0x${string}` });
      
      return weights as unknown as StrategyTokenWeight[];
    } catch (sdkError) {
      console.error("🔍 [getParticipantWeights] ❌ SDK ERROR:", sdkError);
      console.error("🔍 [getParticipantWeights] ❌ SDK Error message:", sdkError instanceof Error ? sdkError.message : 'Unknown error');
      console.error("🔍 [getParticipantWeights] ❌ SDK Error stack:", sdkError instanceof Error ? sdkError.stack : 'No stack');
      console.error("🔍 [getParticipantWeights] ❌ Called with bAppId:", bAppId);
      console.error("🔍 [getParticipantWeights] ❌ Had simulation data:", !!simulationData);
      
      // Re-throw the error so we can see it in the console
      throw sdkError;
    }
  } catch (error) {
    console.error("🔍 [getParticipantWeights] ❌ OUTER ERROR:", error);
    console.error("🔍 [getParticipantWeights] ❌ OUTER Error message:", error instanceof Error ? error.message : 'Unknown error');
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
    
    // BigInt-safe JSON serialization
    const bigIntReplacer = (key: string, value: any) => {
      if (typeof value === 'bigint') {
        return value.toString() + 'n'; // Add 'n' suffix to identify BigInt values
      }
      return value;
    };
    
    try {
    } catch (stringifyError) {
      // Silent fallback if JSON.stringify fails
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