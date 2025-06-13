import { ChakraProvider, Box, VStack, HStack, Heading, Image, Text, Container, Spacer } from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import type { BAppConfig, StrategyTokenWeight } from './types';
import { getParticipantWeights, calculateStrategyWeights, generateRandomStrategy } from './services/sdk';
import ConfigPanel from './components/ConfigPanel';
import StrategyList from './components/StrategyList';
import WeightDisplay from './components/WeightDisplay';
import theme from './theme';

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

function App() {
  const [config, setConfig] = useState<BAppConfig>(defaultConfig);
  const [strategies, setStrategies] = useState<StrategyTokenWeight[]>([]);
  const [weights, setWeights] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const fetchStrategies = async () => {
      const fetchedStrategies = await getParticipantWeights(config.bAppId);
      setStrategies(fetchedStrategies);
    };
    fetchStrategies();
  }, [config.bAppId]);

  useEffect(() => {
    const newWeights = calculateStrategyWeights(
      strategies,
      {
        coefficients: config.tokenCoefficients,
        validatorCoefficient: config.validatorCoefficient,
      },
      config.calculationType
    );
    setWeights(newWeights);
  }, [strategies, config]);

  const handleAddRandomStrategy = () => {
    setStrategies([...strategies, generateRandomStrategy()]);
  };

  return (
    <ChakraProvider theme={theme}>
      <Box minH="100vh" bg="linear-gradient(135deg, #2D9CFF 0%, #4daaff 100%)">
        {/* Hero Section */}
        <Container maxW="full" px={8} py={16}>
          <VStack spacing={6} textAlign="center" mb={16}>
            <Image src="/ssv-logo.png" alt="SSV Logo" boxSize="80px" filter="drop-shadow(0 4px 8px rgba(0,0,0,0.1))" />
            <Heading size="3xl" color="white" fontWeight="black" letterSpacing="tight">
              SSV Strategy Weights Calculator
            </Heading>
            <Text fontSize="lg" color="white" opacity={0.8} maxW="600px">
              Configure your strategies, analyze token weights, and visualize calculated distributions
            </Text>
          </VStack>

          {/* Main Content Cards */}
          <VStack spacing={8} align="stretch">
            
            {/* Configuration Section */}
            <Box 
              bg="white" 
              borderRadius="3xl" 
              p={10} 
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
                  <Heading size="lg" color="ssv.600" fontWeight="bold">
                    Configuration Panel
                  </Heading>
                  <Spacer />
                  <Text fontSize="sm" color="ssv.400" fontWeight="medium">
                    Setup your calculation parameters
                  </Text>
                </HStack>
                <ConfigPanel
                  config={config}
                  onConfigChange={setConfig}
                  onAddRandomStrategy={handleAddRandomStrategy}
                />
              </VStack>
            </Box>

            {/* Strategies and Weights Grid */}
            <HStack spacing={8} align="stretch">
              
              {/* Strategies Section */}
              <Box 
                bg="white" 
                borderRadius="3xl" 
                p={10} 
                boxShadow="2xl"
                border="1px solid"
                borderColor="ssv.100"
                flex={1}
                transform="translateY(0)"
                transition="all 0.3s ease"
                _hover={{ transform: "translateY(-4px)", boxShadow: "3xl" }}
              >
                <VStack spacing={8} align="stretch">
                  <HStack spacing={4} align="center">
                    <Box w={4} h={4} bg="ssv.500" borderRadius="full" />
                    <Heading size="lg" color="ssv.600" fontWeight="bold">
                      Active Strategies
                    </Heading>
                    <Spacer />
                    <Text fontSize="sm" color="ssv.400" fontWeight="medium">
                      {strategies.length} strategies loaded
                    </Text>
                  </HStack>
                  <StrategyList strategies={strategies} />
                </VStack>
              </Box>

              {/* Weights Section */}
              <Box 
                bg="white" 
                borderRadius="3xl" 
                p={10} 
                boxShadow="2xl"
                border="1px solid"
                borderColor="ssv.100"
                flex={1}
                transform="translateY(0)"
                transition="all 0.3s ease"
                _hover={{ transform: "translateY(-4px)", boxShadow: "3xl" }}
              >
                <VStack spacing={8} align="stretch">
                  <HStack spacing={4} align="center">
                    <Box w={4} h={4} bg="ssv.500" borderRadius="full" />
                    <Heading size="lg" color="ssv.600" fontWeight="bold">
                      Weight Distribution
                    </Heading>
                    <Spacer />
                    <Text fontSize="sm" color="ssv.400" fontWeight="medium">
                      Calculated results
                    </Text>
                  </HStack>
                  <WeightDisplay weights={weights} />
                </VStack>
              </Box>

            </HStack>
          </VStack>
        </Container>
      </Box>
    </ChakraProvider>
  );
}

export default App;
