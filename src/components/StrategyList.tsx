import {
  Box,
  Text,
  Badge,
  VStack,
  HStack,
  Card,
  CardBody,
  SimpleGrid,
  Divider,
  Flex,
  Spacer,
  Code,
  Button,
  IconButton,
  Input,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  useToast,
} from '@chakra-ui/react';
import { AddIcon, DeleteIcon, EditIcon } from '@chakra-ui/icons';
import { formatEther, parseEther } from 'viem';
import { useState } from 'react';

interface StrategyListProps {
  strategies: any[];
  deposits?: Map<string, any>;
  editable?: boolean;
  onStrategiesChange?: (strategies: any[]) => void;
  isSimulation?: boolean;
}

const StrategyList = ({ strategies, deposits, editable = false, onStrategiesChange, isSimulation = false }: StrategyListProps) => {
  // Debug logging (can be removed later)
  console.log('🔍 [StrategyList] Component rendered with:', {
    strategiesLength: strategies?.length || 0,
    depositsSize: deposits?.size || 0,
    editable,
    hasOnStrategiesChange: !!onStrategiesChange,
    firstStrategy: strategies?.[0] || null
  });
  
  const hasRows = strategies && strategies.length > 0;
  const toast = useToast();

  // Helper function to get deposit amount for a token in a strategy
  const getDepositAmount = (strategy: any, tokenAddress: string): string => {
    try {
      console.log('🔍 [getDepositAmount] Called with:', { strategyId: strategy.id || strategy.strategy, tokenAddress });
      
      // First try to get from the strategy's tokenWeight (for simulation/edited data)
      const tokenWeight = strategy.tokenWeights?.find((tw: any) => 
        tw.token.toLowerCase() === tokenAddress.toLowerCase()
      );
      
      if (tokenWeight?.depositAmount && tokenWeight.depositAmount !== "0") {
        console.log('🔍 [getDepositAmount] Using tokenWeight.depositAmount:', tokenWeight.depositAmount);
        return tokenWeight.depositAmount;
      }
      
      // If not found or is zero, try to get from deposits data (for initial API data)
      const strategyId = (strategy.id || strategy.strategy)?.toString();
      
      if (strategyId && deposits?.has(strategyId)) {
        const strategyDeposits = deposits.get(strategyId);
        console.log('🔍 [getDepositAmount] Found strategyDeposits:', strategyDeposits);
        
        const deposit = strategyDeposits?.deposits?.find((dep: any) => 
          dep.token.toLowerCase() === tokenAddress.toLowerCase()
        );
        console.log('🔍 [getDepositAmount] Found deposit:', deposit);
        
        // SDK returns depositAmount field, not amount
        if (deposit?.depositAmount) {
          console.log('🔍 [getDepositAmount] Using deposit.depositAmount:', deposit.depositAmount);
          return deposit.depositAmount;
        }
        
        // Fallback to amount field if depositAmount doesn't exist
        if (deposit?.amount) {
          console.log('🔍 [getDepositAmount] Using deposit.amount:', deposit.amount);
          return deposit.amount;
        }
      }
      
      // Finally, try to get from the original API data structure (for calculator tab)
      if (strategy.tokens && strategy.tokens[tokenAddress]) {
        const amount = strategy.tokens[tokenAddress].amount || "0";
        console.log('🔍 [getDepositAmount] Using strategy.tokens amount:', amount);
        return amount;
      }
      
      console.log('🔍 [getDepositAmount] Returning default 0');
      return "0";
    } catch (error) {
      console.error('🔍 [getDepositAmount] Error:', error);
      return "0";
    }
  };

  // Test getDepositAmount for first strategy and token if available
  if (strategies?.length > 0 && strategies[0]?.tokenWeights?.length > 0) {
    const testStrategy = strategies[0];
    const testToken = testStrategy.tokenWeights[0].token;
    console.log('🔍 [StrategyList] Testing getDepositAmount for:', { testStrategy, testToken });
    const testAmount = getDepositAmount(testStrategy, testToken);
    console.log('🔍 [StrategyList] Test deposit amount result:', testAmount);
  }

  // Helper functions for editing
  const handleAddStrategy = () => {
    if (!onStrategiesChange) return;
    
    const newStrategy = {
      id: Date.now(), // Use timestamp as temp ID
      strategy: Date.now(), // Also set strategy field for compatibility
      tokenWeights: [
        {
          token: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", // ETH
          weight: 100,
          depositAmount: parseEther("1.0").toString() // Default to 1 ETH
        }
      ],
      validatorBalanceWeight: 100 // Default validator balance
    };
    
    onStrategiesChange([...strategies, newStrategy]);
    toast({
      title: "Strategy Added",
      description: "New strategy has been added successfully",
      status: "success",
      duration: 2000,
      isClosable: true,
    });
  };

  const handleRemoveStrategy = (strategyIndex: number) => {
    if (!onStrategiesChange) return;
    
    const updatedStrategies = strategies.filter((_, index) => index !== strategyIndex);
    onStrategiesChange(updatedStrategies);
    toast({
      title: "Strategy Removed",
      description: "Strategy has been removed successfully",
      status: "info",
      duration: 2000,
      isClosable: true,
    });
  };

  const handleUpdateDepositAmount = (strategyIndex: number, tokenIndex: number, newAmount: string) => {
    if (!onStrategiesChange) return;
    
    const updatedStrategies = [...strategies];
    // Store the deposit amount (in wei format for consistency)
    if (!updatedStrategies[strategyIndex].tokenWeights[tokenIndex].depositAmount) {
      updatedStrategies[strategyIndex].tokenWeights[tokenIndex].depositAmount = "0";
    }
    updatedStrategies[strategyIndex].tokenWeights[tokenIndex].depositAmount = newAmount;
    onStrategiesChange(updatedStrategies);
  };

  const handleUpdateTokenAddress = (strategyIndex: number, tokenIndex: number, newAddress: string) => {
    if (!onStrategiesChange) return;
    
    const updatedStrategies = [...strategies];
    updatedStrategies[strategyIndex].tokenWeights[tokenIndex].token = newAddress;
    onStrategiesChange(updatedStrategies);
  };

  const handleUpdateValidatorBalance = (strategyIndex: number, newBalance: number) => {
    if (!onStrategiesChange) return;
    
    const updatedStrategies = [...strategies];
    updatedStrategies[strategyIndex].validatorBalanceWeight = newBalance;
    onStrategiesChange(updatedStrategies);
  };

  const handleAddToken = (strategyIndex: number) => {
    if (!onStrategiesChange) return;
    
    console.log('🚀 [DEBUG-ADD-TOKEN] Adding token to strategy', strategyIndex);
    console.log('🚀 [DEBUG-ADD-TOKEN] Current strategies before add:', strategies);
    console.log('🚀 [DEBUG-ADD-TOKEN] Target strategy before add:', strategies[strategyIndex]);
    console.log('🚀 [DEBUG-ADD-TOKEN] Current token count:', strategies[strategyIndex].tokenWeights.length);
    
    const updatedStrategies = [...strategies];
    const newToken = {
      token: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", // Default to ETH
      weight: 0,
      depositAmount: parseEther("1.0").toString() // Default to 1 ETH in wei
    };
    
    console.log('🚀 [DEBUG-ADD-TOKEN] New token being added:', newToken);
    console.log('🚀 [DEBUG-ADD-TOKEN] Deposit amount in wei:', newToken.depositAmount);
    console.log('🚀 [DEBUG-ADD-TOKEN] Deposit amount in ETH:', formatEther(BigInt(newToken.depositAmount)));
    
    updatedStrategies[strategyIndex].tokenWeights.push(newToken);
    
    console.log('🚀 [DEBUG-ADD-TOKEN] Updated strategy after token add:', updatedStrategies[strategyIndex]);
    console.log('🚀 [DEBUG-ADD-TOKEN] New token count:', updatedStrategies[strategyIndex].tokenWeights.length);
    console.log('🚀 [DEBUG-ADD-TOKEN] All token weights:', updatedStrategies[strategyIndex].tokenWeights);
    console.log('🚀 [DEBUG-ADD-TOKEN] All updated strategies:', updatedStrategies);
    
    console.log('🚀 [DEBUG-ADD-TOKEN] Calling onStrategiesChange...');
    onStrategiesChange(updatedStrategies);
    
    toast({
      title: "Token Added",
      description: "New token has been added to the strategy",
      status: "success",
      duration: 2000,
      isClosable: true,
    });
  };

  const handleRemoveToken = (strategyIndex: number, tokenIndex: number) => {
    if (!onStrategiesChange) return;
    
    const updatedStrategies = [...strategies];
    updatedStrategies[strategyIndex].tokenWeights = updatedStrategies[strategyIndex].tokenWeights.filter((_: any, index: number) => index !== tokenIndex);
    onStrategiesChange(updatedStrategies);
  };

  const handleUpdateTokenWeight = (strategyIndex: number, tokenIndex: number, field: 'weight' | 'depositAmount', value: any) => {
    if (!onStrategiesChange) return;
    
    console.log('🔍 [handleUpdateTokenWeight] Called with:', { strategyIndex, tokenIndex, field, value });
    
    const updatedStrategies = [...strategies];
    const oldValue = updatedStrategies[strategyIndex].tokenWeights[tokenIndex][field];
    updatedStrategies[strategyIndex].tokenWeights[tokenIndex][field] = value;
    
    console.log('🔍 [handleUpdateTokenWeight] Updated:', { oldValue, newValue: value });
    console.log('🔍 [handleUpdateTokenWeight] Updated token weight:', updatedStrategies[strategyIndex].tokenWeights[tokenIndex]);
    
    onStrategiesChange(updatedStrategies);
  };

  if (!hasRows) {
    return (
      <Box textAlign="center" py={12}>
        <Text color="gray.400" fontSize="lg" mb={4}>
          No strategies found for this BApp ID
        </Text>
        {editable && (
          <Button
            leftIcon={<AddIcon />}
            colorScheme="ssv"
            variant="outline"
            size="md"
            onClick={handleAddStrategy}
            mb={4}
          >
            Add New Strategy
          </Button>
        )}
        <Box bg="gray.50" borderRadius="xl" p={4} mt={6}>
          <Code display="block" whiteSpace="pre" fontSize="xs" color="gray.600">
            {JSON.stringify(strategies, null, 2)}
          </Code>
        </Box>
      </Box>
    );
  }

  return (
    <Box maxH="500px" overflowY="auto" px={2}>
      {editable && (
        <Button
          leftIcon={<AddIcon />}
          colorScheme="ssv"
          variant="outline"
          size="sm"
          onClick={handleAddStrategy}
          mb={4}
        >
          Add New Strategy
        </Button>
      )}
      <VStack spacing={4} align="stretch">
        {strategies.map((strategy, sIdx) => (
          <Card key={strategy.id || strategy.strategy || sIdx} variant="outline" borderRadius="xl" overflow="hidden">
            <CardBody p={6}>
              <VStack spacing={4} align="stretch">
                {/* Strategy Header */}
                <Flex align="center" mb={2}>
                  <Badge 
                    colorScheme="ssv" 
                    fontSize="sm" 
                    px={3} 
                    py={1} 
                    borderRadius="lg"
                    fontWeight="bold"
                  >
                    Strategy #{strategy.id || strategy.strategy}
                  </Badge>
                  <Spacer />
                  <Text fontSize="sm" color="gray.500" fontWeight="medium">
                    {strategy.tokenWeights.length} tokens
                  </Text>
                  {editable && (
                    <IconButton
                      aria-label="Remove strategy"
                      icon={<DeleteIcon />}
                      size="sm"
                      colorScheme="red"
                      variant="ghost"
                      onClick={() => handleRemoveStrategy(sIdx)}
                      ml={2}
                    />
                  )}
                </Flex>

                {/* Validator Balance Weight */}
                {(strategy.validatorBalanceWeight !== undefined && strategy.validatorBalanceWeight !== null) || editable ? (
                  <Box bg="ssv.50" borderRadius="lg" p={3}>
                    <HStack justify="space-between">
                      <Text fontSize="sm" fontWeight="semibold" color="ssv.600">
                        Validator Balance Weight
                      </Text>
                      {editable ? (
                        <NumberInput
                          value={strategy.validatorBalanceWeight || 0}
                          onChange={(_, valueAsNumber) => handleUpdateValidatorBalance(sIdx, isNaN(valueAsNumber) ? 0 : valueAsNumber)}
                          size="sm"
                          maxW="100px"
                          step={0.1}
                          precision={2}
                          min={0}
                        >
                          <NumberInputField />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                      ) : (
                        <Badge colorScheme="ssv" variant="subtle" fontSize="sm">
                          {strategy.validatorBalanceWeight}
                        </Badge>
                      )}
                    </HStack>
                  </Box>
                ) : null}

                <Divider />

                {/* Token Weights */}
                <VStack spacing={3} align="stretch">
                  <Text fontSize="sm" fontWeight="semibold" color="gray.600">
                    Token Weights
                  </Text>
                  
                  {strategy.tokenWeights.map((tokenWeight: any, tokenIndex: number) => (
                    <HStack key={tokenIndex} spacing={4} align="center">
                      <Text fontSize="sm" fontFamily="mono" minW="120px" color="gray.700">
                        {tokenWeight.token === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" 
                          ? "ETH" 
                          : `${tokenWeight.token.slice(0, 6)}...${tokenWeight.token.slice(-4)}`}
                      </Text>
                      
                      {editable ? (
                        <>
                          {/* Hide weight display in simulation mode since weights are calculated dynamically */}
                          {!isSimulation && (
                            <VStack spacing={1} flex={1}>
                              <Text fontSize="xs" color="gray.500">Weight</Text>
                              <Badge colorScheme="blue" variant="subtle">
                                {tokenWeight.weight}
                              </Badge>
                            </VStack>
                          )}
                          
                          <VStack spacing={1} flex={1}>
                            <Text fontSize="xs" color="gray.500">Deposit Amount (ETH)</Text>
                            <Input
                              key={`${strategy.id || strategy.strategy}-${tokenIndex}-${tokenWeight.token}`}
                              type="number"
                              min="0"
                              step="0.000001"
                              value={(() => {
                                try {
                                  const amount = getDepositAmount(strategy, tokenWeight.token);
                                  const ethValue = formatEther(BigInt(amount || "0"));
                                  console.log('🔍 [Input] Current value:', { amount, ethValue });
                                  return ethValue;
                                } catch (error) {
                                  console.error('Error formatting deposit amount:', error);
                                  return "0";
                                }
                              })()}
                              onChange={(e) => {
                                const valueString = e.target.value;
                                console.log('🔍 [Input] onChange triggered:', { valueString });
                                try {
                                  // Allow empty string temporarily for editing
                                  if (valueString === "") {
                                    console.log('🔍 [Input] Empty value, setting to 0');
                                    handleUpdateTokenWeight(sIdx, tokenIndex, 'depositAmount', "0");
                                    return;
                                  }
                                  
                                  // Convert to number and validate
                                  const numValue = Number(valueString);
                                  if (!isNaN(numValue) && numValue >= 0) {
                                    const weiValue = parseEther(valueString).toString();
                                    console.log('🔍 [Input] Updating with wei value:', weiValue);
                                    handleUpdateTokenWeight(sIdx, tokenIndex, 'depositAmount', weiValue);
                                  } else if (numValue < 0) {
                                    console.log('🔍 [Input] Negative value, setting to 0');
                                    handleUpdateTokenWeight(sIdx, tokenIndex, 'depositAmount', "0");
                                  }
                                } catch (error) {
                                  console.error('Invalid ether value:', valueString, error);
                                  // For invalid input, set to 0 to prevent errors
                                  handleUpdateTokenWeight(sIdx, tokenIndex, 'depositAmount', "0");
                                }
                              }}
                              onFocus={(e) => {
                                // Select all text when focused to allow easy replacement
                                e.target.select();
                              }}
                              placeholder="0.0"
                              size="sm"
                              textAlign="center"
                            />
                          </VStack>
                        </>
                      ) : (
                        <>
                          <VStack spacing={1} flex={1}>
                            <Text fontSize="xs" color="gray.500">Weight</Text>
                            <Badge colorScheme="blue" variant="subtle">
                              {tokenWeight.weight}
                            </Badge>
                          </VStack>
                          
                          <VStack spacing={1} flex={1}>
                            <Text fontSize="xs" color="gray.500">Deposit Amount</Text>
                            <Badge colorScheme="green" variant="subtle">
                              {(() => {
                                try {
                                  const amount = getDepositAmount(strategy, tokenWeight.token);
                                  return formatEther(BigInt(amount || "0"));
                                } catch (error) {
                                  console.error('Error formatting deposit amount for display:', error);
                                  return "0";
                                }
                              })()} ETH
                            </Badge>
                          </VStack>
                        </>
                      )}
                    </HStack>
                  ))}
                  
                  {/* Add Token button - show in simulation mode */}
                  {editable && (
                    <Button
                      size="sm"
                      variant="outline"
                      colorScheme="blue"
                      leftIcon={<AddIcon />}
                      onClick={() => handleAddToken(sIdx)}
                    >
                      Add Token
                    </Button>
                  )}
                </VStack>
              </VStack>
            </CardBody>
          </Card>
        ))}
      </VStack>
    </Box>
  );
};

export default StrategyList; 