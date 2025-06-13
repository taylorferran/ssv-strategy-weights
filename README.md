# Strategy Weights Calculator

A web application for calculating and visualizing strategy weights in the SSV Network. This tool helps developers understand how different parameters affect strategy weights and provides a way to experiment with various configurations.

## Features

- View and configure BApp settings
- Display strategy token amounts and obligated percentages
- Calculate weights using different algorithms (Arithmetic, Geometric, Harmonic)
- Add random strategies for testing
- Copy implementation code for integration
- Real-time weight calculations

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open [http://localhost:5173](http://localhost:5173) in your browser

## Usage

1. Enter a BApp ID or use the default one
2. Configure token coefficients and validator coefficient
3. Choose a calculation type (Arithmetic, Geometric, or Harmonic)
4. View the calculated weights for each strategy
5. Add random strategies to test different scenarios
6. Copy the implementation code for your own integration

## Implementation

The application uses the following technologies:
- React with TypeScript
- Vite for build tooling
- ChakraUI for the component library
- SSV Labs BApps SDK for weight calculations

## Development

To modify the application:

1. Edit the components in `src/components/`
2. Update types in `src/types/index.ts`
3. Modify SDK interactions in `src/services/sdk.ts`

## License

MIT
