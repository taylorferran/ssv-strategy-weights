import { ChakraProvider, Box, VStack, HStack, Heading, Image, Text, Container, Spacer, Tabs, TabList, Tab, TabPanels, TabPanel } from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import type { BAppConfig, StrategyTokenWeight, UIStrategy, TokenCoefficient } from './types';
import { getParticipantWeights, calculateStrategyWeights, generateRandomStrategy, getDepositedBalancesForStrategy } from './services/sdk';
import { calculateSimulationWeights, convertUIStrategiesToSimulation, generateTokenConfigsFromStrategies } from './services/simulation-utils';
import ConfigPanel from './components/ConfigPanel';
import StrategyList from './components/StrategyList';
import WeightDisplay from './components/WeightDisplay';
import theme from './theme';
import { formatEther } from 'viem';

const defaultConfig: BAppConfig = {
  bAppId: "0xBb00B761d0670f09d80fe176a2b0fB33e91fbCe9",
  tokenCoefficients: [
    {
      token: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      coefficient: 220,
    },
  ],
  validatorCoefficient: 1,
  calculationType: 'arithmetic',
};

// Debug function to print comprehensive state for debugging
const printDebugSummary = (context: string, simulationStrategies: any[], simulationWeights: Map<string, number>) => {
  console.log(`🚀 [DEBUG-SUMMARY] ===== ${context} =====`);
  console.log(`🚀 [DEBUG-SUMMARY] Simulation strategies count:`, simulationStrategies.length);
  
  simulationStrategies.forEach((strategy, idx) => {
    console.log(`🚀 [DEBUG-SUMMARY] Strategy ${idx + 1} (ID: ${strategy.id || strategy.strategy}):`);
    console.log(`  - Token count: ${strategy.tokenWeights.length}`);
    console.log(`  - Validator balance weight: ${strategy.validatorBalanceWeight}`);
    strategy.tokenWeights.forEach((tw: any, twIdx: number) => {
      console.log(`  - Token ${twIdx + 1}: ${tw.token.slice(0, 10)}... deposit: ${tw.depositAmount} weight: ${tw.weight}`);
    });
  });
  
  console.log(`🚀 [DEBUG-SUMMARY] Simulation weights:`, simulationWeights);
  console.log(`🚀 [DEBUG-SUMMARY] Weights entries:`, Array.from(simulationWeights.entries()));
  console.log(`🚀 [DEBUG-SUMMARY] Weights size:`, simulationWeights.size);
  console.log(`🚀 [DEBUG-SUMMARY] ========================`);
};

