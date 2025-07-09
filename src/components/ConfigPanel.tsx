import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Select,
  VStack,
  HStack,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Divider,
  Text,
  IconButton,
  Flex,
  Badge,
  SimpleGrid,
  Spinner,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
} from '@chakra-ui/react';
import { useEffect } from 'react';
import { DeleteIcon, AddIcon } from '@chakra-ui/icons';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { formatEther, parseEther } from 'viem';
import type { BAppConfig, TokenCoefficient } from '../types';

interface ConfigPanelProps {
  config: BAppConfig;
  onConfigChange: (config: BAppConfig) => void;
  onAddRandomStrategy: () => void;
  strategies?: any[];
  deposits?: Map<string, any>;
  delegatedBalances?: any;
  isSimulation?: boolean;
  onDelegatedBalanceChange?: (strategyId: string, newBalance: string) => void;
  isLoadingData?: boolean;
}

const ConfigPanel = ({ config, onConfigChange, onAddRandomStrategy, strategies = [], deposits, delegatedBalances, isSimulation = false, onDelegatedBalanceChange, isLoadingData = false }: ConfigPanelProps) => {
  // Calculate total tokens deposited by token type across all strategies
  const calculateTokenTotals = (): { [tokenAddress: string]: string } => {
    try {
      const tokenTotals: { [tokenAddress: string]: bigint } = {};
      
      if (isSimulation) {
        // In simulation mode, calculate totals from current user-editable data
        strategies.forEach((strategy: any) => {
          if (strategy.tokenWeights && strategy.tokenWeights.length > 0) {
            strategy.tokenWeights.forEach((tw: any) => {
              if (tw.token && tw.depositAmount && tw.depositAmount !== "0") {
                try {
                  if (!tokenTotals[tw.token]) {
                    tokenTotals[tw.token] = 0n;
                  }
                  tokenTotals[tw.token] += BigInt(tw.depositAmount);
                } catch (error) {
                  console.error('Error parsing simulation token amount:', error);
                }
              }
            });
          }
        });
      } else {
        // Original calculator mode logic
        // Sum up token deposits by token type from all strategies
        if (deposits && deposits.size > 0) {
          for (const [_, strategyDeposits] of deposits.entries()) {
            if (strategyDeposits?.deposits) {
              strategyDeposits.deposits.forEach((deposit: any) => {
                if (deposit.depositAmount || deposit.amount) {
                  const amount = deposit.depositAmount || deposit.amount;
                  const tokenAddress = deposit.token;
                  
                  if (!tokenTotals[tokenAddress]) {
                    tokenTotals[tokenAddress] = 0n;
                  }
                  tokenTotals[tokenAddress] += BigInt(amount || "0");
                }
              });
            }
          }
        }
        
        // Also check strategies that have tokens directly (for UI format)
        strategies.forEach(strategy => {
          if (strategy.tokens) {
            Object.entries(strategy.tokens).forEach(([tokenAddress, tokenData]: [string, any]) => {
              if (tokenData.amount && tokenData.amount !== "0") {
                try {
                  if (!tokenTotals[tokenAddress]) {
                    tokenTotals[tokenAddress] = 0n;
                  }
                  tokenTotals[tokenAddress] += parseEther(tokenData.amount);
                } catch (error) {
                  console.error('Error parsing token amount:', error);
                }
              }
            });
          }
        });
      }
      
      // Convert to formatted strings
      const formattedTotals: { [tokenAddress: string]: string } = {};
      Object.entries(tokenTotals).forEach(([tokenAddress, total]) => {
        formattedTotals[tokenAddress] = parseFloat(formatEther(total)).toFixed(2);
      });
      
      return formattedTotals;
    } catch (error) {
      console.error('Error calculating token totals:', error);
      return {};
    }
  };

  // Helper function to get token display name
  const getTokenDisplayName = (tokenAddress: string): string => {
    if (tokenAddress === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") {
      return "ETH";
    }
    if (tokenAddress === "0x9f5d4ec84fc4785788ab44f9de973cf34f7a038e") {
      return "SSV";
    }
    return `${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}`;
  };

  // Get total delegated balance for the BApp
  const getTotalDelegatedBalance = (): string => {
    try {
      if (delegatedBalances?.bAppTotalDelegatedBalance) {
        return parseFloat(formatEther(BigInt(delegatedBalances.bAppTotalDelegatedBalance))).toFixed(2);
      }
      return "0.00";
    } catch (error) {
      console.error('Error getting total delegated balance:', error);
      return "0.00";
    }
  };

  // Get the LaTeX formula for the current calculation type
  const getFormulaLatex = (calculationType: string) => {
    switch (calculationType) {
      case 'arithmetic':
        return '\\bar{x} = \\frac{\\sum_{i=1}^{n} w_i x_i}{\\sum_{i=1}^{n} w_i}';
      case 'geometric':
        return '\\exp\\left(\\frac{\\sum_{i=1}^{n} w_i \\ln x_i}{\\sum_{i=1}^{n} w_i}\\right)';
      case 'harmonic':
        return 'H = \\frac{\\sum w_i}{\\sum \\frac{w_i}{x_i}} = \\left(\\frac{\\sum w_i x_i^{-1}}{\\sum w_i}\\right)^{-1}';
      default:
        return '';
    }
  };

  // Get the description for the current calculation type
  const getFormulaDescription = (calculationType: string) => {
    switch (calculationType) {
      case 'arithmetic':
        return 'Weighted arithmetic mean of strategy values';
      case 'geometric':
        return 'Weighted geometric mean of strategy values';
      case 'harmonic':
        return 'Weighted harmonic mean of strategy values';
      default:
        return '';
    }
  };

  // Extract unique tokens from strategies
  const getUniqueTokensFromStrategies = () => {
    const tokenSet = new Set<string>();
    
    console.log('🔍 [ConfigPanel] Processing strategies for token detection:', strategies);
    console.log('🔍 [ConfigPanel] Number of strategies:', strategies.length);

    
    strategies.forEach((strategy, idx) => {
      console.log(`🔍 [ConfigPanel] Strategy ${idx}:`, strategy);
      
      if (isSimulation) {
        // In simulation mode, prioritize tokenWeights as it contains current user data
        if (strategy.tokenWeights && strategy.tokenWeights.length > 0) {
          strategy.tokenWeights.forEach((tw: any) => {
            if (tw.token) {
              console.log(`🔍 [ConfigPanel] Adding token from tokenWeights:`, tw.token);
              tokenSet.add(tw.token);
            }
          });
        } else if (strategy.tokens && Object.keys(strategy.tokens).length > 0) {
          // Fallback to tokens object
          console.log(`🔍 [ConfigPanel] Strategy ${idx} tokens (fallback):`, strategy.tokens);
          Object.keys(strategy.tokens).forEach(token => {
            console.log(`🔍 [ConfigPanel] Adding token from tokens object:`, token);
            tokenSet.add(token);
          });
        }
      } else {
        // In calculator mode, prioritize tokens object over empty tokenWeights
        if (strategy.tokens && Object.keys(strategy.tokens).length > 0) {
          // Handle StrategyTokenWeight format (calculator tab)
          console.log(`🔍 [ConfigPanel] Strategy ${idx} tokens (calculator):`, strategy.tokens);
          Object.keys(strategy.tokens).forEach(token => {
            console.log(`🔍 [ConfigPanel] Adding token from tokens object:`, token);
            tokenSet.add(token);
          });
        } else if (strategy.tokenWeights && strategy.tokenWeights.length > 0) {
          // Handle UIStrategy format fallback
          console.log(`🔍 [ConfigPanel] Strategy ${idx} tokenWeights (fallback):`, strategy.tokenWeights);
          strategy.tokenWeights.forEach((tw: any) => {
            if (tw.token) {
              console.log(`🔍 [ConfigPanel] Adding token:`, tw.token);
              tokenSet.add(tw.token);
            }
          });
        }
      }
      
      if (tokenSet.size === 0) {
        console.log(`🔍 [ConfigPanel] Strategy ${idx} has no tokens in either format`);
      }
    });
    
    const tokens = Array.from(tokenSet);
    console.log('🔍 [ConfigPanel] Final detected tokens:', tokens);
    return tokens;
  };

  // Update coefficients for detected tokens (works for both calculator and simulation modes)
  const ensureCoefficientsForDetectedTokens = () => {
    
    const detectedTokens = getUniqueTokensFromStrategies();
    console.log('🔍 [ConfigPanel] Detected tokens from strategies:', detectedTokens);
    console.log('🔍 [ConfigPanel] Current token coefficients:', config.tokenCoefficients);
    
    // Only proceed if we have detected tokens and they're different from current ones
    if (detectedTokens.length === 0) {
      console.log('🔍 [ConfigPanel] No tokens detected, skipping coefficient update');
      return;
    }
    
    const currentTokens = config.tokenCoefficients.map(tc => tc.token as string);
    const tokensChanged = detectedTokens.length !== currentTokens.length || 
                         !detectedTokens.every(token => currentTokens.includes(token));
    
    console.log('🔍 [ConfigPanel] Current tokens:', currentTokens);
    console.log('🔍 [ConfigPanel] Tokens changed:', tokensChanged);
    
    if (tokensChanged) {
      // Replace with only detected tokens, preserving existing coefficients where possible
      const newCoefficients = detectedTokens.map(token => {
        const existingCoeff = config.tokenCoefficients.find(tc => tc.token === token);
        return {
          token: token as any,
          coefficient: existingCoeff?.coefficient ?? 1 // Use existing coefficient or default to 1
        };
      });
      
      console.log('🔍 [ConfigPanel] Updating coefficients:', newCoefficients);
      onConfigChange({ ...config, tokenCoefficients: newCoefficients });
    }
  };

  // Run this effect when strategies change (both calculator and simulation modes)
  // Only run when we first load strategies, not during editing
  useEffect(() => {
    // Auto-detect tokens when we have strategies
    if (strategies.length > 0) {
      ensureCoefficientsForDetectedTokens();
    }
  }, [strategies, isSimulation]);

  const handleBAppIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onConfigChange({ ...config, bAppId: e.target.value });
  };

  const handleCalculationTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onConfigChange({ ...config, calculationType: e.target.value as BAppConfig['calculationType'] });
  };

  const handleValidatorCoefficientChange = (value: string) => {
    onConfigChange({ ...config, validatorCoefficient: Number(value) });
  };

  const handleTokenCoefficientChange = (index: number, field: keyof TokenCoefficient, value: string) => {
    const newCoefficients = [...config.tokenCoefficients];
    newCoefficients[index] = {
      ...newCoefficients[index],
      [field]: field === 'coefficient' ? Number(value) : value,
    };
    onConfigChange({ ...config, tokenCoefficients: newCoefficients });
  };

  const addTokenCoefficient = () => {
    onConfigChange({
      ...config,
      tokenCoefficients: [
        ...config.tokenCoefficients,
        { token: '0x0000000000000000000000000000000000000000', coefficient: 1 },
      ],
    });
  };

  const removeTokenCoefficient = (index: number) => {
    const newCoefficients = config.tokenCoefficients.filter((_, i) => i !== index);
    onConfigChange({ ...config, tokenCoefficients: newCoefficients });
  };

  return (
    <VStack spacing={8} w="100%" align="stretch">
      {/* BApp Totals Display */}
        <Box 
          bg="gradient.50" 
          borderRadius="xl" 
          p={6} 
          border="1px solid" 
          borderColor="gray.200"
        >
          <Text fontSize="lg" fontWeight="bold" color="ssv.700" mb={4} textAlign="center">
            BApp Overview
          </Text>
          <VStack spacing={4}>
            {/* Token Totals by Type */}
            <Box w="100%">
              <Text fontSize="md" fontWeight="semibold" color="gray.700" mb={3} textAlign="center">
                Total Tokens Deposited by Type
              </Text>
              {isLoadingData ? (
                <Flex justify="center" align="center" py={8}>
                  <VStack spacing={3}>
                    <Spinner color="ssv.500" size="lg" />
                    <Text color="gray.500" fontSize="sm">Loading token data...</Text>
                  </VStack>
                </Flex>
              ) : (() => {
                const tokenTotals = calculateTokenTotals();
                const tokenEntries = Object.entries(tokenTotals);
                
                if (tokenEntries.length === 0) {
                  return (
                    <Text color="gray.500" fontSize="sm" textAlign="center">
                      No tokens deposited
                    </Text>
                  );
                }
                
                return (
                  <SimpleGrid columns={{ base: 1, md: tokenEntries.length <= 2 ? tokenEntries.length : 3 }} spacing={4}>
                    {tokenEntries.map(([tokenAddress, total]) => (
                      <Stat key={tokenAddress} textAlign="center" bg="white" p={3} borderRadius="lg" border="1px solid" borderColor="gray.200">
                        <StatLabel color="gray.600" fontSize="xs" fontWeight="medium">
                          {getTokenDisplayName(tokenAddress)}
                        </StatLabel>
                        <StatNumber color="green.600" fontSize="lg" fontWeight="bold">
                          {total}
                        </StatNumber>
                        <StatHelpText color="gray.500" fontSize="xs">
                          Total deposited
                        </StatHelpText>
                      </Stat>
                    ))}
                  </SimpleGrid>
                );
              })()}
            </Box>
            
            {/* Delegated Balance */}
            <Box w="100%">
              <Stat textAlign="center" bg="white" p={4} borderRadius="lg" border="1px solid" borderColor="gray.200">
                <StatLabel color="gray.600" fontSize="sm" fontWeight="medium">
                  Total Delegated Balance
                </StatLabel>
                {isLoadingData ? (
                  <Flex justify="center" align="center" py={4}>
                    <VStack spacing={2}>
                      <Spinner color="blue.500" size="md" />
                      <Text color="gray.500" fontSize="xs">Loading...</Text>
                    </VStack>
                  </Flex>
                ) : (
                  <>
                    <StatNumber color="blue.600" fontSize="2xl" fontWeight="bold">
                      {getTotalDelegatedBalance()}
                    </StatNumber>
                    <StatHelpText color="gray.500" fontSize="xs">
                      BApp total delegation amount
                    </StatHelpText>
                  </>
                )}
              </Stat>
            </Box>
          </VStack>
        </Box>

      {/* Basic Configuration */}
      <VStack spacing={6} align="stretch">
        <FormControl>
          <FormLabel color="ssv.600" fontWeight="semibold" fontSize="md" mb={3}>
            BApp ID
          </FormLabel>
          <Input 
            value={config.bAppId} 
            onChange={handleBAppIdChange} 
            size="lg" 
            fontSize="sm"
            bg="gray.50"
            border="2px solid"
            borderColor="gray.200"
            _hover={{ borderColor: "ssv.300" }}
            _focus={{ borderColor: "ssv.500", bg: "white" }}
            borderRadius="xl"
            fontFamily="mono"
          />
        </FormControl>

        <HStack spacing={6} align="end">
          <FormControl flex={2}>
            <FormLabel color="ssv.600" fontWeight="semibold" fontSize="md" mb={3}>
              Calculation Type
            </FormLabel>
            <Select 
              value={config.calculationType} 
              onChange={handleCalculationTypeChange} 
              size="lg" 
              fontSize="sm"
              bg="gray.50"
              border="2px solid"
              borderColor="gray.200"
              _hover={{ borderColor: "ssv.300" }}
              _focus={{ borderColor: "ssv.500", bg: "white" }}
              borderRadius="xl"
            >
              <option value="arithmetic">Arithmetic</option>
              <option value="geometric">Geometric</option>
              <option value="harmonic">Harmonic</option>
            </Select>
          </FormControl>

          <FormControl flex={1}>
            <FormLabel color="ssv.600" fontWeight="semibold" fontSize="md" mb={3}>
              Validator Coefficient
            </FormLabel>
            <NumberInput
              value={config.validatorCoefficient}
              onChange={handleValidatorCoefficientChange}
              min={0}
              size="lg"
            >
              <NumberInputField 
                fontSize="sm"
                bg="gray.50"
                border="2px solid"
                borderColor="gray.200"
                _hover={{ borderColor: "ssv.300" }}
                _focus={{ borderColor: "ssv.500", bg: "white" }}
                borderRadius="xl"
              />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </FormControl>
        </HStack>

        {/* Formula Display */}
        {getFormulaLatex(config.calculationType) && (
          <Box 
            p={4} 
            bg="blue.50" 
            borderRadius="xl" 
            border="1px solid" 
            borderColor="blue.200"
            mt={4}
          >
            <VStack spacing={3} align="center">
              <Text fontSize="sm" color="blue.700" fontWeight="medium">
                {getFormulaDescription(config.calculationType)}
              </Text>
              <Box 
                p={3} 
                bg="white" 
                borderRadius="lg" 
                border="1px solid" 
                borderColor="blue.100"
                w="100%"
                textAlign="center"
              >
                <BlockMath math={getFormulaLatex(config.calculationType)} />
              </Box>
              <Text fontSize="xs" color="blue.600">
                Where <InlineMath math="w_i" /> = weight, <InlineMath math="x_i" /> = strategy value, <InlineMath math="n" /> = number of strategies
              </Text>
            </VStack>
          </Box>
        )}
      </VStack>

      <Divider borderColor="gray.200" />

      {/* Token Coefficients */}
      <VStack spacing={6} align="stretch">
        <Flex justify="space-between" align="center">
          <Text color="ssv.600" fontWeight="semibold" fontSize="md">
            {isSimulation ? "Token Coefficients" : "Strategy Token Coefficients"}
          </Text>
          <HStack spacing={2}>
            <Badge colorScheme="ssv" fontSize="xs" px={2} py={1} borderRadius="md">
              {config.tokenCoefficients.length} tokens
            </Badge>

          </HStack>
        </Flex>
        
        <VStack spacing={4} align="stretch">
          {config.tokenCoefficients.map((coefficient, index) => (
            <Box key={index} p={4} bg="gray.50" borderRadius="xl" border="1px solid" borderColor="gray.200">
              <HStack spacing={4} align="end">
                <FormControl flex={3}>
                  <FormLabel color="gray.600" fontWeight="medium" fontSize="sm" mb={2}>
                    Token Address
                  </FormLabel>
                  {isSimulation ? (
                    <Input
                      value={coefficient.token}
                      onChange={(e) => handleTokenCoefficientChange(index, 'token', e.target.value)}
                      placeholder="0x..."
                      size="md"
                      fontSize="xs"
                      fontFamily="mono"
                      bg="white"
                      border="1px solid"
                      borderColor="gray.300"
                      _hover={{ borderColor: "ssv.300" }}
                      _focus={{ borderColor: "ssv.500" }}
                      borderRadius="lg"
                    />
                  ) : (
                    <Input
                      value={coefficient.token}
                      size="md"
                      fontSize="xs"
                      fontFamily="mono"
                      bg="gray.100"
                      border="1px solid"
                      borderColor="gray.300"
                      borderRadius="lg"
                      isReadOnly
                      _hover={{}}
                      _focus={{}}
                    />
                  )}
                </FormControl>
                <FormControl flex={1}>
                  <FormLabel color="gray.600" fontWeight="medium" fontSize="sm" mb={2}>
                    Coefficient
                  </FormLabel>
                  <NumberInput
                    value={coefficient.coefficient}
                    onChange={(value) => handleTokenCoefficientChange(index, 'coefficient', value)}
                    min={0}
                    size="md"
                  >
                    <NumberInputField 
                      fontSize="sm"
                      bg="white"
                      border="1px solid"
                      borderColor="gray.300"
                      _hover={{ borderColor: "ssv.300" }}
                      _focus={{ borderColor: "ssv.500" }}
                      borderRadius="lg"
                    />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>
                {isSimulation && (
                  <IconButton
                    aria-label="Remove token"
                    icon={<DeleteIcon />}
                    colorScheme="red"
                    variant="ghost"
                    size="md"
                    onClick={() => removeTokenCoefficient(index)}
                  />
                )}
              </HStack>
            </Box>
          ))}
          
          {isSimulation && (
            <Button 
              onClick={addTokenCoefficient} 
              colorScheme="ssv" 
              variant="outline"
              size="lg"
              leftIcon={<AddIcon />}
              borderRadius="xl"
              _hover={{ bg: "ssv.50" }}
            >
              Add Token
            </Button>
          )}
        </VStack>
      </VStack>


    </VStack>
  );
};

export default ConfigPanel; 