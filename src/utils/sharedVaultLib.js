/* eslint-disable no-restricted-syntax */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-param-reassign */
/* eslint-disable indent */
/* eslint-disable quotes */
/* eslint-disable quote-props */
const Web3 = require('web3');
const cryptoJS = require("crypto-js");
const EthCrypto = require('eth-crypto');
const ethers = require('ethers');
const utils = ethers.utils;
const fs = require('fs');
const BN = require('bignumber.js');
const path = require('path');
const axios = require('axios');
const { of } = require('await-of');
const EthereumTx = require('ethereumjs-tx').Transaction;
const logger = require('../config/winston');
require('dotenv').config();

const { allTokens: allDefaultTokens } = require('./allTokens');


const provider = new Web3.providers.HttpProvider(process.env.TESTNET_RINKEBY);

// const provider = new Web3.providers.HttpProvider('http://127.0.0.1:7545');

//const provider = new Web3.providers.HttpProvider(process.env.INFURA_ENDPOINT);

const web3 = new Web3(provider);

exports.web3 = web3;
// const bearToken = JSON.parse(fs.readFileSync(path.resolve(__dirname, './BearToken_.json'), 'utf8'));
// const vaultContract = JSON.parse(fs.readFileSync(path.resolve(__dirname, './HydroVaultContract_.json'), 'utf8'));

const vaultContract = JSON.parse(fs.readFileSync(path.resolve(__dirname, './HydroVaultContract.json'), 'utf8'));



const setGasPrice = () => {
    web3.eth.getGasPrice((err, price) => {
        price = web3.utils.fromWei(price, 'gwei');
        //console.log('diff>>', price)
        return price;
    });
};

const getCurrentGasPrices = async() => {
    const response = await axios.get('https://ethgasstation.info/json/ethgasAPI.json')
    const prices = {
        low: response.data.safeLow / 10,
        medium: response.data.average / 10,
        high: response.data.fast / 10,
    }

    // console.log("\r\n")
    // logger.debug(`Current ETH Gas Prices (in GWEI):`);
    // console.log("\r\n")
    // logger.debug(`Low: ${prices.low} (transaction completes in < 30 minutes)`)
    // logger.debug(`Standard: ${prices.medium} (transaction completes in < 5 minutes)`)
    // logger.debug(`Fast: ${prices.high} (transaction completes in < 2 minutes)`)
    // console.log("\r\n")

    return prices;
}

/**
 * @description - Genarate Ethereum wallet for user
 * @returns {string} address
 */
exports.generateWallet = async() => {
    const mnemonic = await utils.HDNode.entropyToMnemonic(ethers.utils.randomBytes(16));
    const wallet = ethers.Wallet.fromMnemonic(mnemonic);
    return wallet.signingKey;
};

async function signAndTransact(privateKey, details) {
    const transaction = new EthereumTx(details, { chain: 'rinkeby', hardfork: 'petersburg' });
    //const transaction = new EthereumTx(details);
    transaction.sign(Buffer.from(`${privateKey}`.substring(2), 'hex'));
    const serializedTransaction = transaction.serialize();
    const addr = transaction.from.toString('hex');
    logger.info(`Based on your private key, your wallet address is ${addr}`);
    const res = await web3.eth.sendSignedTransaction(`0x${serializedTransaction.toString('hex')}`);
    // logger.debug('TxHash', `https://rinkeby.etherscan.io/tx/${res.transactionHash}`)
    return res;
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
    const signAndSend = await signAndTransact(privateKey, details);
    return signAndSend;
};

exports.checkSigner = async(signerAddress, vaultAddress) => {
    const VaultContract = new web3.eth.Contract(vaultContract.abi, process.env.CONTRACT_ADDRESS);
    return new Promise(((resolve, reject) => {
        VaultContract.methods.checkSigner(signerAddress).call({ from: vaultAddress }).then((isValid) => {
                resolve(isValid);
            })
            .catch((error) => {
                logger.info(`Vault Check Error: ${error.message}`);
                reject(error);
            });
    }));
};
exports.verifySignature = async(signerAddress, signerPrivateKey, vaultAddress) => {
    const VaultContract = new web3.eth.Contract(vaultContract.abi, process.env.CONTRACT_ADDRESS);
    const signHash = EthCrypto.hash.keccak256([{ // prefix
            type: 'string',
            value: 'Signed for Vault Multisig:',
        },
        {
            type: 'address',
            value: process.env.CONTRACT_ADDRESS,
        }, {
            type: 'address',
            value: signerAddress
        }
    ]);
    const signature = EthCrypto.sign(
        signerPrivateKey,
        signHash,
    );
    // we have to split the signature-hex-string into its parts
    const vrs = EthCrypto.vrs.fromString(signature);
    return new Promise(((resolve, reject) => {
        VaultContract.methods.isSignatureValid(signerAddress, vrs.v, vrs.r, vrs.s).call({ from: vaultAddress }).then((isValid) => {
                resolve(isValid);
            })
            .catch((error) => {
                logger.info(`Vault Signature Error: ${error.message}`);
                reject(error);
            });
    }));
};