function App() {
  const [config, setConfig] = useState<BAppConfig>(defaultConfig);
  const [strategies, setStrategies] = useState<StrategyTokenWeight[]>([]);
  const [weights, setWeights] = useState<Map<string, number>>(new Map());
  const [strategyDeposits, setStrategyDeposits] = useState<Map<string, any>>(new Map());
  
  // Simulation state (using UI format)
  const [simulationConfig, setSimulationConfig] = useState<BAppConfig>(defaultConfig);
  const [simulationStrategies, setSimulationStrategies] = useState<UIStrategy[]>([]);
  const [simulationWeights, setSimulationWeights] = useState<Map<string, number>>(new Map());
  const [simulationStrategyDeposits, setSimulationStrategyDeposits] = useState<Map<string, any>>(new Map());
  const [simulationDataEdited, setSimulationDataEdited] = useState<boolean>(false);
  const [simulationDetailedResults, setSimulationDetailedResults] = useState<any[]>([]);

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
    const fetchStrategies = async () => {
      console.log('🔍 [App] Fetching strategies for BApp ID:', config.bAppId);
      const fetchedStrategies = await getParticipantWeights(config.bAppId);
      console.log('🔍 [App] Fetched strategies:', fetchedStrategies);
      
      // Log details about strategy 0x3e9d5dd6415c2984fc7073f48070ff5fd9fabd9e specifically
      const targetStrategy = fetchedStrategies.find(s => 
        (s.strategy && s.strategy.toString().toLowerCase() === '0x3e9d5dd6415c2984fc7073f48070ff5fd9fabd9e')
      );
      if (targetStrategy) {
        console.log('🔍 [App] Target strategy 0x3e9d5dd6415c2984fc7073f48070ff5fd9fabd9e:', targetStrategy);
        console.log('🔍 [App] Token weights for target strategy:', targetStrategy.tokens);
      }
      
      setStrategies(fetchedStrategies);
    };
    fetchStrategies();
  }, [config.bAppId]);

  // Fetch deposited balances for each strategy
  useEffect(() => {
    const fetchDeposits = async () => {
      const depositsMap = new Map();
      for (const strategy of strategies) {
        try {
          // Use the id field since that's what the API returns
          const strategyId = strategy.id || strategy.strategy;
          console.log('🔍 [Calculator] Fetching deposits for strategy:', strategyId);
          if (strategyId) {
            const deposits = await getDepositedBalancesForStrategy(strategyId.toString());
            console.log('🔍 [Calculator] Fetched deposits:', deposits);
            console.log('🔍 [Calculator] Deposits structure:', JSON.stringify(deposits, null, 2));
            if (deposits) {
              depositsMap.set(strategyId.toString(), deposits);
            }
          }
        } catch (error) {
          console.error(`Failed to fetch deposits for strategy:`, error);
        }
      }
      console.log('🔍 [Calculator] Final deposits map:', depositsMap);
      setStrategyDeposits(depositsMap);
    };

    if (strategies.length > 0) {
      fetchDeposits();
    }
  }, [strategies]);

  useEffect(() => {
    console.log('🔍 [Calculator] Real API strategyTokenWeights:', JSON.stringify(strategies, null, 2));
    console.log('🔍 [Calculator] Config for calculation:', {
      coefficients: config.tokenCoefficients,
      validatorCoefficient: config.validatorCoefficient,
    });
    
    const newWeights = calculateStrategyWeights(
      strategies,
      {
        coefficients: config.tokenCoefficients,
        validatorCoefficient: config.validatorCoefficient,
      },
      config.calculationType
    );
    console.log('🔍 [App] Calculator weights being set:', newWeights);
    console.log('🔍 [App] Calculator weights entries:', Array.from(newWeights.entries()));
    setWeights(newWeights);
  }, [strategies, config]);

  // Store original API strategies for simulation (for unedited calculations)
  const [simulationOriginalStrategies, setSimulationOriginalStrategies] = useState<StrategyTokenWeight[]>([]);

  // Simulation effects
  useEffect(() => {
    const fetchSimulationStrategies = async () => {
      console.log('🔍 [Simulation] *** CACHE BUSTER v3.0 *** Fetching strategies for BApp ID:', simulationConfig.bAppId);
      const fetchedStrategies = await getParticipantWeights(simulationConfig.bAppId);
      console.log('🔍 [Simulation] Fetched raw strategies:', fetchedStrategies);
      console.log('🔍 [Simulation] Number of strategies fetched:', fetchedStrategies.length);
      
      // Store original strategies for unedited calculations
      setSimulationOriginalStrategies(fetchedStrategies);
      
      // First, fetch deposits for these strategies
      const depositsMap = new Map();
      for (const strategy of fetchedStrategies) {
        try {
          // Use the id field since that's what the API returns
          const strategyId = strategy.id;
          console.log('🔍 [Simulation] Fetching deposits for strategy:', strategyId);
          if (strategyId) {
            const deposits = await getDepositedBalancesForStrategy(strategyId.toString());
            console.log('🔍 [Simulation] Fetched deposits:', deposits);
            console.log('🔍 [Simulation] Deposits structure:', JSON.stringify(deposits, null, 2));
            if (deposits) {
              depositsMap.set(strategyId.toString(), deposits);
            }
          }
        } catch (error) {
          console.error(`Failed to fetch deposits for simulation strategy:`, error);
        }
      }
      console.log('🔍 [Simulation] Final deposits map:', depositsMap);
      
      // The API already returns UI-formatted data, no conversion needed
      console.log('🔍 [Simulation] NEW CODE v2.0 - Raw fetchedStrategies (already in UI format):', fetchedStrategies);
      
      // Add default validatorBalanceWeight for simulation editing and ensure proper ID mapping
      const strategiesWithValidatorWeight = fetchedStrategies.map(strategy => ({
        ...strategy,
        id: strategy.id, // Preserve the original id
        strategy: strategy.id, // Set strategy field to same value as id for compatibility
        validatorBalanceWeight: strategy.validatorBalanceWeight || 0
      }));
      
      console.log('🔍 [Simulation] Strategies with validator weights:', strategiesWithValidatorWeight);
      
      // Ensure all strategies have all tokens from the configuration
      const strategiesWithAllTokens = ensureAllTokensInStrategies(strategiesWithValidatorWeight, simulationConfig.tokenCoefficients);
      console.log('🔍 [Simulation] Strategies with all tokens:', strategiesWithAllTokens);
      
      setSimulationStrategies(strategiesWithAllTokens);
      setSimulationStrategyDeposits(depositsMap);
      // Reset the edited flag when loading fresh data
      setSimulationDataEdited(false);
      console.log('🔍 [Simulation] Set simulation strategies and reset edited flag');
      console.log('🔍 [Simulation] Final simulation strategies for display:', strategiesWithAllTokens);
      console.log('🔍 [Simulation] First strategy details:', strategiesWithAllTokens[0]);
    };
    fetchSimulationStrategies();
  }, [simulationConfig.bAppId, simulationConfig.tokenCoefficients]);

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
    console.log('🔍 [App] Simulation weight calculation triggered. DataEdited:', simulationDataEdited, 'Strategies count:', simulationStrategies.length);
    
    // Check if simulation data has been edited by user
    if (simulationDataEdited) {
      // Convert simulation strategies to UI format for SDK (same as Calculator tab)
      console.log('🔍 [App] Using SDK calculation for edited simulation data');
      
      // Create UI format data with deposit amounts converted to weights
      const uiFormatForSDK = simulationStrategies.map((strategy, idx) => {
        console.log(`🚀 [DEBUG-WEIGHT-CALC] Processing strategy ${idx + 1} for SDK:`, {
          originalStrategy: strategy,
          id: strategy.id || strategy.strategy,
          tokenWeightsCount: strategy.tokenWeights.length,
          validatorBalanceWeight: strategy.validatorBalanceWeight
        });
        
        const processedTokenWeights = strategy.tokenWeights.map((tw, twIdx) => {
          let depositAmount = tw.depositAmount;
          let weightValue = 0;
          
          // If no depositAmount, try to get it from deposits map
          if (!depositAmount || depositAmount === "0") {
            const strategyDeposits = simulationStrategyDeposits.get((strategy.id || strategy.strategy)?.toString());
            if (strategyDeposits?.deposits) {
              const deposit = strategyDeposits.deposits.find((d: any) => 
                d.token.toLowerCase() === tw.token.toLowerCase()
              );
              if (deposit?.depositAmount) {
                depositAmount = deposit.depositAmount;
                console.log(`🚀 [DEBUG-WEIGHT-CALC] Using deposit from deposits map: ${depositAmount}`);
              }
            }
            if (!depositAmount || depositAmount === "0") {
              console.log(`🚀 [DEBUG-WEIGHT-CALC] No depositAmount found for token ${tw.token.slice(0, 10)}...`);
            }
          }
          
          if (depositAmount && depositAmount !== "0") {
            weightValue = parseFloat(formatEther(BigInt(depositAmount)));
          }
          
          console.log(`🚀 [DEBUG-WEIGHT-CALC] Token ${twIdx + 1} in strategy ${idx + 1}:`, {
            token: tw.token.slice(0, 10) + '...',
            originalDepositAmount: tw.depositAmount,
            finalDepositAmount: depositAmount,
            convertedWeight: weightValue,
            originalWeight: tw.weight
          });
          
          return {
            token: tw.token,
            weight: weightValue
          };
        });
        
        const processedStrategy = {
          id: (strategy.id || strategy.strategy)?.toString() || "0",
          tokenWeights: processedTokenWeights,
          validatorBalanceWeight: strategy.validatorBalanceWeight || 0
        };
        
        console.log(`🚀 [DEBUG-WEIGHT-CALC] Final processed strategy ${idx + 1}:`, processedStrategy);
        return processedStrategy;
      });
      
      console.log('🔍 [App] UI format for SDK:', JSON.stringify(uiFormatForSDK, null, 2));
      
      // Debug: Check for potential issues
      console.log('🔍 [App] Simulation config for calculation:', {
        tokenCoefficients: simulationConfig.tokenCoefficients,
        validatorCoefficient: simulationConfig.validatorCoefficient,
        calculationType: simulationConfig.calculationType
      });
      
      // Check for empty or invalid data
      const hasValidStrategies = uiFormatForSDK.length > 0;
      const hasValidTokens = uiFormatForSDK.some(s => s.tokenWeights.length > 0);
      const hasValidWeights = uiFormatForSDK.some(s => s.tokenWeights.some(tw => tw.weight > 0));
      
      console.log('🔍 [App] Data validation:', {
        hasValidStrategies,
        hasValidTokens,
        hasValidWeights,
        strategiesCount: uiFormatForSDK.length,
        totalTokensCount: uiFormatForSDK.reduce((sum, s) => sum + s.tokenWeights.length, 0)
      });
      
      if (!hasValidStrategies || !hasValidTokens) {
        console.warn('🔍 [App] Invalid simulation data detected, clearing weights');
        setSimulationWeights(new Map());
        return;
      }
      
      // Use SDK calculation directly 
      console.log('🚀 [DEBUG-WEIGHT-CALC] Calling SDK calculateStrategyWeights...');
      console.log('🚀 [DEBUG-WEIGHT-CALC] SDK input data:', JSON.stringify(uiFormatForSDK, null, 2));
      console.log('🚀 [DEBUG-WEIGHT-CALC] SDK options:', {
        coefficients: simulationConfig.tokenCoefficients,
        validatorCoefficient: simulationConfig.validatorCoefficient,
        calculationType: simulationConfig.calculationType
      });
      
      const algorithmWeights = calculateStrategyWeights(
        uiFormatForSDK as any,
        {
          coefficients: simulationConfig.tokenCoefficients,
          validatorCoefficient: simulationConfig.validatorCoefficient,
        },
        simulationConfig.calculationType
      );
      
      console.log('🚀 [DEBUG-WEIGHT-CALC] SDK algorithm weights result:', algorithmWeights);
      console.log('🚀 [DEBUG-WEIGHT-CALC] SDK weights entries:', Array.from(algorithmWeights.entries()));
      console.log('🚀 [DEBUG-WEIGHT-CALC] SDK weights size:', algorithmWeights.size);
      console.log('🚀 [DEBUG-WEIGHT-CALC] SDK weights values sum:', Array.from(algorithmWeights.values()).reduce((sum, val) => sum + val, 0));
      
      // Check for the specific issues
      const entries = Array.from(algorithmWeights.entries());
      entries.forEach(([strategyId, weight], idx) => {
        console.log(`🚀 [DEBUG-WEIGHT-CALC] Strategy ${strategyId} weight analysis:`, {
          strategyId,
          weight,
          isZero: weight === 0,
          isNaN: isNaN(weight),
          isFinite: isFinite(weight),
          percentage: algorithmWeights.size > 0 ? (weight / Array.from(algorithmWeights.values()).reduce((sum, val) => sum + val, 0)) * 100 : 0
        });
      });
      
      setSimulationWeights(algorithmWeights);
      
      // Store detailed results for breakdown display
      setSimulationDetailedResults(uiFormatForSDK as any);
      
      // Debug summary after weight calculation
      printDebugSummary("AFTER WEIGHT CALCULATION", simulationStrategies, algorithmWeights);
    } else {
      // Use original API data for unedited simulation (same as calculator)
      console.log('🔍 [App] Using original API data for unedited simulation');
      console.log('🔍 [Simulation] Original strategies for calculation:', simulationOriginalStrategies);
      
      if (simulationOriginalStrategies.length > 0) {
        const weights = calculateStrategyWeights(
          simulationOriginalStrategies,
          {
            coefficients: simulationConfig.tokenCoefficients,
            validatorCoefficient: simulationConfig.validatorCoefficient,
          },
          simulationConfig.calculationType
        );
        console.log('🔍 [App] Unedited simulation weights:', weights);
        console.log('🔍 [App] Unedited simulation weights entries:', Array.from(weights.entries()));
        setSimulationWeights(weights);
      } else {
        // If no original strategies yet, clear weights
        console.log('🔍 [App] No original strategies, clearing simulation weights');
        setSimulationWeights(new Map());
      }
    }
  }, [simulationStrategies, simulationConfig, simulationDataEdited, simulationOriginalStrategies, simulationStrategyDeposits]);

  const handleAddRandomStrategy = () => {
    setStrategies([...strategies, generateRandomStrategy()]);
  };

  const handleAddRandomSimulationStrategy = () => {
    console.log('🚀 [DEBUG-NEW-STRATEGY] Adding new random simulation strategy...');
    console.log('🚀 [DEBUG-NEW-STRATEGY] Current simulation strategies before add:', simulationStrategies);
    
    const randomStrategy = generateRandomStrategy();
    console.log('🚀 [DEBUG-NEW-STRATEGY] Generated random strategy from SDK:', randomStrategy);
    console.log('🚀 [DEBUG-NEW-STRATEGY] Random strategy tokens:', randomStrategy.tokens);
    
    // Convert the random strategy to UI format manually since it comes from the old API format
    const uiStrategy = {
      id: randomStrategy.strategy,
      strategy: randomStrategy.strategy,
      tokenWeights: randomStrategy.tokens ? Object.entries(randomStrategy.tokens).map(([token, data]) => ({
        token,
        weight: data.obligatedPercentage,
        depositAmount: parseEther(data.amount || "0").toString() // Convert to wei string
      })) : [],
      validatorBalanceWeight: 0 // Keep this as 0 for new strategies
    };
    
    console.log('🚀 [DEBUG-NEW-STRATEGY] Converted to UI format:', uiStrategy);
    console.log('🚀 [DEBUG-NEW-STRATEGY] UI strategy token weights:', uiStrategy.tokenWeights);
    console.log('🚀 [DEBUG-NEW-STRATEGY] UI strategy validator balance weight:', uiStrategy.validatorBalanceWeight);
    
    // Verify the validator balance weight is indeed 0
    if (uiStrategy.validatorBalanceWeight !== 0) {
      console.error('🚀 [DEBUG-NEW-STRATEGY] ERROR: Validator balance weight should be 0 but is:', uiStrategy.validatorBalanceWeight);
    }
    
    const updatedStrategies = [...simulationStrategies, uiStrategy];
    console.log('🚀 [DEBUG-NEW-STRATEGY] Updated strategies array:', updatedStrategies);
    console.log('🚀 [DEBUG-NEW-STRATEGY] Total strategies count:', updatedStrategies.length);
    
    setSimulationStrategies(updatedStrategies);
    setSimulationDataEdited(true); // Mark as edited
    
    console.log('🚀 [DEBUG-NEW-STRATEGY] Marked simulation data as edited');
    
    // Debug summary after adding new strategy
    setTimeout(() => {
      printDebugSummary("AFTER ADDING NEW STRATEGY", updatedStrategies, simulationWeights);
    }, 100);
  };

  // Handler for when simulation strategies are changed by user
  const handleSimulationStrategiesChange = (updatedStrategies: UIStrategy[]) => {
    console.log('🔍 [App] Simulation strategies changed:', updatedStrategies);
    
    // Debug: Log detailed strategy analysis
    updatedStrategies.forEach((strategy, idx) => {
      console.log(`🔍 [App] Updated Strategy ${idx + 1} (ID: ${strategy.id || strategy.strategy}):`, {
        tokenCount: strategy.tokenWeights.length,
        tokens: strategy.tokenWeights.map(tw => ({
          token: tw.token.slice(0, 10) + '...',
          depositAmount: tw.depositAmount,
          weight: tw.weight
        })),
        validatorBalanceWeight: strategy.validatorBalanceWeight
      });
    });
    
    setSimulationStrategies(updatedStrategies);
    setSimulationDataEdited(true); // Mark as edited
    
    // Debug summary after strategies change
    setTimeout(() => {
      printDebugSummary("AFTER STRATEGIES CHANGE", updatedStrategies, simulationWeights);
    }, 100);
  };

  // Helper function to render calculator content
  const renderCalculatorContent = (
    currentConfig: BAppConfig,
    currentStrategies: StrategyTokenWeight[],
    currentWeights: Map<string, number>,
    currentDeposits: Map<string, any>,
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
            isSimulation={false}
          />
        </VStack>
      </Box>

      {/* Strategies and Weights Grid */}
      <VStack spacing={{ base: 6, lg: 0 }} align="stretch">
        <HStack 
          spacing={{ base: 4, md: 6, lg: 8 }} 
          align="stretch"
          direction={{ base: "column", lg: "row" }}
          w="full"
        >
          {/* Strategies Section */}
          <Box 
            bg="white" 
            borderRadius="3xl" 
            p={{ base: 6, md: 8, lg: 10 }}
            boxShadow="2xl"
            border="1px solid"
            borderColor="ssv.100"
            flex={1}
            minW={0}
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
                editable={false}
                onStrategiesChange={undefined}
                isSimulation={false}
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
            flex={1}
            minW={0}
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
              <WeightDisplay weights={currentWeights} />
            </VStack>
          </Box>
        </HStack>
      </VStack>
    </VStack>
  );

  // Helper function to render simulation content
  const renderSimulationContent = (
    currentConfig: BAppConfig,
    currentStrategies: UIStrategy[],
    currentWeights: Map<string, number>,
    currentDeposits: Map<string, any>,
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
            isSimulation={true}
          />
        </VStack>
      </Box>

      {/* Strategies and Weights Grid */}
      <VStack spacing={{ base: 6, lg: 0 }} align="stretch">
        <HStack 
          spacing={{ base: 4, md: 6, lg: 8 }} 
          align="stretch"
          direction={{ base: "column", lg: "row" }}
          w="full"
        >
          {/* Strategies Section */}
          <Box 
            bg="white" 
            borderRadius="3xl" 
            p={{ base: 6, md: 8, lg: 10 }}
            boxShadow="2xl"
            border="1px solid"
            borderColor="ssv.100"
            flex={1}
            minW={0}
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
                editable={true}
                onStrategiesChange={onStrategiesChange}
                isSimulation={true}
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
            flex={1}
            minW={0}
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
                isSimulation={true}
                simulationResults={simulationDetailedResults}
              />
            </VStack>
          </Box>
        </HStack>
      </VStack>
    </VStack>
  );

  // Helper function to convert simulation results to StrategyTokenWeight format
  const convertSimulationResultsToStrategyTokenWeights = (
    simulationResults: any[],
    strategies: UIStrategy[]
  ): StrategyTokenWeight[] => {
    console.log('🔍 [App] Converting simulation results to StrategyTokenWeight format');
    console.log('🔍 [App] Simulation results:', simulationResults);
    console.log('🔍 [App] UI strategies:', strategies);
    
    const strategyTokenWeights: StrategyTokenWeight[] = [];
    
    for (const result of simulationResults) {
      // Find the corresponding UI strategy to get token info
      const uiStrategy = strategies.find(s => 
        (s.id || s.strategy) === result.id
      );
      
      if (!uiStrategy) {
        console.warn('🔍 [App] Could not find UI strategy for result:', result.id);
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
        console.log('🔍 [App] Validator balance weight found but handled separately:', result.validatorBalanceWeight);
      }
      
      strategyTokenWeights.push({
        strategy: Number(result.id),
        tokens
      });
    }
    
    console.log('🔍 [App] Converted StrategyTokenWeights:', strategyTokenWeights);
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
