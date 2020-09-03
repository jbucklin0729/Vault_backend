/* eslint-disable space-before-function-paren */
/* eslint-disable eol-last */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-param-reassign */
/* eslint-disable indent */
/* eslint-disable quotes */
/* eslint-disable quote-props */
const Web3 = require('web3');
const cryptoJS = require("crypto-js");
const ethers = require('ethers');
const utils = ethers.utils;
const fs = require('fs');
const path = require('path');
const BN = require('bignumber.js');
const axios = require('axios');
const { of } = require('await-of');
const EthereumTx = require('ethereumjs-tx').Transaction;
const logger = require('../config/winston');
require('dotenv').config();


const { allTokens: allDefaultTokens } = require('./allTokens');

const provider = new Web3.providers.HttpProvider(process.env.TESTNET_RINKEBY);

// const provider = new Web3.providers.HttpProvider('http://127.0.0.1:7545');


const web3 = new Web3(provider);

exports.web3 = web3;

//const vaultContract = JSON.parse(fs.readFileSync(path.resolve(__dirname, './HydroVaultContract.json'), 'utf8'));

const vaultContract = JSON.parse(fs.readFileSync(path.resolve(__dirname, './HydroVaultContract.json'), 'utf8'));

async function getCurrentGasPrices() {
    const response = await axios.get('https://ethgasstation.info/json/ethgasAPI.json');
    const prices = {
        low: response.data.safeLow / 10,
        medium: response.data.average / 10,
        high: response.data.fast / 10,
    };

    // console.log("\r\n")
    // logger.debug(`Current ETH Gas Prices (in GWEI):`);
    // console.log("\r\n")
    // logger.debug(`Low: ${prices.low} (transaction completes in < 30 minutes)`)
    // logger.debug(`Standard: ${prices.medium} (transaction completes in < 5 minutes)`)
    // logger.debug(`Fast: ${prices.high} (transaction completes in < 2 minutes)`)
    // console.log("\r\n")

    return prices;
};

/**
 * @description - Genarate Ethereum wallet for user
 * @returns {string} address
 */
exports.generateWallet = async() => {
    const mnemonic = await utils.HDNode.entropyToMnemonic(ethers.utils.randomBytes(16));
    const wallet = ethers.Wallet.fromMnemonic(mnemonic);
    return wallet.signingKey;
};

async function estimateGas(txObect) {
    const { to, from, data } = txObect;
    const estimatedAmount = await web3.eth.estimateGas({ to, from, data })
    return estimatedAmount;
}

async function signAndTransact(privateKey, details, type) {
    // const transaction = new EthereumTx(details, { chain: 'ropsten', hardfork: 'petersburg' });
    const transaction = new EthereumTx(details, { chain: 'rinkeby' });
    transaction.sign(Buffer.from(`${privateKey}`.substring(2), 'hex'));
    const serializedTransaction = transaction.serialize();
    const addr = transaction.from.toString('hex');
    logger.info(`Based on your private key, your wallet address is ${addr}`);
    const res = await web3.eth.sendSignedTransaction(`0x${serializedTransaction.toString('hex')}`);
    // logger.debug('TxHash', `https://rinkeby.etherscan.io/tx/${res.transactionHash}`)
    return res;
    // if (type == 'transfer') {
    //     const txHash = await web3.utils.sha3(serializedTransaction);
    //     await web3.eth.sendSignedTransaction(`0x${serializedTransaction.toString('hex')}`);
    //     return txHash;
    // } else {
    //     await web3.eth.sendSignedTransaction(`0x${serializedTransaction.toString('hex')}`);
    //     return true;
    // }

}

/**
 *
 * @description - Create a new vault
 * @param {string} userEmail
 * @param {string} vaultId
 * @returns {string} Wallet Address
 */
