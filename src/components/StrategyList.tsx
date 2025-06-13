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
} from '@chakra-ui/react';

interface StrategyListProps {
  strategies: any[];
}

const StrategyList = ({ strategies }: StrategyListProps) => {
  const hasRows = strategies && strategies.length > 0;

  if (!hasRows) {
    return (
      <Box textAlign="center" py={12}>
        <Text color="gray.400" fontSize="lg" mb={4}>
          No strategies found for this BApp ID
        </Text>
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
      <VStack spacing={4} align="stretch">
        {strategies.map((strategy, sIdx) => (
          <Card key={strategy.id} variant="outline" borderRadius="xl" overflow="hidden">
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
                    Strategy #{strategy.id}
                  </Badge>
                  <Spacer />
                  <Text fontSize="sm" color="gray.500" fontWeight="medium">
                    {strategy.tokenWeights.length} tokens
                  </Text>
                </Flex>

                {/* Validator Balance Weight */}
                {strategy.validatorBalanceWeight !== undefined && strategy.validatorBalanceWeight !== null && (
                  <Box bg="ssv.50" borderRadius="lg" p={3}>
                    <HStack justify="space-between">
                      <Text fontSize="sm" fontWeight="semibold" color="ssv.600">
                        Validator Balance Weight
                      </Text>
                      <Badge colorScheme="ssv" variant="subtle" fontSize="sm">
                        {strategy.validatorBalanceWeight}
                      </Badge>
                    </HStack>
                  </Box>
                )}

                <Divider />

                {/* Token Weights */}
                <VStack spacing={3} align="stretch">
                  <Text fontSize="sm" fontWeight="semibold" color="gray.600" mb={1}>
                    Token Weights
                  </Text>
                  {strategy.tokenWeights.map((tw: any, tIdx: number) => (
                    <Box 
                      key={tw.token} 
                      bg={tIdx % 2 === 0 ? 'gray.50' : 'white'} 
                      borderRadius="lg" 
                      p={4}
                      border="1px solid"
                      borderColor="gray.100"
                    >
                      <HStack spacing={4} align="center">
                        <Box flex={1}>
                          <Text fontSize="xs" color="gray.500" mb={1} fontWeight="medium">
                            Token Address
                          </Text>
                          <Code 
                            fontSize="xs" 
                            bg="transparent" 
                            color="gray.700"
                            p={0}
                            fontWeight="medium"
                          >
                            {tw.token.length > 20 ? `${tw.token.slice(0, 10)}...${tw.token.slice(-8)}` : tw.token}
                          </Code>
                        </Box>
                        <Divider orientation="vertical" height="40px" />
                        <Box textAlign="right" minW="80px">
                          <Text fontSize="xs" color="gray.500" mb={1} fontWeight="medium">
                            Weight
                          </Text>
                          <Text fontSize="lg" fontWeight="bold" color="ssv.600">
                            {tw.weight}
                          </Text>
                        </Box>
                      </HStack>
                    </Box>
                  ))}
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