import { ChakraProvider, Box, VStack, HStack, Heading, Image, Text, Container, Spacer, Tabs, TabList, Tab, TabPanels, TabPanel, useToast, Link } from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import type { BAppConfig, StrategyTokenWeight, UIStrategy, TokenCoefficient } from './types';
import { getParticipantWeights, calculateStrategyWeights, generateRandomStrategy, getDepositedBalancesForStrategy, getDelegatedBalances } from './services/sdk';
import ConfigPanel from './components/ConfigPanel';
import StrategyList from './components/StrategyList';
import WeightDisplay from './components/WeightDisplay';
import theme from './theme';
import { formatEther, parseEther } from 'viem';

// Feature flag to enable/disable the Simulation tab
const ENABLE_SIMULATION_TAB = false;

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
  const [isCalculatingSimulationWeights, setIsCalculatingSimulationWeights] = useState(false);
  
  // Store relevant tokens from participant weights response
  const [relevantTokens, setRelevantTokens] = useState<Set<string>>(new Set());
  const [simulationRelevantTokens, setSimulationRelevantTokens] = useState<Set<string>>(new Set());
  
  // Toast for user feedback
  const toast = useToast();

  const [activeTabIndex, setActiveTabIndex] = useState(0);

  // Helper function to extract relevant tokens from participant weights response
  const extractRelevantTokens = (participantWeights: any[]): Set<string> => {
    const tokenSet = new Set<string>();
    
    participantWeights.forEach(strategy => {
      if (strategy.tokenWeights && strategy.tokenWeights.length > 0) {
        strategy.tokenWeights.forEach((tw: any) => {
          if (tw.token) {
            tokenSet.add(tw.token.toLowerCase());
          }
        });
      }
    });
    
    return tokenSet;
  };

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
      setIsLoadingCalculatorData(true);
      
      try {
        const rawStrategies = await getParticipantWeights(bAppId);
        
        // Extract relevant tokens from participant weights response
        const relevantTokensSet = extractRelevantTokens(rawStrategies);
        setRelevantTokens(relevantTokensSet);
        
        // Process strategies and populate with deposit data
        const processedStrategies = await Promise.all(
          rawStrategies.map(async (strategy: any) => {
            const strategyId = strategy.id || strategy.strategy;
            
            // Fetch deposits for this strategy
            const depositsResponse = await getDepositedBalancesForStrategy(strategyId?.toString());
            
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
      try {
        const delegated = await getDelegatedBalances(config.bAppId);
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
    // Check for issues before calculation
    if (strategies.length === 0) {
      setWeights(new Map());
      return;
    }
    
    if (config.tokenCoefficients.length === 0) {
      setWeights(new Map());
      return;
    }
    
    // Convert hybrid format to clean StrategyTokenWeight format for SDK
    // FILTER OUT strategies with no tokens since SDK can't handle empty strategies
    const strategiesWithTokens = strategies.filter(strategy => 
      strategy.tokens && Object.keys(strategy.tokens).length > 0
    );
    
    if (strategiesWithTokens.length === 0) {
      setWeights(new Map());
      return;
    }
    
    try {

      // Use the SDK calculation with the configured calculation type
      const newWeights = calculateStrategyWeights(
        strategiesWithTokens as StrategyTokenWeight[], 
        {
          coefficients: config.tokenCoefficients,
          validatorCoefficient: config.validatorCoefficient,
        },
        config.calculationType
      );
      
      setWeights(newWeights);
    } catch (error) {
      console.error('🔍 [Calculator] Error calculating weights:', error);
      setWeights(new Map());
    }
  }, [strategies, config]);



  // Define fetchSimulationStrategies as a named async function so it can be called from multiple places
  const fetchSimulationStrategies = async () => {
    setSimulationConfig(prev => ({ ...prev, tokenCoefficients: [] }));
    setIsLoadingSimulationData(true);
    try {
      // Fetch all strategies from the real subgraph (do not filter out zero-balance strategies)
      const fetchedStrategies = await getParticipantWeights(simulationConfig.bAppId);
      // Extract supported tokens from the real API response
      const supportedTokensSet = extractRelevantTokens(fetchedStrategies);
      setSimulationRelevantTokens(supportedTokensSet);
      // Use tokenWeights directly, but fetch and set depositAmount for each token as in the calculator tab
      const processedStrategies = await Promise.all(
        fetchedStrategies.map(async (strategy: any, idx: number) => {
          const strategyId = strategy.strategy ?? strategy.id ?? idx;
          // Fetch deposits for this strategy
          const depositsResponse = await getDepositedBalancesForStrategy(strategyId?.toString());
          // Group deposits by token
          const depositsByToken: Record<string, any[]> = {};
          if (depositsResponse && depositsResponse.deposits && depositsResponse.deposits.length > 0) {
            depositsResponse.deposits.forEach((deposit: any) => {
              if (!depositsByToken[deposit.token]) {
                depositsByToken[deposit.token] = [];
              }
              depositsByToken[deposit.token].push(deposit);
            });
          }
          // Map tokenWeights and set depositAmount
          const tokenWeights = (strategy.tokenWeights || []).map((tw: any) => {
            const token = tw.token;
            const deposits = depositsByToken[token] || [];
            const totalAmount = deposits.reduce((sum, deposit) => sum + BigInt(deposit.depositAmount), BigInt(0));
            return {
              ...tw,
              depositAmount: totalAmount.toString()
            };
          });
          return {
            id: strategyId,
            strategy: strategyId,
            tokenWeights,
            validatorBalanceWeight: strategy.validatorBalanceWeight || 0,
            tokens: strategy.tokens || {}
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
              depositAmount: tw.depositAmount || "0"
            }))
          };
          depositsMap.set(strategyId, mockDeposits);
        }
      }
      setSimulationStrategies(processedStrategies as UIStrategy[]);
      setSimulationStrategyDeposits(depositsMap);
      setSimulationDataEdited(false);
    } catch (error) {
      console.error('Error fetching simulation strategies:', error);
    } finally {
      setIsLoadingSimulationData(false);
    }
  };

  useEffect(() => {
    if (ENABLE_SIMULATION_TAB) {
      fetchSimulationStrategies();
    }
  }, [simulationConfig.bAppId]); // Only reload when BApp ID changes, not when token coefficients change

  // Refresh simulation strategies when switching to the simulation tab
  useEffect(() => {
    if (activeTabIndex === 1) {
      // Only fetch if simulation tab is active
      if (ENABLE_SIMULATION_TAB) {
        fetchSimulationStrategies();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabIndex, simulationConfig.bAppId]);

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
      if (ENABLE_SIMULATION_TAB) {
        fetchSimulationDelegatedBalances();
      }
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
    const calculateWeights = async () => {
      // For simulation tab, use the same participant weight calculation logic as the SDK
      if (simulationStrategies.length > 0 && simulationConfig.tokenCoefficients.length > 0) {
        // Filter strategies that have tokens
        const strategiesWithTokens = simulationStrategies.filter((strategy: any) => 
          strategy.tokenWeights && strategy.tokenWeights.length > 0 &&
          strategy.tokenWeights.some((tw: any) => tw.depositAmount && tw.depositAmount !== "0")
        );
        
        if (strategiesWithTokens.length === 0) {
          setSimulationWeights(new Map());
          return;
        }
        
        // Only show loading for data that has been edited (not initial load)
        if (simulationDataEdited) {
          setIsCalculatingSimulationWeights(true);
          toast({
            id: 'simulation-calculating',
            title: "Recalculating percentages...",
            description: "Computing new strategy weights",
            status: 'info',
            duration: null, // Don't auto-dismiss
            isClosable: false,
            position: 'bottom-right',
          });
        }
        
        try {
          let weightResults: Map<string, number>;
          // Step 1: Use mocked SDK to calculate participant weights based on edited amounts
          const simulationParticipantWeights = await getParticipantWeights(
            simulationConfig.bAppId,
            strategiesWithTokens
          );
          // Step 2: Use SDK calculation with our custom participant weights
          const options = {
            coefficients: simulationConfig.tokenCoefficients,
            validatorCoefficient: simulationConfig.validatorCoefficient
          };
          // Use SDK calculation with our custom participant weights (same flow as calculator)
          weightResults = calculateStrategyWeights(
            simulationParticipantWeights as any,
            options,
            simulationConfig.calculationType
          );
          
          setSimulationWeights(weightResults);
          
          // Show success toast if this was for edited data
          if (simulationDataEdited) {
            toast.close('simulation-calculating');
            toast({
              title: "Percentages updated!",
              description: `New ${simulationConfig.calculationType} weights calculated`,
              status: 'success',
              duration: 2000,
              isClosable: true,
              position: 'bottom-right',
            });
          }
          
        } catch (error) {
          console.error('🔍 [Simulation] Error calculating simulation weights:', error);
          console.error('🔍 [Simulation] Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
          setSimulationWeights(new Map());
          
          // Show error toast if this was for edited data
          if (simulationDataEdited) {
            toast.close('simulation-calculating');
            toast({
              title: "Calculation failed",
              description: "Error computing strategy weights",
              status: 'error',
              duration: 4000,
              isClosable: true,
              position: 'bottom-right',
            });
          }
        } finally {
          setIsCalculatingSimulationWeights(false);
        }
      } else {
        setSimulationWeights(new Map());
      }
    };
    
    calculateWeights();
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
    
    // Show immediate feedback that calculation will start
    if (!isCalculatingSimulationWeights) {
      toast({
        title: "Data updated",
        description: "Recalculating percentages...",
        status: 'info',
        duration: 1000,
        isClosable: true,
        position: 'bottom-right',
      });
    }
  };

  // Handler for when a new token is added in simulation mode
  const handleTokenAdded = (tokenAddress: string) => {
    // Add the new token to all existing strategies with 0 as default
    const updatedStrategies = simulationStrategies.map(strategy => ({
      ...strategy,
      tokenWeights: [
        ...(strategy.tokenWeights || []),
        {
          token: tokenAddress,
          weight: 0,
          depositAmount: "0"
        }
      ]
    }));
    
    setSimulationStrategies(updatedStrategies);
    setSimulationDataEdited(true);
    
    // Update the relevant tokens set to include the new token
    setSimulationRelevantTokens(prev => new Set([...prev, tokenAddress.toLowerCase()]));
    
    toast({
      title: "Token Added",
      description: `New token ${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)} added to all strategies`,
      status: 'success',
      duration: 3000,
      isClosable: true,
      position: 'bottom-right',
    });
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
            relevantTokens={relevantTokens}
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
              relevantTokens={relevantTokens}
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
  ) => {
    return (
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
              relevantTokens={simulationRelevantTokens}
              onTokenAdded={handleTokenAdded}
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
                relevantTokens={simulationRelevantTokens}
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
                isLoading={isCalculatingSimulationWeights}
              />
            </VStack>
          </Box>
        </VStack>
      </VStack>
    );
  };

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
      <Box minH="100vh" bg="linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)" overflowX="hidden" w="100%" position="relative">
        {/* GitHub Badge */}
        <Link
          href="https://github.com/taylorferran/ssv-strategy-weights"
          isExternal
          position="absolute"
          top={4}
          right={4}
          zIndex={10}
          bg="rgba(255, 255, 255, 0.2)"
          color="white"
          p={3}
          borderRadius="full"
          _hover={{
            bg: "rgba(255, 255, 255, 0.3)",
            transform: "translateY(-2px)",
          }}
          transition="all 0.2s ease"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
          </svg>
        </Link>
        
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
          <Tabs size="lg" variant="soft-rounded" colorScheme="whiteAlpha" isLazy
            onChange={setActiveTabIndex}
            index={0}
          >
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
              {ENABLE_SIMULATION_TAB && (
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
              )}
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
              {ENABLE_SIMULATION_TAB && (
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
              )}
            </TabPanels>
          </Tabs>
        </Box>
      </Box>
    </ChakraProvider>
  );
}

export default App;