exports.create = async(sender, privateKey, userEmail, vaultId) => {
    const Vaultcontract = new web3.eth.Contract(vaultContract.abi, process.env.CONTRACT_ADDRESS);
    const [nonce] = await of(web3.eth.getTransactionCount(sender));
    const details = {
        from: sender,
        to: process.env.CONTRACT_ADDRESS,
        // "gas": transObj.gas,
        // // "gas": "0x7a1200",
        // "gasPrice": gasPrices.medium * 1000000000,
        gasLimit: 6721975,
        gasPrice: 20000000000,
        nonce,
        data: Vaultcontract.methods.create(userEmail, `"${vaultId}"`).encodeABI(),
        value: '0x0',
    };
    const [signAndSend, signAndSendError] = await of(signAndTransact(privateKey, details));
    if (signAndSendError) {
        throw new Error(signAndSendError);
    }
    return signAndSend;
};

exports.approveContract = async(sender, privateKey, symbol, amount) => {
    // const gasPrices = await getCurrentGasPrices();
    const tokenAbi = allDefaultTokens[symbol].abi;
    const tokenAddress = allDefaultTokens[symbol].address;
    const TokenContract = new web3.eth.Contract(tokenAbi, tokenAddress, { from: sender });
    const [nonce] = await of(web3.eth.getTransactionCount(sender));
    const details = {
        from: sender,
        to: tokenAddress,
        // gasLimit: 6721975,
        // gasPrice: 20000000000,
        gasPrice: web3.utils.toHex(web3.utils.toWei('45'.toString(), 'gwei')),
        gasLimit: web3.utils.toHex(1000000), // Raise the gas limit to a much higher amount
        nonce,
        data: TokenContract.methods.approve(process.env.CONTRACT_ADDRESS, amount).encodeABI(),
        value: '0x0',
    };
    await signAndTransact(privateKey, details, 'approve');
    // return signAndSend;
    return true;
};

exports.getDecimal = async(symbol) => {
    const tokenAbi = allDefaultTokens[symbol].abi;
    const tokenAddress = allDefaultTokens[symbol].address;
    const TokenContract = new web3.eth.Contract(tokenAbi, tokenAddress);
    return new Promise((resolve, reject) => {
        TokenContract.methods.decimals().call().then((value) => resolve(value));
    });
};

exports.withdraw = async(withdrawObj) => {
    const {
        sender,
        senderEmail,
        receiver,
        symbol,
        privateKey,
    } = withdrawObj;
    let details;
    let amount = withdrawObj.amount;
    amount = web3.utils.toWei(amount.toString(), 'ether');
    const [nonce] = await of(web3.eth.getTransactionCount(sender));
    // const txGasPrice = await web3.eth.getGasPrice();
    // console.log({ txGasPrice: `${txGasPrice} wei` })
    // console.log({ txGasPriceInEther: web3.utils.fromWei(txGasPrice) })

    if (symbol == "ETH") {
        details = {
            from: sender,
            to: receiver,
            gasPrice: web3.utils.toHex(web3.utils.toWei('45'.toString(), 'gwei')),
            gasLimit: web3.utils.toHex(1000000), // Raise the gas limit to a much higher amount
            nonce,
            value: web3.utils.toHex(amount)
        };
    } else {
        const tokenAbi = allDefaultTokens[symbol].abi;
        const tokenAddress = allDefaultTokens[symbol].address;
        const TokenContract = new web3.eth.Contract(tokenAbi, tokenAddress);
        details = {
            from: sender,
            to: tokenAddress,
            gasPrice: web3.utils.toHex(web3.utils.toWei('45'.toString(), 'gwei')),
            gasLimit: web3.utils.toHex(1000000), // Raise the gas limit to a much higher amount
            nonce,
            data: TokenContract.methods.transfer(receiver, amount).encodeABI(),
            value: '0x0',
        };
    }
    // const estimateGasCost = await estimateGas(details)
    // console.log({ estimateGasCost: `${Number(estimateGasCost)} is estimated gas cost` })
    // const calGasCost = (txGasPrice * Number(estimateGasCost))
    // console.log({ calGasCost: `${calGasCost} is total gas cost` })
    // const ok1 = web3.utils.fromWei(Number(calGasCost).toString())
    // console.log({ calGasCostInEther: ok1 })
    const res = await signAndTransact(privateKey, details);
    return res;
};

