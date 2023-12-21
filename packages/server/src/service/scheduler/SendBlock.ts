/**
 *  A class that transmits block information to the blockchain.
 *
 *  Copyright:
 *      Copyright (c) 2022 BOSAGORA Foundation All rights reserved.
 *
 *  License:
 *       MIT License. See LICENSE for details.
 */

import { NonceManager } from "@ethersproject/experimental";
import { Utils } from "dms-store-purchase-sdk";
import { Signer, Wallet } from "ethers";
import { ethers } from "hardhat";
import { StorePurchase } from "../../../typechain-types";
import { Scheduler } from "../../modules";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { GasPriceManager } from "../contract/GasPriceManager";
import { StorePurchaseStorage } from "../storage/StorePurchaseStorage";

/**
 * Store the headers of blocks in a smart contract at regular intervals.
 * The header of the block is created by the class Node and stored in the database.
 */
export class SendBlock extends Scheduler {
    /**
     * The object containing the settings required to run
     */
    private _config: Config | undefined;

    /**
     * The object needed to access the database
     */
    private _storage: StorePurchaseStorage | undefined;

    /**
     * The contract object needed to save the block information
     */
    private _contract: StorePurchase | undefined;

    /**
     * The signer needed to save the block information
     */
    private _managerSigner: NonceManager | undefined;

    /**
     * This is the timestamp when the previous block was created
     */
    private old_time_stamp: number;

    /**
     * Constructor
     */
    constructor() {
        super(1);

        this.old_time_stamp = Utils.getTimeStamp();
    }

    /**
     * Returns the value if this._config is defined.
     * Otherwise, exit the process.
     */
    private get config(): Config {
        if (this._config !== undefined) return this._config;
        else {
            logger.error("Config is not ready yet.");
            process.exit(1);
        }
    }

    /**
     * Returns the value if this._managerSigner is defined.
     * Otherwise, make signer
     */
    private get managerSigner(): Signer {
        if (this._managerSigner === undefined) {
            const manager = new Wallet(this.config.contracts.managerKey);
            this._managerSigner = new NonceManager(new GasPriceManager(ethers.provider.getSigner(manager.address)));
        }
        return this._managerSigner;
    }

    /**
     * Returns the value if this._storage is defined.
     * Otherwise, exit the process.
     */
    private get storage(): StorePurchaseStorage {
        if (this._storage !== undefined) return this._storage;
        else {
            logger.error("Storage is not ready yet.");
            process.exit(1);
        }
    }

    /**
     * Set up multiple objects for execution
     * @param options objects for execution
     */
    public setOption(options: any) {
        if (options) {
            if (options.config && options.config instanceof Config) this._config = options.config;
            if (options.storage && options.storage instanceof StorePurchaseStorage) {
                this._storage = options.storage;
            }
        }
    }

    /**
     * Look up the new block in the DB and add the block to the StorePurchase contract.
     * @protected
     */
    protected override async work() {
        const new_time_stamp = Utils.getTimeStamp();
        try {
            const old_period = Math.floor(this.old_time_stamp / this.config.node.send_interval);
            const new_period = Math.floor(new_time_stamp / this.config.node.send_interval);

            if (old_period === new_period) return;

            this.old_time_stamp = new_time_stamp;

            if (this._contract === undefined) {
                const contractFactory = await ethers.getContractFactory("StorePurchase");
                this._contract = contractFactory.attach(this.config.contracts.purchaseAddress) as StorePurchase;
            }

            const last_height_org = await this._contract.getLastHeight();
            const last_height: bigint = BigInt(last_height_org.toString());
            const db_last_height = await this.storage.selectLastHeight();

            if (db_last_height === null) {
                logger.info(`No block data in DB.`);
                return;
            }

            if (last_height >= db_last_height) {
                logger.info(
                    `The last block height of the DB is equal to or lower than the last block height of the contract.`
                );
            }

            let data: any = null;
            if (db_last_height > last_height) {
                data = await this.storage.selectBlockByHeight(last_height + 1n);
            }

            if (data) {
                try {
                    await this._contract
                        .connect(this.managerSigner)
                        .add(data.height, data.curBlock, data.prevBlock, data.merkleRoot, data.timestamp, data.CID)
                        .then(() => {
                            logger.info(`Successful in adding blocks to the blockchain. Height: ${data.height}`);
                        });
                } catch (err) {
                    const signer = this.managerSigner as NonceManager;
                    signer.setTransactionCount(await signer.getTransactionCount());
                }
            } else {
                logger.info(`This block is not ready.`);
            }

            // Delete blocks stored in the contract from the database
            await this.storage.deleteBlockByHeight(last_height);
        } catch (error) {
            logger.error(`Failed to execute the Send Block: ${error}`);
        }
    }
}
