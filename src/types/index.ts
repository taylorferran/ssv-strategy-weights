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
  validatorBalanceWeight?: number;
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

// Add interface for the actual structure used in the UI components
export interface UIStrategy {
  id?: string | number;
  strategy?: string | number;
  tokenWeights: {
    token: string;
    weight: number;
    depositAmount?: string;
  }[];
  validatorBalanceWeight?: number;
} 