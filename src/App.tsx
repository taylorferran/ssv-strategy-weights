import { ChakraProvider, Box, VStack, HStack, Heading, Image, Text, Container, Spacer, Tabs, TabList, Tab, TabPanels, TabPanel } from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import type { BAppConfig, StrategyTokenWeight, UIStrategy, TokenCoefficient } from './types';
import { getParticipantWeights, calculateStrategyWeights, generateRandomStrategy, getDepositedBalancesForStrategy, getDelegatedBalances } from './services/sdk';
import { calculateSimulationWeights, convertUIStrategiesToStrategyTokenWeight } from './services/simulation-utils';
import ConfigPanel from './components/ConfigPanel';
import StrategyList from './components/StrategyList';
import WeightDisplay from './components/WeightDisplay';
import theme from './theme';
import { formatEther, parseEther } from 'viem';

const defaultConfig: BAppConfig = {
  bAppId: "0x24d1f83f9028236841429aab770b0efcc13ebeb5",
  tokenCoefficients: [
    {
      token: "0x9f5d4ec84fc4785788ab44f9de973cf34f7a038e",
      coefficient: 1,
    },
  ],
  validatorCoefficient: 1,
  calculationType: 'arithmetic',
};



function App() {
  const [config, setConfig] = useState<BAppConfig>(defaultConfig);
  const [strategies, setStrategies] = useState<StrategyTokenWeight[]>([]);
  const [weights, setWeights] = useState<Map<string, number>>(new Map());
  const [strategyDeposits, setStrategyDeposits] = useState<Map<string, any>>(new Map());
  const [delegatedBalances, setDelegatedBalances] = useState<any>(null);
  const [isLoadingCalculatorData, setIsLoadingCalculatorData] = useState(false);
  
  // Simulation state (using UI format)
  const [simulationConfig, setSimulationConfig] = useState<BAppConfig>(defaultConfig);
  const [simulationStrategies, setSimulationStrategies] = useState<UIStrategy[]>([]);
  const [simulationWeights, setSimulationWeights] = useState<Map<string, number>>(new Map());
  const [simulationStrategyDeposits, setSimulationStrategyDeposits] = useState<Map<string, any>>(new Map());
  const [simulationDelegatedBalances, setSimulationDelegatedBalances] = useState<any>(null);
  const [simulationEditedDelegatedBalances, setSimulationEditedDelegatedBalances] = useState<Map<string, string>>(new Map());
  const [simulationDataEdited, setSimulationDataEdited] = useState<boolean>(false);
  const [simulationDetailedResults, setSimulationDetailedResults] = useState<any[]>([]);
  const [isLoadingSimulationData, setIsLoadingSimulationData] = useState(false);

  // Sync bapp address between calculator and simulation configs
  useEffect(() => {
    if (config.bAppId !== simulationConfig.bAppId) {
      setSimulationConfig(prev => ({ ...prev, bAppId: config.bAppId }));
    }
  }, [config.bAppId]);

  useEffect(() => {
    if (simulationConfig.bAppId !== config.bAppId) {
      setConfig(prev => ({ ...prev, bAppId: simulationConfig.bAppId }));
    }
  }, [simulationConfig.bAppId]);

    // CACHE BUSTER: convertToUIFormat is no longer needed since getParticipantWeights() 
  // already returns data in UI format with id and tokenWeights structure - v2.0

  useEffect(() => {
    const fetchStrategies = async (bAppId: string) => {
      console.log('🔍 [App] Fetching strategies for BApp ID:', bAppId);
      setIsLoadingCalculatorData(true);
      
      try {
        const rawStrategies = await getParticipantWeights(bAppId);
        console.log('🔍 [App] Fetched strategies:', rawStrategies);
        
        console.log('🚨🚨🚨 [App] Raw API response structure analysis 🚨🚨🚨');
        console.log('🚨 [App] Number of strategies returned:', rawStrategies.length);
        
        // Analyze raw strategy structure
        rawStrategies.forEach((strategy: any, index: number) => {
          console.log(`🚨 [App] Raw Strategy ${index}:`, strategy);
          console.log(`🚨 [App] Strategy ${index} keys:`, Object.keys(strategy));
          console.log(`🚨 [App] Strategy ${index} id field:`, strategy.id);
          console.log(`🚨 [App] Strategy ${index} strategy field:`, strategy.strategy);
          if (strategy.tokenWeights?.length === 0) {
            console.log(`🚨 [App] Strategy ${strategy.id || strategy.strategy} has EMPTY tokenWeights array!`);
          } else if (strategy.tokenWeights?.length > 0) {
            console.log(`🚨 [App] Strategy ${strategy.id || strategy.strategy} tokenWeights:`, strategy.tokenWeights);
            strategy.tokenWeights.forEach((tw: any, twIndex: number) => {
              console.log(`🚨 [App] TokenWeight ${twIndex}:`, tw);
              console.log(`🚨 [App] TokenWeight ${twIndex} weight:`, tw.weight);
              console.log(`🚨 [App] TokenWeight ${twIndex} obligatedPercentage:`, tw.obligatedPercentage);
            });
          }
        });
        
        console.log(`🚨 [App] SUMMARY: Found ${rawStrategies.length} strategies, but only ${rawStrategies.filter((s: any) => s.tokenWeights?.length > 0).length} have token data`);
        
        if (rawStrategies.filter((s: any) => s.tokenWeights?.length > 0).length === 0) {
          console.log('🚨 [App] ❌ NO TOKEN DATA FOUND!');
          console.log('🚨 [App] This BApp has strategies but no tokens/deposits configured.');
          console.log('🚨 [App] This is why both the calculator and simulation tabs show empty data.');
          console.log('🚨 [App] Try a different BApp ID that has actual token deposits.');
        }
        
        // Process strategies and populate with deposit data
        const processedStrategies = await Promise.all(
          rawStrategies.map(async (strategy: any) => {
            const strategyId = strategy.id || strategy.strategy;
            console.log(`🔍 [App] Processing strategy ${strategyId} (id: ${strategy.id}, strategy: ${strategy.strategy})`);
            
            // Fetch deposits for this strategy
            console.log(`🔍 [Calculator] Fetching deposits for strategy: ${strategyId}`);
            const depositsResponse = await getDepositedBalancesForStrategy(strategyId?.toString());
            console.log(`🔍 [Calculator] Fetched deposits:`, depositsResponse);
            console.log(`🔍 [Calculator] Deposits structure:`, depositsResponse);
            

            
            // Convert deposits to tokenWeights format, preserving original weights from API
            const tokenWeights: any[] = [];
            const tokensObject: Record<string, any> = {};
            
            if (depositsResponse && depositsResponse.deposits && depositsResponse.deposits.length > 0) {
              // Group deposits by token
              const depositsByToken: Record<string, any[]> = {};
              depositsResponse.deposits.forEach((deposit: any) => {
                if (!depositsByToken[deposit.token]) {
                  depositsByToken[deposit.token] = [];
                }
                depositsByToken[deposit.token].push(deposit);
              });
              
              // Convert each token's deposits to tokenWeight format, preserving original weights
              Object.entries(depositsByToken).forEach(([tokenAddress, deposits]) => {
                const totalAmount = deposits.reduce((sum, deposit) => {
                  return sum + BigInt(deposit.depositAmount);
                }, BigInt(0));
                
                // Find the original weight for this token from the API response
                const originalTokenWeight = strategy.tokenWeights?.find((tw: any) => 
                  tw.token === tokenAddress
                );
                const originalWeight = originalTokenWeight?.weight || originalTokenWeight?.obligatedPercentage || 0;
                
                console.log(`🔍 [App] Token ${tokenAddress} original weight from API:`, originalWeight);
                
                const tokenWeight = {
                  id: `${strategyId}-${tokenAddress}`,
                  token: tokenAddress,
                  tokenAmount: totalAmount.toString(),
                  strategy: strategyId,
                  weight: originalWeight // Preserve original weight from API
                };
                
                tokenWeights.push(tokenWeight);
                tokensObject[tokenAddress] = {
                  amount: formatEther(totalAmount),
                  obligatedPercentage: originalWeight // Preserve original weight from API
                };
              });
            }
            
            return {
              ...strategy,
              id: strategyId, // Ensure consistent ID field
              strategy: strategyId, // Ensure consistent strategy field
              tokenWeights,
              tokens: tokensObject
            };
          })
        );
        
        console.log('🔍 [App] Converted strategies for calculator:', processedStrategies);
        
        // Set processed strategies
        setStrategies(processedStrategies);
        
      } catch (error) {
        console.error('Error fetching strategies:', error);
      } finally {
        setIsLoadingCalculatorData(false);
      }
    };
    fetchStrategies(config.bAppId);
  }, [config.bAppId]);

  // Note: Deposit fetching is now handled in the main strategy fetch above to avoid race conditions

  // Fetch delegated balances for the BApp
  useEffect(() => {
    const fetchDelegatedBalances = async () => {
      console.log('🔍 [Calculator] Fetching delegated balances for BApp ID:', config.bAppId);
      try {
        const delegated = await getDelegatedBalances(config.bAppId);
        console.log('🔍 [Calculator] Fetched delegated balances:', delegated);
        setDelegatedBalances(delegated);
      } catch (error) {
        console.error('Error fetching delegated balances:', error);
      }
    };

    if (config.bAppId) {
      fetchDelegatedBalances();
    }
  }, [config.bAppId]);

  useEffect(() => {
    console.log('🔍 [Calculator] ============ CALCULATOR WEIGHT CALCULATION ============');
    console.log('🔍 [Calculator] Calculator effect triggered with strategies:', strategies.length);
    console.log('🔍 [Calculator] Config for calculation:', {
      coefficients: config.tokenCoefficients,
      validatorCoefficient: config.validatorCoefficient,
      calculationType: config.calculationType
    });
    
    // Check for issues before calculation
    if (strategies.length === 0) {
      console.log('🔍 [Calculator] No strategies to calculate weights for');
      setWeights(new Map());
      return;
    }
    
    if (config.tokenCoefficients.length === 0) {
      console.log('🔍 [Calculator] No token coefficients configured, waiting for auto-detection...');
      setWeights(new Map());
      return;
    }
    
    // Convert hybrid format to clean StrategyTokenWeight format for SDK
    // FILTER OUT strategies with no tokens since SDK can't handle empty strategies
    const strategiesWithTokens = strategies.filter(strategy => 
      strategy.tokens && Object.keys(strategy.tokens).length > 0
    );
    
    console.log(`🔍 [Calculator] Filtered strategies: ${strategiesWithTokens.length} out of ${strategies.length} have tokens`);
    
    if (strategiesWithTokens.length === 0) {
      console.log('🔍 [Calculator] No strategies have tokens, setting weights to empty');
      setWeights(new Map());
      return;
    }

    console.log(`🔍 [Calculator] Sample strategy with tokens:`, strategiesWithTokens[0]);
    console.log(`🔍 [Calculator] Sample strategy tokens:`, strategiesWithTokens[0].tokens);
    console.log(`🔍 [Calculator] Sending ${strategiesWithTokens.length} strategies with tokens to SDK`);
    
    // DEBUG: Check token/coefficient alignment
    const allTokensInStrategies = new Set();
    strategiesWithTokens.forEach(strategy => {
      Object.keys(strategy.tokens).forEach(token => allTokensInStrategies.add(token));
    });
    const tokensInCoefficients = config.tokenCoefficients.map(tc => tc.token);
    console.log(`🔍 [Calculator] All tokens in strategies:`, Array.from(allTokensInStrategies));
    console.log(`🔍 [Calculator] Tokens in coefficients:`, tokensInCoefficients);
    console.log(`🔍 [Calculator] Token/coefficient alignment check:`, 
      Array.from(allTokensInStrategies).every(token => tokensInCoefficients.includes(token as `0x${string}`)));
    
    try {
      // DEBUG: Log exact data being sent to SDK
      console.log('🔍 [Calculator] ===== SDK INPUT DATA =====');
      console.log('🔍 [Calculator] Strategies being sent to SDK:', JSON.stringify(strategiesWithTokens, null, 2));
      console.log('🔍 [Calculator] Options being sent to SDK:', {
        coefficients: config.tokenCoefficients,
        validatorCoefficient: config.validatorCoefficient,
      });
      console.log('🔍 [Calculator] Calculation type:', config.calculationType);
      console.log('🔍 [Calculator] ==============================');
      
      // Use the SDK calculation with the configured calculation type
      const newWeights = calculateStrategyWeights(
        strategiesWithTokens as StrategyTokenWeight[], 
        {
          coefficients: config.tokenCoefficients,
          validatorCoefficient: config.validatorCoefficient,
        },
        config.calculationType
      );
      
      console.log('🔍 [Calculator] SDK returned weights for', newWeights.size, 'strategies');
      console.log('🔍 [Calculator] Weight results:', Array.from(newWeights.entries()));
      
      // DEBUG: Log actual weight values
      Array.from(newWeights.entries()).forEach(([strategyId, weight]) => {
        console.log(`🔍 [Calculator] Strategy ${strategyId}: ${weight}% (${typeof weight})`);
      });
      
      setWeights(newWeights);
    } catch (error) {
      console.error('🔍 [Calculator] Error calculating weights:', error);
      setWeights(new Map());
    }
    
    console.log('🔍 [Calculator] ========================================================');
  }, [strategies, config]);



  // Simulation effects
  useEffect(() => {
    const fetchSimulationStrategies = async () => {
      // Reset token coefficients when bApp changes to clear old tokens
      setSimulationConfig(prev => ({ ...prev, tokenCoefficients: [] }));
      setIsLoadingSimulationData(true);
      
      try {
        const fetchedStrategies = await getParticipantWeights(simulationConfig.bAppId);
      
      // Convert to StrategyTokenWeight format for original strategies storage
      const originalStrategiesConverted: StrategyTokenWeight[] = fetchedStrategies.map((strategy: any) => {
        const tokens: { [key: string]: { amount: string; obligatedPercentage: number } } = {};
        
        if (strategy.tokenWeights) {
          strategy.tokenWeights.forEach((tw: any) => {
            tokens[tw.token] = {
              amount: tw.depositAmount ? formatEther(BigInt(tw.depositAmount)) : "0",
              obligatedPercentage: tw.weight || 0
            };
          });
        }
        
        return {
          strategy: Number(strategy.id || strategy.strategy || 0),
          tokens: tokens
        };
      });
      

      
              // Process strategies exactly like calculator tab to ensure same data format
        const processedStrategies = await Promise.all(
          fetchedStrategies.map(async (strategy: any) => {
            const strategyId = strategy.id || strategy.strategy;
            
            // Fetch deposits for this strategy (same as calculator)
            const depositsResponse = await getDepositedBalancesForStrategy(strategyId?.toString());
          
          // Convert deposits to tokenWeights format AND tokens object (same as calculator)
          const tokenWeights: any[] = [];
          const tokensObject: Record<string, any> = {};
          
          if (depositsResponse && depositsResponse.deposits && depositsResponse.deposits.length > 0) {
            // Group deposits by token (same as calculator)
            const depositsByToken: Record<string, any[]> = {};
            depositsResponse.deposits.forEach((deposit: any) => {
              if (!depositsByToken[deposit.token]) {
                depositsByToken[deposit.token] = [];
              }
              depositsByToken[deposit.token].push(deposit);
            });
            
            // Convert each token's deposits to tokenWeight format AND tokens object (same as calculator)
            Object.entries(depositsByToken).forEach(([tokenAddress, deposits]) => {
              const totalAmount = deposits.reduce((sum, deposit) => {
                return sum + BigInt(deposit.depositAmount);
              }, BigInt(0));
              
              const tokenWeight = {
                id: `${strategyId}-${tokenAddress}`,
                token: tokenAddress,
                tokenAmount: totalAmount.toString(),
                strategy: strategyId,
                weight: 0,
                depositAmount: totalAmount.toString() // Add depositAmount for UI compatibility
              };
              
              tokenWeights.push(tokenWeight);
              tokensObject[tokenAddress] = {
                amount: formatEther(totalAmount),
                obligatedPercentage: 0
              };
            });
          }
          
          return {
            ...strategy,
            id: strategyId, // Ensure consistent ID field
            strategy: strategyId, // Ensure consistent strategy field
            tokenWeights,
            tokens: tokensObject, // This is the key - same as calculator tab
            validatorBalanceWeight: strategy.validatorBalanceWeight || 0
          };
                  })
        );
      
      // Create deposits map for StrategyList component
      const depositsMap = new Map();
      for (const strategy of processedStrategies) {
        const strategyId = (strategy.id || strategy.strategy)?.toString();
        if (strategyId && strategy.tokenWeights && strategy.tokenWeights.length > 0) {
          // Create mock deposits structure for the StrategyList component
          const mockDeposits = {
            deposits: strategy.tokenWeights.map((tw: any) => ({
              token: tw.token,
              depositAmount: tw.tokenAmount || tw.depositAmount || "0"
            }))
          };
          depositsMap.set(strategyId, mockDeposits);
        }
      }
      
              // Set strategies directly - ConfigPanel will auto-detect tokens and update coefficients
      
        setSimulationStrategies(processedStrategies as UIStrategy[]);
        setSimulationStrategyDeposits(depositsMap);
        // Reset the edited flag when loading fresh data
        setSimulationDataEdited(false);
      } catch (error) {
        console.error('Error fetching simulation strategies:', error);
      } finally {
        setIsLoadingSimulationData(false);
      }
    };
    fetchSimulationStrategies();
  }, [simulationConfig.bAppId]); // Only reload when BApp ID changes, not when token coefficients change

  // Fetch delegated balances for the simulation BApp
  useEffect(() => {
    const fetchSimulationDelegatedBalances = async () => {
      try {
        const delegated = await getDelegatedBalances(simulationConfig.bAppId);
        setSimulationDelegatedBalances(delegated);
      } catch (error) {
        console.error('Error fetching simulation delegated balances:', error);
      }
    };

    if (simulationConfig.bAppId) {
      fetchSimulationDelegatedBalances();
    }
  }, [simulationConfig.bAppId]);

  // Handle token coefficient changes without reloading all data (preserves user edits)
  useEffect(() => {
    if (simulationStrategies.length > 0 && simulationConfig.tokenCoefficients.length > 0) {

      
      // Only add missing tokens to existing strategies, preserving all current data
      const updatedStrategies = ensureAllTokensInStrategies(simulationStrategies, simulationConfig.tokenCoefficients);
      
      // Only update if there are actually new tokens added
      const hasNewTokens = updatedStrategies.some((strategy, idx) => 
        strategy.tokenWeights.length > simulationStrategies[idx]?.tokenWeights.length
      );
      
      if (hasNewTokens) {
        setSimulationStrategies(updatedStrategies);
      }
    }
  }, [simulationConfig.tokenCoefficients]);

  // Update simulation deposits when strategies change (for user-added tokens)
  useEffect(() => {
    if (simulationStrategies.length > 0) {
      const currentDeposits = new Map(simulationStrategyDeposits);
      
      // Merge with simulation data to include user-added tokens
      for (const strategy of simulationStrategies) {
        const strategyId = (strategy.id || strategy.strategy)?.toString();
        if (strategyId) {
          const existingDeposits = currentDeposits.get(strategyId) || { deposits: [] };
          const simulationDeposits = { ...existingDeposits };
          
          // Ensure all tokens from the strategy are represented in deposits
          if (!simulationDeposits.deposits) {
            simulationDeposits.deposits = [];
          }
          
          strategy.tokenWeights.forEach(tokenWeight => {
            const existingDeposit = simulationDeposits.deposits.find(
              (dep: any) => dep.token === tokenWeight.token
            );
            
            if (!existingDeposit) {
              // Add user-added tokens that don't exist in real deposits
              simulationDeposits.deposits.push({
                token: tokenWeight.token,
                amount: tokenWeight.depositAmount || "0",
                // Add any other required fields
              });
            }
          });
          
          currentDeposits.set(strategyId, simulationDeposits);
        }
      }
      
      setSimulationStrategyDeposits(currentDeposits);
    }
  }, [simulationStrategies]);

    useEffect(() => {
    // For simulation tab, use our own calculateSimulationWeights function
    if (simulationStrategies.length > 0 && simulationConfig.tokenCoefficients.length > 0) {
      // Convert UI strategies to StrategyTokenWeight format
      const strategyTokenWeights = convertUIStrategiesToStrategyTokenWeight(simulationStrategies, simulationDelegatedBalances);
      

      
      // Prepare weight calculation options
      const options = {
        coefficients: simulationConfig.tokenCoefficients,
        validatorCoefficient: simulationConfig.validatorCoefficient
      };
      
      // Calculate weights using the selected calculation type
      const weightResults = calculateSimulationWeights(strategyTokenWeights, options, simulationConfig.calculationType);
      
      // Convert Map results to UI format
      const weightsMap = new Map<string, number>();
      for (const [strategyId, weight] of weightResults.entries()) {
        weightsMap.set(strategyId, weight);
      }
      
      setSimulationWeights(weightsMap);
    } else {
      setSimulationWeights(new Map());
    }
  }, [simulationStrategies, simulationConfig, simulationDataEdited, simulationDelegatedBalances]);

  const handleAddRandomStrategy = () => {
    setStrategies([...strategies, generateRandomStrategy()]);
  };

  const handleAddRandomSimulationStrategy = () => {
    const randomStrategy = generateRandomStrategy();
    
    // Convert the random strategy to UI format manually since it comes from the old API format
    const uiStrategy = {
      id: randomStrategy.strategy,
      strategy: randomStrategy.strategy,
      tokenWeights: randomStrategy.tokens ? Object.entries(randomStrategy.tokens).map(([token, data]: [string, any]) => ({
        token,
        weight: data.obligatedPercentage,
        depositAmount: parseEther(data.amount || "0").toString() // Convert to wei string
      })) : [],
      validatorBalanceWeight: 0 // Keep this as 0 for new strategies
    };
    
    const updatedStrategies = [...simulationStrategies, uiStrategy];
    
    setSimulationStrategies(updatedStrategies);
    setSimulationDataEdited(true); // Mark as edited
  };

  // Handler for when simulation strategies are changed by user
  const handleSimulationStrategiesChange = (updatedStrategies: UIStrategy[]) => {
    

    
    setSimulationStrategies(updatedStrategies);
    setSimulationDataEdited(true); // Mark as edited
  };

  // Handler for simulation delegated balance changes
  const handleSimulationDelegatedBalanceChange = (strategyId: string, newBalance: string) => {
    
    setSimulationEditedDelegatedBalances(prev => {
      const updated = new Map(prev);
      updated.set(strategyId, newBalance);
      return updated;
    });
    
    // Also update the simulation delegated balances structure to reflect the change
    setSimulationDelegatedBalances((prev: any) => {
      if (!prev?.bAppTotalDelegatedBalances) {
        return {
          bAppTotalDelegatedBalance: newBalance,
          bAppTotalDelegatedBalances: [{
            strategyId: strategyId,
            delegation: newBalance
          }]
        };
      }
      
      const updatedBalances = [...prev.bAppTotalDelegatedBalances];
      const existingIndex = updatedBalances.findIndex(b => b.strategyId === strategyId);
      
      if (existingIndex >= 0) {
        updatedBalances[existingIndex] = { ...updatedBalances[existingIndex], delegation: newBalance };
      } else {
        updatedBalances.push({ strategyId, delegation: newBalance });
      }
      
      // Recalculate total
      const totalBalance = updatedBalances.reduce((sum, b) => sum + BigInt(b.delegation || "0"), BigInt(0));
      
      return {
        ...prev,
        bAppTotalDelegatedBalance: totalBalance.toString(),
        bAppTotalDelegatedBalances: updatedBalances
      };
    });
    
    setSimulationDataEdited(true); // Mark as edited
  };

  // Helper function to render calculator content
  const renderCalculatorContent = (
    currentConfig: BAppConfig,
    currentStrategies: any[],
    currentWeights: Map<string, number>,
    currentDeposits: Map<string, any>,
    currentDelegatedBalances: any,
    onConfigChange: (config: BAppConfig) => void,
    onAddRandomStrategy: () => void
  ) => (
    <VStack spacing={8} align="stretch">
      {/* Configuration Section */}
      <Box 
        bg="white" 
        borderRadius="3xl" 
        p={{ base: 6, md: 8, lg: 10 }}
        boxShadow="2xl"
        border="1px solid"
        borderColor="ssv.100"
        transform="translateY(0)"
        transition="all 0.3s ease"
        _hover={{ transform: "translateY(-4px)", boxShadow: "3xl" }}
      >
        <VStack spacing={8} align="stretch">
          <HStack spacing={4} align="center">
            <Box w={4} h={4} bg="ssv.500" borderRadius="full" />
            <Heading size="lg" color="#2563eb" fontWeight="bold">
              Configuration Panel
            </Heading>
            <Spacer />
          </HStack>
          <ConfigPanel
            config={currentConfig}
            onConfigChange={onConfigChange}
            onAddRandomStrategy={onAddRandomStrategy}
            strategies={currentStrategies}
            deposits={currentDeposits}
            delegatedBalances={currentDelegatedBalances}
            isSimulation={false}
            isLoadingData={isLoadingCalculatorData}
          />
        </VStack>
      </Box>

      {/* Strategies and Weights Grid */}
      <VStack spacing={{ base: 6, md: 8 }} align="stretch">
        {/* Strategies Section */}
        <Box 
          bg="white" 
          borderRadius="3xl" 
          p={{ base: 6, md: 8, lg: 10 }}
          boxShadow="2xl"
          border="1px solid"
          borderColor="ssv.100"
          w="full"
          transform="translateY(0)"
          transition="all 0.3s ease"
          _hover={{ transform: "translateY(-4px)", boxShadow: "3xl" }}
        >
          <VStack spacing={8} align="stretch">
            <HStack spacing={4} align="center">
              <Box w={4} h={4} bg="ssv.500" borderRadius="full" />
              <Heading size="lg" color="#2563eb" fontWeight="bold">
                Active Strategies
              </Heading>
              <Spacer />
              <Text fontSize="sm" color="#3b82f6" fontWeight="medium">
                {currentStrategies.length} strategies loaded
              </Text>
            </HStack>
            <StrategyList 
              strategies={currentStrategies} 
              deposits={currentDeposits} 
              delegatedBalances={currentDelegatedBalances}
              editable={false}
              onStrategiesChange={undefined}
              isSimulation={false}
              weights={currentWeights}
            />
          </VStack>
        </Box>

        {/* Weights Section */}
        <Box 
          bg="white" 
          borderRadius="3xl" 
          p={{ base: 6, md: 8, lg: 10 }}
          boxShadow="2xl"
          border="1px solid"
          borderColor="ssv.100"
          w="full"
          transform="translateY(0)"
          transition="all 0.3s ease"
          _hover={{ transform: "translateY(-4px)", boxShadow: "3xl" }}
        >
          <VStack spacing={8} align="stretch">
            <HStack spacing={4} align="center">
              <Box w={4} h={4} bg="ssv.500" borderRadius="full" />
              <Heading size="lg" color="#2563eb" fontWeight="bold">
                Weight Distribution
              </Heading>
              <Spacer />
              <Text fontSize="sm" color="#3b82f6" fontWeight="medium">
                Calculated results
              </Text>
            </HStack>
            <WeightDisplay weights={currentWeights} allStrategies={currentStrategies} />
          </VStack>
        </Box>
      </VStack>
    </VStack>
  );

  // Helper function to render simulation content
  const renderSimulationContent = (
    currentConfig: BAppConfig,
    currentStrategies: UIStrategy[],
    currentWeights: Map<string, number>,
    currentDeposits: Map<string, any>,
    currentDelegatedBalances: any,
    onConfigChange: (config: BAppConfig) => void,
    onAddRandomStrategy: () => void,
    onStrategiesChange: (strategies: UIStrategy[]) => void
  ) => (
    <VStack spacing={8} align="stretch">
      {/* Configuration Section */}
      <Box 
        bg="white" 
        borderRadius="3xl" 
        p={{ base: 6, md: 8, lg: 10 }}
        boxShadow="2xl"
        border="1px solid"
        borderColor="ssv.100"
        transform="translateY(0)"
        transition="all 0.3s ease"
        _hover={{ transform: "translateY(-4px)", boxShadow: "3xl" }}
      >
        <VStack spacing={8} align="stretch">
          <HStack spacing={4} align="center">
            <Box w={4} h={4} bg="ssv.500" borderRadius="full" />
            <Heading size="lg" color="#2563eb" fontWeight="bold">
              Simulation Configuration
            </Heading>
            <Spacer />
          </HStack>
          <ConfigPanel
            config={currentConfig}
            onConfigChange={onConfigChange}
            onAddRandomStrategy={onAddRandomStrategy}
            strategies={currentStrategies}
            deposits={currentDeposits}
            delegatedBalances={currentDelegatedBalances}
            isSimulation={true}
            isLoadingData={isLoadingSimulationData}
          />
        </VStack>
      </Box>

      {/* Strategies and Weights Grid */}
      <VStack spacing={8} align="stretch">
        {/* Strategies Section */}
        <Box 
          bg="white" 
          borderRadius="3xl" 
          p={{ base: 6, md: 8, lg: 10 }}
          boxShadow="2xl"
          border="1px solid"
          borderColor="ssv.100"
          transform="translateY(0)"
          transition="all 0.3s ease"
          _hover={{ transform: "translateY(-4px)", boxShadow: "3xl" }}
        >
          <VStack spacing={8} align="stretch">
            <HStack spacing={4} align="center">
              <Box w={4} h={4} bg="ssv.500" borderRadius="full" />
              <Heading size="lg" color="#2563eb" fontWeight="bold">
                Simulation Strategies
              </Heading>
              <Spacer />
              <Text fontSize="sm" color="#3b82f6" fontWeight="medium">
                {currentStrategies.length} strategies loaded
              </Text>
            </HStack>
            <StrategyList 
              strategies={currentStrategies} 
              deposits={currentDeposits} 
              delegatedBalances={currentDelegatedBalances}
              editable={true}
              onStrategiesChange={onStrategiesChange}
              onDelegatedBalanceChange={handleSimulationDelegatedBalanceChange}
              isSimulation={true}
              weights={currentWeights}
              tokenCoefficients={currentConfig.tokenCoefficients}
            />
          </VStack>
        </Box>

        {/* Weights Section */}
        <Box 
          bg="white" 
          borderRadius="3xl" 
          p={{ base: 6, md: 8, lg: 10 }}
          boxShadow="2xl"
          border="1px solid"
          borderColor="ssv.100"
          transform="translateY(0)"
          transition="all 0.3s ease"
          _hover={{ transform: "translateY(-4px)", boxShadow: "3xl" }}
        >
          <VStack spacing={8} align="stretch">
            <HStack spacing={4} align="center">
              <Box w={4} h={4} bg="ssv.500" borderRadius="full" />
              <Heading size="lg" color="#2563eb" fontWeight="bold">
                Simulated Weight Distribution
              </Heading>
              <Spacer />
              <Text fontSize="sm" color="#3b82f6" fontWeight="medium">
                Simulated results
              </Text>
            </HStack>
            <WeightDisplay 
              weights={currentWeights} 
              allStrategies={currentStrategies}
              isSimulation={true}
              simulationResults={simulationDetailedResults}
            />
          </VStack>
        </Box>
      </VStack>
    </VStack>
  );

  // Helper function to convert simulation results to StrategyTokenWeight format
  const convertSimulationResultsToStrategyTokenWeights = (
    simulationResults: any[],
    strategies: UIStrategy[]
  ): StrategyTokenWeight[] => {
    
    const strategyTokenWeights: StrategyTokenWeight[] = [];
    
    for (const result of simulationResults) {
      // Find the corresponding UI strategy to get token info
      const uiStrategy = strategies.find(s => 
        (s.id || s.strategy) === result.id
      );
      
      if (!uiStrategy) {
        continue;
      }
      
      // Build tokens object with calculated weights
      const tokens: { [token: string]: { amount: string; obligatedPercentage: number } } = {};
      
      // Add token weights from simulation results
      if (result.tokenWeights && result.tokenWeights.length > 0) {
        for (const tokenWeight of result.tokenWeights) {
          // Find the original token data for deposit amount
          const originalToken = uiStrategy.tokenWeights.find(tw => 
            tw.token.toLowerCase() === tokenWeight.token.toLowerCase()
          );
          
          tokens[tokenWeight.token] = {
            amount: originalToken?.depositAmount || "0",
            obligatedPercentage: tokenWeight.weight * 10000 // Convert back to percentage format
          };
        }
      }
      
      // Add validator balance as a special token if it exists
      if (result.validatorBalanceWeight && result.validatorBalanceWeight > 0) {
        // Validator balance weight is handled separately
      }
      
      strategyTokenWeights.push({
        strategy: Number(result.id),
        tokens
      });
    }
    
    return strategyTokenWeights;
  };

  // Helper function to ensure all strategies have all tokens from config
  const ensureAllTokensInStrategies = (strategies: UIStrategy[], tokenCoefficients: TokenCoefficient[]): UIStrategy[] => {
    return strategies.map(strategy => {
      const existingTokens = new Set(strategy.tokenWeights.map(tw => tw.token.toLowerCase()));
      const missingTokens = tokenCoefficients.filter(coeff => 
        !existingTokens.has(coeff.token.toLowerCase())
      );
      
      const additionalTokenWeights = missingTokens.map(coeff => ({
        token: coeff.token,
        weight: 0, // Default weight
        depositAmount: "0" // Default deposit amount
      }));
      
      return {
        ...strategy,
        tokenWeights: [...strategy.tokenWeights, ...additionalTokenWeights]
      };
    });
  };

  return (
    <ChakraProvider theme={theme}>
      <Box minH="100vh" bg="linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)" overflowX="hidden" w="100%">
        {/* Hero Section */}
        <Box maxW="100%" px={{ base: 4, md: 6 }} py={16} mx="auto">
          <VStack spacing={6} textAlign="center" mb={16}>
            <Image src="/ssv-logo.png" alt="SSV Logo" w="80px" h="100px" filter="drop-shadow(0 4px 8px rgba(0,0,0,0.1))" />
            <Heading size="3xl" color="white" fontWeight="black" letterSpacing="tight">
              SSV Strategy Weights Calculator
            </Heading>
            <Text fontSize="lg" color="white" opacity={0.8} maxW="600px">
              Configure your strategies, analyze token weights, and visualize calculated distributions
            </Text>
          </VStack>

          {/* Tabbed Interface */}
          <Tabs size="lg" variant="soft-rounded" colorScheme="whiteAlpha" isLazy>
            <TabList 
              borderRadius="2xl" 
              p={2} 
              mb={8} 
              justifyContent="center"
              gap={4}
            >
              <Tab 
                color="white" 
                fontWeight="bold" 
                _selected={{ 
                  bg: "white", 
                  color: "#2563eb",
                  shadow: "lg"
                }}
                borderRadius="xl"
                px={8}
                py={3}
              >
                Calculator
              </Tab>
              <Tab 
                color="white" 
                fontWeight="bold" 
                _selected={{ 
                  bg: "white", 
                  color: "#2563eb",
                  shadow: "lg"
                }}
                borderRadius="xl"
                px={8}
                py={3}
              >
                Simulations
              </Tab>
            </TabList>

            <TabPanels>
              {/* Calculator Tab */}
              <TabPanel p={0}>
                {renderCalculatorContent(
                  config,
                  strategies,
                  weights,
                  strategyDeposits,
                  delegatedBalances,
                  setConfig,
                  handleAddRandomStrategy
                )}
              </TabPanel>

              {/* Simulations Tab */}
              <TabPanel p={0}>
                {renderSimulationContent(
                  simulationConfig,
                  simulationStrategies,
                  simulationWeights,
                  simulationStrategyDeposits,
                  simulationDelegatedBalances,
                  setSimulationConfig,
                  handleAddRandomSimulationStrategy,
                  handleSimulationStrategiesChange
                )}
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Box>
      </Box>
    </ChakraProvider>
  );
}

export default App;