exports.getDecimal = async(symbol) => {
    const tokenAbi = allDefaultTokens[symbol].abi;
    const tokenAddress = allDefaultTokens[symbol].address;
    const TokenContract = new web3.eth.Contract(tokenAbi, tokenAddress);
    return new Promise((resolve, reject) => {
        TokenContract.methods.decimals().call().then((value) => resolve(value));
    });
};

exports.multiSig = async(withdrawObj) => {
    let details;
    const { metaPayer, metaPayerPK, vaultAddress, receiver, symbol, countSignatures } = withdrawObj;
    let amount = withdrawObj.amount;
    amount = web3.utils.toWei(amount.toString(), 'ether');
    const [nonce] = await of(web3.eth.getTransactionCount(metaPayer));
    if (symbol == "ETH") {
        details = {
            from: vaultAddress,
            to: receiver,
            gasPrice: web3.utils.toHex(web3.utils.toWei('45'.toString(), 'gwei')),
            gasLimit: web3.utils.toHex(1000000), // Raise the gas limit to a much higher amount
            nonce,
            value: web3.utils.toHex(amount)
        };
    } else {
        const tokenAddress = allDefaultTokens[symbol].address;
        const Vaultcontract = new web3.eth.Contract(vaultContract.abi, process.env.CONTRACT_ADDRESS);
        details = {
            from: metaPayer,
            to: process.env.CONTRACT_ADDRESS,
            gasPrice: web3.utils.toHex(web3.utils.toWei('45'.toString(), 'gwei')),
            gasLimit: web3.utils.toHex(1000000), // Raise the gas limit to a much higher amount
            nonce,
            data: Vaultcontract.methods.transferTokenMulti(tokenAddress, receiver, amount, countSignatures, vaultAddress).encodeABI(),
            value: '0x0',
        };
    }
    const signAndSend = await signAndTransact(metaPayerPK, details);
    return signAndSend;
}

exports.addSigners = async(metaPayer, vaultAddress, signers, maxSigners, privateKey) => {
    console.log('second')
    const Vaultcontract = new web3.eth.Contract(vaultContract.abi, process.env.CONTRACT_ADDRESS);
    const [nonce] = await of(web3.eth.getTransactionCount(metaPayer));
    const details = {
        from: metaPayer,
        to: process.env.CONTRACT_ADDRESS,
        gasPrice: web3.utils.toHex(web3.utils.toWei('45'.toString(), 'gwei')),
        gasLimit: web3.utils.toHex(1000000), // Raise the gas limit to a much higher amount
        nonce,
        data: Vaultcontract.methods.addSigners(signers, maxSigners, vaultAddress).encodeABI(),
        value: '0x0',
    };
    const signAndSend = await signAndTransact(privateKey, details);
    return signAndSend;
}

exports.approveContract = async(metaPayer, owner, privateKey, symbol, amount) => {
    const tokenAbi = allDefaultTokens[symbol].abi;
    const tokenAddress = allDefaultTokens[symbol].address;
    const TokenContract = new web3.eth.Contract(tokenAbi, tokenAddress);
    const [nonce] = await of(web3.eth.getTransactionCount(owner));
    amount = web3.utils.toWei(amount.toString(), 'ether');
    const details = {
        from: owner,
        to: tokenAddress,
        gasPrice: web3.utils.toHex(web3.utils.toWei('25'.toString(), 'gwei')),
        gasLimit: web3.utils.toHex(1000000), // Raise the gas limit to a much higher amount
        nonce,
        data: TokenContract.methods.approve(process.env.CONTRACT_ADDRESS, amount).encodeABI(),
        value: '0x0',
    };
    const signAndSend = await signAndTransact(privateKey, details);
    return signAndSend;
}


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
    const TokenDecimals = await this.getDecimal(symbol);
    return new Promise(((resolve, reject) => {
        VaultContract.methods.balanceOf(tokenAddress, vaultAddress).call().then((balance) => {
                // balance = balance / (10 ** TokenDecimals);
                // resolve(balance);
                const tokenbits = (new BN(10)).pow(TokenDecimals);
                balance = new BN(balance).dividedBy(tokenbits);
                resolve(new BN(balance).toFixed(3))

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