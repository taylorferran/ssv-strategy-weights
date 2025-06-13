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

const WeightDisplay = ({ weights }: WeightDisplayProps) => {
  const { hasCopied, onCopy } = useClipboard(
    Array.from(weights.entries())
      .map(([strategy, weight]) => `Strategy ${strategy}: ${weight.toFixed(2)}%`)
      .join('\n')
  );

  const pieData = Array.from(weights.entries()).map(([strategy, weight], idx) => ({
    title: `Strategy ${strategy}`,
    value: weight,
    color: PIE_COLORS[idx % PIE_COLORS.length],
  }));

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