import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";

import * as dotenv from "dotenv";
import { Wallet } from "ethers";

dotenv.config({ path: "env/.env" });

import { HardhatAccount } from "./src/HardhatAccount";

function getAccounts() {
    const accounts: string[] = [];
    const reg_bytes64: RegExp = /^(0x)[0-9a-f]{64}$/i;

    if (
        process.env.MANAGER_KEY !== undefined &&
        process.env.MANAGER_KEY.trim() !== "" &&
        reg_bytes64.test(process.env.MANAGER_KEY)
    ) {
        accounts.push(process.env.MANAGER_KEY);
    } else {
        process.env.MANAGER_KEY = Wallet.createRandom().privateKey;
        accounts.push(process.env.MANAGER_KEY);
    }

    while (accounts.length < 50) {
        accounts.push(Wallet.createRandom().privateKey);
    }

    if (HardhatAccount.keys.length === 0) {
        for (const account of accounts) {
            HardhatAccount.keys.push(account);
        }
    }

    return accounts;
}

function getTestAccounts() {
    const defaultBalance = "2000000000000000000000000";
    const acc = getAccounts();
    return acc.map((m) => {
        return {
            privateKey: m,
            balance: defaultBalance,
        };
    });
}

const config = {
    solidity: {
        compilers: [
            {
                version: "0.8.2",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 2000,
                    },
                },
            },
        ],
    },
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            accounts: getTestAccounts(),
            gas: 8000000,
            gasPrice: 8000000000,
            blockGasLimit: 8000000,
        },
        bosagora_mainnet: {
            url: process.env.MAIN_NET_URL || "",
            chainId: 2151,
            accounts: getAccounts(),
        },
        bosagora_testnet: {
            url: process.env.TEST_NET_URL || "",
            chainId: 2019,
            accounts: getAccounts(),
        },
        bosagora_devnet: {
            url: "http://localhost:8545",
            chainId: 24680,
            accounts: getAccounts(),
        },
    },
    gasReporter: {
        enabled: process.env.REPORT_GAS !== undefined,
        currency: "USD",
    },
};

export default config;
