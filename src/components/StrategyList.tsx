import React from 'react';
import {
  Box,
  Text,
  Badge,
  VStack,
  HStack,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
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
  Heading,
} from '@chakra-ui/react';
import { DeleteIcon } from '@chakra-ui/icons';
import { formatEther, parseEther } from 'viem';
import { useState } from 'react';

interface StrategyListProps {
  strategies: any[];
  deposits?: Map<string, any>;
  delegatedBalances?: any;
  editable?: boolean;
  onStrategiesChange?: (strategies: any[]) => void;
  onDelegatedBalanceChange?: (strategyId: string, newBalance: string) => void;
  isSimulation?: boolean;
  weights?: Map<string, number>;
  tokenCoefficients?: any[];
  relevantTokens?: Set<string>;
}

const StrategyList = ({ strategies, deposits, delegatedBalances, editable = false, onStrategiesChange, onDelegatedBalanceChange, isSimulation = false, weights, tokenCoefficients = [], relevantTokens = new Set() }: StrategyListProps) => {
  const hasRows = strategies && strategies.length > 0;
  const toast = useToast();
  

  
  // Track input values during editing to allow free typing
  const [editingValues, setEditingValues] = useState<{[key: string]: string}>({});

  // Helper function to get deposit amount for a token in a strategy
  const getDepositAmount = (strategy: any, tokenAddress: string): string => {
    try {
      // First try to get from the strategy's tokenWeight (for simulation/edited data)
      const tokenWeight = strategy.tokenWeights?.find((tw: any) => 
        tw.token?.toLowerCase() === tokenAddress?.toLowerCase()
      );
      
      // If found in tokenWeights and has depositAmount, use that value
      if (tokenWeight && tokenWeight.depositAmount !== undefined) {
        return tokenWeight.depositAmount;
      }
      
      // Only fall back to other sources if not found in tokenWeights at all
      const strategyId = (strategy.id || strategy.strategy)?.toString();
      
      if (strategyId && deposits?.has(strategyId)) {
        const strategyDeposits = deposits.get(strategyId);
        
        const deposit = strategyDeposits?.deposits?.find((dep: any) => 
          dep.token.toLowerCase() === tokenAddress.toLowerCase()
        );
        
        // Sum all deposits for this token in this strategy
        const matchingDeposits = strategyDeposits.deposits.filter((dep: any) => 
          dep.token.toLowerCase() === tokenAddress.toLowerCase()
        );
        
        if (matchingDeposits.length > 0) {
          // Sum all deposit amounts for this token
          let totalDepositAmount = BigInt(0);
          
          for (const dep of matchingDeposits) {
            if (dep.depositAmount && dep.depositAmount !== "0") {
              totalDepositAmount += BigInt(dep.depositAmount);
            }
          }
          
          const totalDepositString = totalDepositAmount.toString();
          return totalDepositString;
        }
      }
      
      // Finally, try to get from the original API data structure (for calculator tab)
      // Note: strategy.tokens[tokenAddress].amount is in ether format, need to convert to wei
      if (strategy.tokens && strategy.tokens[tokenAddress]) {
        const amountInEther = strategy.tokens[tokenAddress].amount || "0";
        // Convert from ether to wei format to maintain consistency
        const amountInWei = parseEther(amountInEther).toString();
        return amountInWei;
      }
      
      return "0";
    } catch (error) {
      console.error('Error in getDepositAmount:', error);
      return "0";
    }
  };

  // Helper function to get token symbol or short address
  const getTokenDisplay = (tokenAddress: string) => {
    if (tokenAddress === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") {
      return "ETH";
    }
    if (tokenAddress === "0x9f5d4ec84fc4785788ab44f9de973cf34f7a038e") {
      return "SSV";
    }
    return `${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}`;
  };

  // Helper function to get delegated balance for a strategy
  const getDelegatedBalance = (strategy: any): string => {
    try {
      if (!delegatedBalances?.bAppTotalDelegatedBalances) {
        return "0";
      }
      
      const strategyId = (strategy.id || strategy.strategy)?.toString();
      const delegatedBalance = delegatedBalances.bAppTotalDelegatedBalances.find(
        (balance: any) => balance.strategyId === strategyId
      );
      
      if (delegatedBalance?.delegation) {
        return formatEther(BigInt(delegatedBalance.delegation));
      }
      
      return "0";
    } catch (error) {
      console.error('Error getting delegated balance:', error);
      return "0";
    }
  };

  // Helper function to get calculated weight for a strategy as percentage
  // Uses the exact same logic as WeightDisplay component
  const getCalculatedWeight = (strategy: any): string => {
    if (!weights) {
      return "N/A";
    }
    
    const strategyId = (strategy.id || strategy.strategy)?.toString();
    const weight = weights.get(strategyId);
    
    if (weight !== undefined) {
      // Calculate total weight for normalization (same as WeightDisplay)
      const totalWeight = Array.from(weights.values()).reduce((sum, w) => sum + w, 0);
      
      // Normalize to percentage (same as WeightDisplay)
      const normalizedWeight = totalWeight > 0 ? (weight / totalWeight) * 100 : 0;
      
      return `${normalizedWeight.toFixed(2)}%`;
    }
    
    return "0.00%";
  };



  // Helper functions for editing
  const handleAddStrategy = () => {
    if (!onStrategiesChange) return;
    
    // Generate a random number between 0-100 for simulated strategy ID
    const randomNumber = Math.floor(Math.random() * 101); // 0-100 inclusive
    const simulatedId = `S${randomNumber}`;
    
    // Create token weights based on current token coefficients
    const tokenWeights = tokenCoefficients.map((tokenCoeff: any) => ({
      token: tokenCoeff.token,
      weight: 0,
      depositAmount: "0" // Start with 0 tokens
    }));
    
    // If no token coefficients configured, add a default token
    if (tokenWeights.length === 0) {
      tokenWeights.push({
        token: "0x9f5d4ec84fc4785788ab44f9de973cf34f7a038e", // Default to SSV if no config
        weight: 0,
        depositAmount: "0"
      });
    }
    
    const newStrategy = {
      id: simulatedId,
      strategy: simulatedId, // Also set strategy field for compatibility
      tokenWeights,
      validatorBalanceWeight: 0 // Start with 0 validator balance
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

  const handleUpdateValidatorBalance = (strategyIndex: number, newBalance: number) => {
    if (!onStrategiesChange) return;
    
    const updatedStrategies = [...strategies];
    updatedStrategies[strategyIndex].validatorBalanceWeight = newBalance;
    onStrategiesChange(updatedStrategies);
  };



  const handleRemoveToken = (strategyIndex: number, tokenIndex: number) => {
    if (!onStrategiesChange) return;
    
    const updatedStrategies = [...strategies];
    updatedStrategies[strategyIndex].tokenWeights.splice(tokenIndex, 1);
    onStrategiesChange(updatedStrategies);
    
    toast({
      title: "Token Removed",
      description: "Token has been removed from the strategy",
      status: "info",
      duration: 2000,
      isClosable: true,
    });
  };

  const handleResetStrategy = (strategyIndex: number) => {
    if (!onStrategiesChange) return;
    
    const strategy = strategies[strategyIndex];
    const strategyId = (strategy.id || strategy.strategy)?.toString();
    
    // Reset all token depositAmount values to "0"
    const updatedStrategies = [...strategies];
    updatedStrategies[strategyIndex].tokenWeights = updatedStrategies[strategyIndex].tokenWeights.map((tw: any) => ({
      ...tw,
      depositAmount: "0"
    }));
    
    // Also reset validator balance weight if it exists
    if (updatedStrategies[strategyIndex].validatorBalanceWeight !== undefined) {
      updatedStrategies[strategyIndex].validatorBalanceWeight = 0;
    }
    
    // Clear any editing values for this strategy
    setEditingValues(prev => {
      const newState = { ...prev };
      // Clear all editing values for this strategy's tokens and delegated balance
      Object.keys(newState).forEach(key => {
        if (key.startsWith(`${strategyId}-`) || key === `delegated-${strategyId}`) {
          delete newState[key];
        }
      });
      return newState;
    });
    
    // Update the strategies
    onStrategiesChange(updatedStrategies);
    
    // Also reset the delegated balance if the callback is available
    if (onDelegatedBalanceChange && strategyId) {
      onDelegatedBalanceChange(strategyId, "0");
    }
    
    toast({
      title: "Strategy Reset",
      description: "All token amounts and delegated balance reset to 0 for this strategy",
      status: "success",
      duration: 2000,
      isClosable: true,
    });
  };

  const handleUpdateTokenWeight = (strategyIndex: number, tokenIndex: number, field: 'weight' | 'depositAmount', value: any) => {
    if (!onStrategiesChange) return;
    
    const updatedStrategies = [...strategies];
    
    // Ensure the tokenWeight object exists
    if (!updatedStrategies[strategyIndex].tokenWeights[tokenIndex]) {
      updatedStrategies[strategyIndex].tokenWeights[tokenIndex] = {};
    }
    
    // Update the field
    updatedStrategies[strategyIndex].tokenWeights[tokenIndex][field] = value;
    
    onStrategiesChange(updatedStrategies);
  };

  // Show error state if no strategies but not in a loading state
  if (!hasRows) {
    return (
      <Box textAlign="center" py={8}>
        <VStack spacing={4}>
          <Text fontSize="lg" color="gray.500">
            {isSimulation ? "No simulation strategies configured" : "No active strategies found"}
          </Text>
          <Text fontSize="sm" color="gray.400">
            {isSimulation ? "Add strategies to run simulations" : "Strategies will appear here when loaded from the BApp"}
          </Text>
          {/* Debug info */}
          <Code fontSize="xs" p={2} borderRadius="md" bg="gray.100">
            {JSON.stringify(strategies, null, 2)}
          </Code>
        </VStack>
      </Box>
    );
  }

  return (
    <Box maxH="600px" overflowY="auto">
      {editable && (
        <Button
          colorScheme="ssv"
          variant="outline"
          size="sm"
          onClick={handleAddStrategy}
          mb={4}
        >
          Add New Strategy
        </Button>
      )}
      
      <TableContainer>
        <Table variant="simple" size="sm">
          <Thead>
            <Tr bg="gray.50">
              <Th fontSize="xs" fontWeight="bold" color="gray.600" py={3}>Strategy ID</Th>
              <Th fontSize="xs" fontWeight="bold" color="gray.600" py={3}>Token</Th>
              <Th fontSize="xs" fontWeight="bold" color="gray.600" py={3} isNumeric>Deposit Amount</Th>
              <Th fontSize="xs" fontWeight="bold" color="gray.600" py={3} isNumeric>Delegated Balance</Th>
              <Th fontSize="xs" fontWeight="bold" color="gray.600" py={3} isNumeric>Calculated Weight</Th>
              {editable && <Th fontSize="xs" fontWeight="bold" color="gray.600" py={3}>Actions</Th>}
            </Tr>
          </Thead>
          <Tbody>
                                     {strategies.map((strategy, sIdx) => {
              const strategyDelegatedBalance = getDelegatedBalance(strategy);
              // Calculate filtered token count for display
              let filteredTokenCount = 0;
              if (strategy.tokenWeights?.length > 0) {
                filteredTokenCount = strategy.tokenWeights.filter((tw: any) => {
                  if (!tw.token) return false;
                  return relevantTokens.size === 0 || relevantTokens.has(tw.token.toLowerCase());
                }).length;
              }
              const tokenCount = filteredTokenCount;
              
              // Filter tokens by relevantTokens and ensure every strategy has at least one row
              let filteredTokens = [];
              if (tokenCount > 0 && strategy.tokenWeights) {
                filteredTokens = strategy.tokenWeights.filter((tw: any) => {
                  if (!tw.token) return false;
                  // Include token if no relevantTokens filter or if token is in the relevant set
                  return relevantTokens.size === 0 || relevantTokens.has(tw.token.toLowerCase());
                });
              }
              
              const tokensToRender = filteredTokens.length > 0 ? filteredTokens : [{ token: null, weight: 0, depositAmount: "0" }];
             
             return (
               <React.Fragment key={`strategy-${strategy.id || strategy.strategy}-${sIdx}`}>
                 {tokensToRender?.map((tokenWeight: any, tokenIndex: number) => (
                    <Tr key={`${strategy.id || strategy.strategy}-${tokenIndex}`} 
                        _hover={{ bg: "gray.25" }}
                        borderBottom={tokenIndex === tokensToRender.length - 1 ? "2px solid" : "1px solid"}
                        borderColor={tokenIndex === tokensToRender.length - 1 ? "gray.200" : "gray.100"}>
                      
                      {/* Strategy ID - only show on first row */}
                      <Td py={3} borderRight="1px solid" borderColor="gray.100">
                        {tokenIndex === 0 && (
                          <VStack spacing={1} align="start">
                            <Badge colorScheme="ssv" fontSize="xs" px={2} py={1} borderRadius="md">
                              #{strategy.id || strategy.strategy}
                            </Badge>
                            <Text fontSize="xs" color="gray.500">
                              {tokenCount > 0 ? `${tokenCount} token${tokenCount !== 1 ? 's' : ''}` : 'No tokens'}
                            </Text>
                            {editable && (
                              <Button
                                size="xs"
                                colorScheme="red"
                                variant="outline"
                                onClick={() => handleResetStrategy(sIdx)}
                                fontSize="2xs"
                                px={2}
                                py={1}
                                h="auto"
                              >
                                Reset to 0
                              </Button>
                            )}
                          </VStack>
                        )}
                      </Td>
                      
                      {/* Token */}
                      <Td py={3} borderRight="1px solid" borderColor="gray.100">
                        <Text fontSize="sm" fontFamily="mono" fontWeight="medium" color={tokenWeight.token ? "inherit" : "gray.500"}>
                          {tokenWeight.token ? getTokenDisplay(tokenWeight.token) : "No tokens"}
                        </Text>
                      </Td>
                      
                      
                      {/* Deposit Amount */}
                      <Td py={3} borderRight="1px solid" borderColor="gray.100" isNumeric>
                        {!tokenWeight.token ? (
                          <Text fontSize="sm" color="gray.500">-</Text>
                        ) : editable ? (
                          <Input
                            key={`${strategy.id || strategy.strategy}-${tokenIndex}-${tokenWeight.token}`}
                            type="number"
                            min="0"
                            step="0.000001"
                            value={(() => {
                              const inputKey = `${strategy.id || strategy.strategy}-${tokenIndex}-${tokenWeight.token}`;
                              
                              // If we're currently editing this field, use the editing value
                              if (editingValues[inputKey] !== undefined) {
                                return editingValues[inputKey];
                              }
                              
                              // Otherwise, use the actual data value
                              try {
                                const amount = getDepositAmount(strategy, tokenWeight.token);
                                const formattedValue = formatEther(BigInt(amount || "0"));
                                return formattedValue;
                              } catch (error) {
                                console.error('Error formatting deposit amount:', error);
                                return "0";
                              }
                            })()}
                            onChange={(e) => {
                              const valueString = e.target.value;
                              const inputKey = `${strategy.id || strategy.strategy}-${tokenIndex}-${tokenWeight.token}`;
                              
                              // Store the current editing value to allow free typing
                              setEditingValues(prev => ({
                                ...prev,
                                [inputKey]: valueString
                              }));
                            }}
                            onBlur={(e) => {
                              const valueString = e.target.value;
                              const inputKey = `${strategy.id || strategy.strategy}-${tokenIndex}-${tokenWeight.token}`;
                              
                              try {
                                // Clear the editing state
                                setEditingValues(prev => {
                                  const newState = { ...prev };
                                  delete newState[inputKey];
                                  return newState;
                                });
                                
                                // Find the correct token index in the original tokenWeights array
                                const actualTokenIndex = strategies[sIdx].tokenWeights.findIndex((tw: any) => 
                                  tw.token?.toLowerCase() === tokenWeight.token?.toLowerCase()
                                );
                                
                                if (actualTokenIndex === -1) {
                                  console.error('Could not find token in tokenWeights array');
                                  return;
                                }
                                
                                // Handle empty string - set to 0
                                if (valueString === "" || valueString === undefined) {
                                  handleUpdateTokenWeight(sIdx, actualTokenIndex, 'depositAmount', "0");
                                  return;
                                }
                                
                                // Convert to number and validate
                                const numValue = Number(valueString);
                                if (!isNaN(numValue) && numValue >= 0) {
                                  const weiValue = parseEther(valueString).toString();
                                  handleUpdateTokenWeight(sIdx, actualTokenIndex, 'depositAmount', weiValue);
                                } else {
                                  handleUpdateTokenWeight(sIdx, actualTokenIndex, 'depositAmount', "0");
                                }
                              } catch (error) {
                                console.error('Invalid value on blur:', valueString, error);
                                // Also use actualTokenIndex for error case
                                const actualTokenIndex = strategies[sIdx].tokenWeights.findIndex((tw: any) => 
                                  tw.token?.toLowerCase() === tokenWeight.token?.toLowerCase()
                                );
                                if (actualTokenIndex !== -1) {
                                  handleUpdateTokenWeight(sIdx, actualTokenIndex, 'depositAmount', "0");
                                }
                              }
                            }}
                            onKeyDown={(e) => {
                              // Handle Enter key to commit the value
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }}
                            onFocus={(e) => {
                              // Select all text when focused to allow easy replacement
                              e.target.select();
                            }}
                            placeholder="0.0"
                            size="sm"
                            maxW="120px"
                            textAlign="right"
                            fontSize="sm"
                          />
                        ) : (
                          <Text fontSize="sm" fontWeight="medium">
                            {(() => {
                              try {
                                const amount = getDepositAmount(strategy, tokenWeight.token);
                                
                                // Check if amount is already in readable format (contains decimal point)
                                if (amount && amount.includes('.')) {
                                  return parseFloat(amount).toFixed(4);
                                }
                                
                                // Otherwise assume it's in wei and format it
                                const formatted = formatEther(BigInt(amount || "0"));
                                return formatted;
                              } catch (error) {
                                console.error('Error formatting deposit amount for display:', error);
                                return "0";
                              }
                            })()}
                          </Text>
                        )}
                      </Td>
                      
                      {/* Delegated Balance - only show on first row */}
                      <Td py={3} borderRight="1px solid" borderColor="gray.100" isNumeric>
                        {tokenIndex === 0 && (
                          editable && isSimulation && onDelegatedBalanceChange ? (
                            <Input
                              type="number"
                              min="0"
                              step="0.000001"
                              value={(() => {
                                const inputKey = `delegated-${strategy.id || strategy.strategy}`;
                                
                                // If we're currently editing this field, use the editing value
                                if (editingValues[inputKey] !== undefined) {
                                  return editingValues[inputKey];
                                }
                                
                                // Otherwise, use the actual data value
                                return strategyDelegatedBalance;
                              })()}
                              onChange={(e) => {
                                const valueString = e.target.value;
                                const inputKey = `delegated-${strategy.id || strategy.strategy}`;
                                
                                // Store the current editing value to allow free typing
                                setEditingValues(prev => ({
                                  ...prev,
                                  [inputKey]: valueString
                                }));
                              }}
                              onBlur={(e) => {
                                const valueString = e.target.value;
                                const inputKey = `delegated-${strategy.id || strategy.strategy}`;
                                const strategyId = (strategy.id || strategy.strategy)?.toString();
                                
                                try {
                                  // Clear the editing state
                                  setEditingValues(prev => {
                                    const newState = { ...prev };
                                    delete newState[inputKey];
                                    return newState;
                                  });
                                  
                                  // Handle empty string - set to 0
                                  if (valueString === "" || valueString === undefined) {
                                    if (strategyId) {
                                      onDelegatedBalanceChange(strategyId, "0");
                                    }
                                    return;
                                  }
                                  
                                  // Convert to number and validate
                                  const numValue = Number(valueString);
                                  if (!isNaN(numValue) && numValue >= 0 && strategyId) {
                                    const weiValue = parseEther(valueString).toString();
                                    onDelegatedBalanceChange(strategyId, weiValue);
                                  } else if (strategyId) {
                                    onDelegatedBalanceChange(strategyId, "0");
                                  }
                                } catch (error) {
                                  console.error('Invalid delegated balance value on blur:', valueString, error);
                                  if (strategyId) {
                                    onDelegatedBalanceChange(strategyId, "0");
                                  }
                                }
                              }}
                              onKeyDown={(e) => {
                                // Handle Enter key to commit the value
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                }
                              }}
                              onFocus={(e) => {
                                // Select all text when focused to allow easy replacement
                                e.target.select();
                              }}
                              placeholder="0.0"
                              size="sm"
                              maxW="120px"
                              textAlign="right"
                              fontSize="sm"
                              bg="purple.50"
                              borderColor="purple.300"
                              _hover={{ borderColor: "purple.400" }}
                              _focus={{ borderColor: "purple.500", bg: "white" }}
                            />
                          ) : (
                            <Text fontSize="sm" fontWeight="bold" color="purple.600">
                              {strategyDelegatedBalance}
                            </Text>
                          )
                        )}
                      </Td>
                      
                      {/* Calculated Weight - only show on first row */}
                      <Td py={3} borderRight="1px solid" borderColor="gray.100" isNumeric>
                        {tokenIndex === 0 && (
                          <Text fontSize="sm" fontWeight="bold">
                            {getCalculatedWeight(strategy)}
                          </Text>
                        )}
                      </Td>
                      
                      {/* Actions */}
                      {editable && (
                        <Td py={3}>
                          <HStack spacing={1}>
                            {tokenIndex === 0 ? (
                              // First token row: show strategy delete button
                              <IconButton
                                aria-label="Remove strategy"
                                icon={<DeleteIcon />}
                                size="xs"
                                colorScheme="red"
                                variant="ghost"
                                onClick={() => handleRemoveStrategy(sIdx)}
                              />
                            ) : tokenWeight.token ? (
                              // Subsequent token rows: show token delete button
                              <IconButton
                                aria-label="Remove token"
                                icon={<DeleteIcon />}
                                size="xs"
                                colorScheme="orange"
                                variant="ghost"
                                onClick={() => handleRemoveToken(sIdx, tokenIndex)}
                              />
                            ) : null}
                          </HStack>
                        </Td>
                      )}
                    </Tr>
                  ))}
                </React.Fragment>
              );
            })}
          </Tbody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default StrategyList; 