/**
 *
 * @description Get token balance of a vault address
 * @param {*} symbol
 * @param {*} vaultAddress
 * @returns {number} balance
 */
exports.getBalance = async(symbol, vaultAddress) => {
    const VaultContract = new web3.eth.Contract(vaultContract.abi, process.env.CONTRACT_ADDRESS);
    const tokenAddress = allDefaultTokens[symbol].address;
    const tokenAbi = allDefaultTokens[symbol].abi;
    const TokenContract = new web3.eth.Contract(tokenAbi, tokenAddress);
    const TokenDecimals = await this.getDecimal(symbol);
    return new Promise(((resolve, reject) => {
        TokenContract.methods.balanceOf(vaultAddress).call().then((balance) => {
                const tokenbits = (new BN(10)).pow(TokenDecimals);
                balance = new BN(balance).dividedBy(tokenbits);
                resolve(balance)
                    //resolve(this.toFixedNoRounding(balance))
                    //resolve(this.cutBalance(balance, 4));
                    // const tokenbits = (new BN(10)).pow(TokenDecimals);
                    // balance = new BN(balance).dividedBy(tokenbits);
                    //resolve(new BN(balance).toFixed(3))
                    //resolve(this.truncateToDecimals('35988696.999999999999997566', 3))
                    // const value = web3.utils.fromWei(balance, 'ether');
                    // console.log({ value })
            })
            .catch((error) => {
                logger.info(`Vault Balance Error: ${error.message}`);
                reject(error);
            });
    }));
};

exports.getAllBalance = async(vaultAddress) => {
    const result = [];
    // const tokenAddress = allDefaultTokens[symbol].address;
    for (const token in allDefaultTokens) {
        if (allDefaultTokens.hasOwnProperty(token)) {
            // console.log(allDefaultTokens[token])
            const balance = await this.getBalance(allDefaultTokens[token].symbol, vaultAddress);
            result.push({
                symbol: allDefaultTokens[token].symbol,
                balance,
            });
        }
    }
    return result;
};


exports.getEvents = async(vaultAddress) => {
    const VaultContract = new web3.eth.Contract(vaultContract.abi, process.env.CONTRACT_ADDRESS);
    const latestBlock = await web3.eth.getBlockNumber();
    //console.log({ latestBlock })
    return await VaultContract.getPastEvents('TransferSuccessful', {
        filter: { recipient: vaultAddress },
        fromBlock: 'latest'
            //fromBlock: latestBlock,
            //toBlock: 'latest'
    }).then((e) => {
        return e
    })
};

exports.getWalletBalance = async(walletAddress) => {
    let balance = await web3.eth.getBalance(walletAddress);
    return balance / (10 ** 18);
};

/**
 *
 * @description Get information about a transaction
 * @param {string} transactionHash
 * @returns
 */
exports.getTransactionInfo = (transactionHash) => {
    const txInfo = web3.eth.getTransaction(transactionHash);
    return txInfo;
};

exports.forTest = async() => {
    // const mnemonic = await utils.HDNode.entropyToMnemonic(ethers.utils.randomBytes(16));
    // const wallet = ethers.Wallet.fromMnemonic(mnemonic);
    // return wallet;

    const privateKey = "B493823E0098A0DE2C6A31FC970C2BC7A90C98F3C35E7F74F89D7DC9E3623B72";
    const wallet = new ethers.Wallet(privateKey);
    return wallet;

    // const encrypted = cryptoJS.AES.encrypt("future primary head voice team extend camp sheriff phrase long naive abuse", "Secret Passphrase");
    // // console.log({ encrypted });

    // const decrypted = cryptoJS.AES.decrypt(encrypted, "Secret Passphrase");
    // console.log({ decrypted });

    // const plaintext = decrypted.toString(cryptoJS.enc.Utf8);
    // console.log({ plaintext })

    // const wallet = ethers.Wallet.fromMnemonic(plaintext);
    // return wallet;

    // const mnemonic = "design young alien category assist polar priority lemon fatal satisfy draft find";
    // const wallet = ethers.Wallet.fromMnemonic(mnemonic);
    // return wallet;
};