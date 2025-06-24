import {
  Box,
  Text,
  VStack,
  Badge,
  Button,
  useClipboard,
  HStack,
  Flex,
  SimpleGrid,
  Divider,
} from '@chakra-ui/react';
import { PieChart } from 'react-minimal-pie-chart';
import { CopyIcon, CheckIcon } from '@chakra-ui/icons';

interface WeightDisplayProps {
  weights: Map<string, number>;
  isSimulation?: boolean;
  simulationResults?: any[]; // For detailed breakdown in simulation mode
}

const PIE_COLORS = [
  '#3182ce', // blue
  '#e53e3e', // red
  '#38a169', // green
  '#d69e2e', // yellow
  '#805ad5', // purple
  '#319795', // teal
  '#dd6b20', // orange
  '#718096', // gray
];

const WeightDisplay = ({ weights, isSimulation, simulationResults }: WeightDisplayProps) => {
  // Debug logging
  console.log('🔍 [WeightDisplay] Component rendered with:', {
    weights: weights,
    weightEntries: Array.from(weights.entries()),
    weightsSize: weights.size,
    isSimulation,
    simulationResults: simulationResults?.length || 0
  });
  
  // Calculate total weight for normalization
  const totalWeight = Array.from(weights.values()).reduce((sum, weight) => sum + weight, 0);
  console.log('🔍 [WeightDisplay] Total weight calculated:', totalWeight);
  
  // Normalize weights to percentages (0-100)
  const normalizedWeights = Array.from(weights.entries()).map(([strategy, weight]) => ({
    strategy,
    rawWeight: weight,
    normalizedWeight: totalWeight > 0 ? (weight / totalWeight) * 100 : 0
  }));
  
  console.log('🔍 [WeightDisplay] Normalized weights:', normalizedWeights);
    
  const { hasCopied, onCopy } = useClipboard(
    normalizedWeights
      .map(({ strategy, normalizedWeight }) => `Strategy ${strategy}: ${normalizedWeight.toFixed(2)}%`)
      .join('\n')
  );

  const pieData = normalizedWeights.map(({ strategy, normalizedWeight }, idx) => ({
    title: `Strategy ${strategy}`,
    value: normalizedWeight,
    color: PIE_COLORS[idx % PIE_COLORS.length],
  }));
  
  console.log('🔍 [WeightDisplay] Pie data for chart:', pieData);
  console.log('🔍 [WeightDisplay] Pie data length:', pieData.length);
  console.log('🔍 [WeightDisplay] Pie data values:', pieData.map(d => d.value));
  
  // Debug specific issues
  console.log('🚀 [DEBUG-PIE-CHART] Detailed pie chart analysis:');
  pieData.forEach((entry, idx) => {
    console.log(`🚀 [DEBUG-PIE-CHART] Entry ${idx + 1}:`, {
      title: entry.title,
      value: entry.value,
      color: entry.color,
      isZero: entry.value === 0,
      isNaN: isNaN(entry.value),
      isFinite: isFinite(entry.value)
    });
  });
  
  const totalPieValue = pieData.reduce((sum, entry) => sum + entry.value, 0);
  console.log('🚀 [DEBUG-PIE-CHART] Total pie value:', totalPieValue);
  console.log('🚀 [DEBUG-PIE-CHART] All values are zero:', pieData.every(entry => entry.value === 0));
  console.log('🚀 [DEBUG-PIE-CHART] Has NaN values:', pieData.some(entry => isNaN(entry.value)));
  console.log('🚀 [DEBUG-PIE-CHART] Has infinite values:', pieData.some(entry => !isFinite(entry.value)));
  
  // Check if pie chart should render
  const shouldRenderChart = pieData.length > 0 && totalPieValue > 0 && pieData.some(entry => entry.value > 0);
  console.log('🚀 [DEBUG-PIE-CHART] Should render chart:', shouldRenderChart);

  if (pieData.length === 0) {
    return (
      <Box maxH="500px" overflowY="auto" px={2}>
        <VStack spacing={8} align="center" py={12}>
          <Text color="gray.400" fontSize="lg">
            No weight data available
          </Text>
          <Text color="gray.500" fontSize="sm">
            Configure strategies to see weight distribution
          </Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box maxH="500px" overflowY="auto" px={2}>
      <VStack spacing={6} align="stretch" w="100%">
        {/* Chart Section */}
        <Box textAlign="center">
          <Box w="240px" h="240px" mx="auto" mb={4}>
            <PieChart
              data={pieData}
              label={({ dataEntry }) => `${Math.round(dataEntry.percentage)}%`}
              labelStyle={{
                fontSize: '11px',
                fontFamily: 'Inter, sans-serif',
                fill: '#fff',
                fontWeight: 'bold',
              }}
              radius={42}
              labelPosition={72}
              animate
              animationDuration={800}
              lineWidth={60}
            />
          </Box>
          
          <Text fontSize="md" fontWeight="semibold" color="gray.600" mb={1}>
            Total Weight Distribution
          </Text>
          <Text fontSize="sm" color="gray.500">
            {pieData.length} strategies calculated
          </Text>
        </Box>

        <Divider />

        {/* Legend Section */}
        <VStack spacing={3} align="stretch">
          <Text fontSize="sm" fontWeight="semibold" color="gray.600" mb={1}>
            Strategy Breakdown
          </Text>
          <VStack spacing={2} align="stretch">
            {pieData.map((entry, idx) => (
              <Flex
                key={entry.title}
                bg="gray.50"
                borderRadius="lg"
                p={3}
                align="center"
                justify="space-between"
                border="1px solid"
                borderColor="gray.200"
                _hover={{ bg: "gray.100", transform: "translateY(-1px)" }}
                transition="all 0.2s"
              >
                <HStack spacing={3}>
                  <Box
                    w={3}
                    h={3}
                    bg={entry.color}
                    borderRadius="full"
                    boxShadow="sm"
                  />
                  <Text fontSize="sm" fontWeight="medium" color="gray.700">
                    {entry.title.replace('Strategy ', 'Strategy #')}
                  </Text>
                </HStack>
                <Badge
                  colorScheme="ssv"
                  variant="subtle"
                  fontSize="xs"
                  px={2}
                  py={1}
                  borderRadius="md"
                  fontWeight="bold"
                >
                  {entry.value.toFixed(2)}%
                </Badge>
              </Flex>
            ))}
          </VStack>
        </VStack>

        {/* Simulation Detailed Breakdown */}
        {isSimulation && simulationResults && simulationResults.length > 0 && (
          <>
            <Divider />
            <VStack spacing={3} align="stretch">
              <Text fontSize="sm" fontWeight="semibold" color="gray.600" mb={1}>
                Detailed Weight Breakdown (Simulation)
              </Text>
              <VStack spacing={3} align="stretch">
                {simulationResults.map((strategy, idx) => {
                  const totalTokenWeight = strategy.tokenWeights?.reduce((sum: number, tw: any) => sum + tw.weight, 0) || 0;
                  const validatorWeight = strategy.validatorBalanceWeight || 0;
                  const totalWeight = totalTokenWeight + validatorWeight;
                  
                  return (
                    <Box
                      key={strategy.id}
                      bg="blue.50"
                      borderRadius="lg"
                      p={4}
                      border="1px solid"
                      borderColor="blue.200"
                    >
                      <VStack spacing={2} align="stretch">
                        <Text fontSize="sm" fontWeight="bold" color="blue.800">
                          Strategy #{strategy.id}
                        </Text>
                        <SimpleGrid columns={3} spacing={2} fontSize="xs">
                          <Box textAlign="center">
                            <Text color="gray.600" fontWeight="medium">Token Weight</Text>
                            <Badge colorScheme="green" variant="subtle">
                              {totalTokenWeight.toFixed(4)}
                            </Badge>
                          </Box>
                          <Box textAlign="center">
                            <Text color="gray.600" fontWeight="medium">Validator Weight</Text>
                            <Badge colorScheme="purple" variant="subtle">
                              {validatorWeight.toFixed(4)}
                            </Badge>
                          </Box>
                          <Box textAlign="center">
                            <Text color="gray.600" fontWeight="medium">Total Weight</Text>
                            <Badge colorScheme="blue" variant="subtle">
                              {totalWeight.toFixed(4)}
                            </Badge>
                          </Box>
                        </SimpleGrid>
                        
                        {/* Token Details */}
                        {strategy.tokenWeights && strategy.tokenWeights.length > 0 && (
                          <Box mt={2}>
                            <Text fontSize="xs" color="gray.600" fontWeight="medium" mb={1}>
                              Token Breakdown:
                            </Text>
                            <VStack spacing={1} align="stretch">
                              {strategy.tokenWeights.map((tw: any, twIdx: number) => (
                                <Flex key={twIdx} justify="space-between" fontSize="xs">
                                  <Text color="gray.700" fontFamily="mono">
                                    {tw.token === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" 
                                      ? "ETH" 
                                      : `${tw.token.slice(0, 6)}...${tw.token.slice(-4)}`}
                                  </Text>
                                  <Badge colorScheme="gray" variant="outline" fontSize="xs">
                                    {tw.weight.toFixed(4)}
                                  </Badge>
                                </Flex>
                              ))}
                            </VStack>
                          </Box>
                        )}
                      </VStack>
                    </Box>
                  );
                })}
              </VStack>
            </VStack>
          </>
        )}

        <Divider />

        {/* Copy Button */}
        <Button
          onClick={onCopy}
          colorScheme="ssv"
          size="md"
          leftIcon={hasCopied ? <CheckIcon /> : <CopyIcon />}
          borderRadius="xl"
          fontWeight="semibold"
          _hover={{ transform: "translateY(-2px)", boxShadow: "lg" }}
          transition="all 0.2s"
          bg={hasCopied ? "green.500" : "ssv.500"}
          _active={{ transform: "translateY(0)" }}
        >
          {hasCopied ? 'Copied!' : 'Copy Data'}
        </Button>
      </VStack>
    </Box>
  );
};

export default WeightDisplay; 