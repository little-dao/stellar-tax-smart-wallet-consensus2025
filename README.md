# Stellar Smart Tax Wallet

This is a prototype project developed during Consensus 2025 to explore tax reporting mechanisms for on-chain transactions using the Stellar blockchain.

The goal is to build a wallet that can:
- Monitor Stellar transactions
- Classify taxable events (e.g. swaps, transfers)
- Use passkey-based (WebAuthn) authentication for secure login

## Current Status

This is an early-stage proof of concept. The codebase includes:
- A basic React/TypeScript frontend scaffold
- Initial integration with Stellar SDK
- Early experiments with transaction parsing and passkey login
- Directory structure for future Soroban contract logic

## Technologies (planned or partially implemented)

- **Stellar SDK** — for on-chain data access
- **Soroban (Stellar smart contracts)** — planned for swap tracking
- **Passkey/WebAuthn** — secure, local-only authentication
- **CSV export** — prototype logic to dump activity for tax use

## Intended Use

This project was built for hackathon purposes and is **not production-ready** or intended for real tax reporting. No data is stored on-chain or externally. All logic is client-side/local.

## License

MIT — feel free to build on it.

PS: I was very lazy so just wrote it based on the original passkey demo from Stellar, same build procedure, and run it in demo folder with pnpm run build :)
