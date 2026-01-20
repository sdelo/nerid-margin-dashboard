# Nerid Margin Dashboard

A comprehensive dashboard for monitoring and interacting with DeepBook Margin lending pools on the Sui blockchain, powered by [DeepBook V3](https://deepbook.tech).

## Features

- **Landing Page**: Introduction to DeepBook Margin and dashboard capabilities
- **Real-time Analytics**: Monitor pool utilization, interest rates, and yield curves
- **Position Management**: Deposit, withdraw, and manage positions across multiple pools
- **Yield Optimization**: Compare yields and track historical performance
- **Depositor Insights**: View depositor distribution and protocol fees
- **Transaction History**: Comprehensive transaction tracking and analytics
- **Pool Administration**: Monitor pool parameters and risk metrics

## Architecture

The protocol enables margin trading through:

1. **Lending Pools** - Users deposit assets to earn yield
2. **Margin Accounts** - Traders borrow against collateral for leveraged positions
3. **DeepBook Integration** - Trades execute on DeepBook's CLOB for best price discovery
4. **Pyth Oracle** - Real-time price feeds for collateral valuation and liquidations

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) or [Node.js](https://nodejs.org/)

### Installation

1. Install dependencies:

   ```bash
   bun install
   ```

2. Configure server endpoints (optional):

   **Option A - Automatic (Recommended for local dev):**
   
   When running on `localhost`, the app automatically uses `http://localhost:9008` for the Testnet indexer.
   
   **Option B - Manual override:**
   
   Edit `src/config/networks.ts` directly to change the server URLs:
   ```typescript
   const TESTNET_SERVER_URL = "http://localhost:9008";  // Your custom URL
   const MAINNET_SERVER_URL = "https://your-indexer.com";
   ```

3. Start the development server:

   ```bash
   bun dev
   ```

4. Open your browser and navigate to `http://localhost:5173`

## Project Structure

- `/` - Landing page with DeepBook Margin introduction
- `/pools` - Main dashboard with pool management and analytics
- `/dashboard` - Alternative route to the main dashboard

## Technology Stack

- React 18 with TypeScript
- Bun for build tooling and runtime
- Tailwind CSS for styling
- React Router for navigation
- Sui dApp Kit for blockchain integration
- Heroicons for UI icons
- Recharts for data visualization

## License

This project is licensed under the Apache License, Version 2.0 - see the [LICENSE](./LICENSE) file for details.

## Contributing

We welcome contributions! Please ensure that:

1. Your code follows the existing style conventions
2. All tests pass
3. You agree to license your contribution under Apache 2.0

## Security

If you discover a security vulnerability, please report it responsibly. Do not open public issues for security concerns.

## Links

- [DeepBook Documentation](https://docs.sui.io/standards/deepbookv3)
- [DeepBook SDK](https://docs.sui.io/standards/deepbookv3-sdk)
- [Sui Developer Portal](https://docs.sui.io/)
