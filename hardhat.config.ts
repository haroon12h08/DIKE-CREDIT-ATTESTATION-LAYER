import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0000000000000000000000000000000000000000000000000000000000000000";
const CREDITCOIN_RPC = process.env.CREDITCOIN_RPC || "https://rpc.cc3-testnet.creditcoin.network";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
      evmVersion: "paris"
    },
  },
  networks: {
    creditcoinTestnet: {
      url: CREDITCOIN_RPC,
      chainId: 102031,
      accounts: [PRIVATE_KEY]
    }
  },
  etherscan: {
    apiKey: {
      creditcoinTestnet: "unnecessary-but-required",
    },
    customChains: [
      {
        network: "creditcoinTestnet",
        chainId: 102031,
        urls: {
          apiURL: "https://creditcoin-testnet.blockscout.com/api",
          browserURL: "https://creditcoin-testnet.blockscout.com"
        }
      }
    ]
  }
};

export default config;
