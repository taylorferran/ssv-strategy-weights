export interface TokenCoefficient {
  token: `0x${string}`;
  coefficient: number;
}

export interface StrategyTokenWeight {
  strategy: number;
  tokens: {
    [key: string]: {
      amount: string;
      obligatedPercentage: number;
    };
  };
}

export interface WeightCalculationOptions {
  coefficients: TokenCoefficient[];
  validatorCoefficient: number;
}

export type CalculationType = 'arithmetic' | 'geometric' | 'harmonic';

export interface StrategyWeight {
  strategy: number;
  weight: number;
}

export interface BAppConfig {
  bAppId: string;
  tokenCoefficients: TokenCoefficient[];
  validatorCoefficient: number;
  calculationType: CalculationType;
} 