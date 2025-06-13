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
} from '@chakra-ui/react';
import { DeleteIcon, AddIcon } from '@chakra-ui/icons';
import type { BAppConfig, TokenCoefficient } from '../types';

interface ConfigPanelProps {
  config: BAppConfig;
  onConfigChange: (config: BAppConfig) => void;
  onAddRandomStrategy: () => void;
}

const ConfigPanel = ({ config, onConfigChange, onAddRandomStrategy }: ConfigPanelProps) => {
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
        { token: '0x0000000000000000000000000000000000000000', coefficient: 0 },
      ],
    });
  };

  const removeTokenCoefficient = (index: number) => {
    const newCoefficients = config.tokenCoefficients.filter((_, i) => i !== index);
    onConfigChange({ ...config, tokenCoefficients: newCoefficients });
  };

  return (
    <VStack spacing={8} w="100%" align="stretch">
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
      </VStack>

      <Divider borderColor="gray.200" />

      {/* Token Coefficients */}
      <VStack spacing={6} align="stretch">
        <Flex justify="space-between" align="center">
          <Text color="ssv.600" fontWeight="semibold" fontSize="md">
            Token Coefficients
          </Text>
          <Badge colorScheme="ssv" fontSize="xs" px={2} py={1} borderRadius="md">
            {config.tokenCoefficients.length} tokens
          </Badge>
        </Flex>
        
        <VStack spacing={4} align="stretch">
          {config.tokenCoefficients.map((coefficient, index) => (
            <Box key={index} p={4} bg="gray.50" borderRadius="xl" border="1px solid" borderColor="gray.200">
              <HStack spacing={4} align="end">
                <FormControl flex={3}>
                  <FormLabel color="gray.600" fontWeight="medium" fontSize="sm" mb={2}>
                    Token Address
                  </FormLabel>
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
                <IconButton
                  aria-label="Remove token"
                  icon={<DeleteIcon />}
                  colorScheme="red"
                  variant="ghost"
                  size="md"
                  onClick={() => removeTokenCoefficient(index)}
                />
              </HStack>
            </Box>
          ))}
          
          <Button 
            onClick={addTokenCoefficient} 
            colorScheme="ssv" 
            variant="outline"
            size="lg"
            leftIcon={<AddIcon />}
            borderRadius="xl"
            _hover={{ bg: "ssv.50" }}
          >
            Add Token Coefficient
          </Button>
        </VStack>
      </VStack>
    </VStack>
  );
};

export default ConfigPanel; 