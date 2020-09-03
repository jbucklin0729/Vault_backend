/* eslint-disable no-param-reassign */
/* eslint-disable indent */
/* eslint-disable quotes */
/* eslint-disable quote-props */
const Web3 = require('web3');
const ethers = require('ethers');
const axios = require('axios');

const utils = ethers.utils;
const fs = require('fs');
const path = require('path');
const { of } = require('await-of');
const EthereumTx = require('ethereumjs-tx').Transaction;
const logger = require('../config/winston');

require('dotenv').config();

const provider = new Web3.providers.HttpProvider(process.env.TESTNET_ROPSTEN);

// const provider = new Web3.providers.HttpProvider('http://127.0.0.1:7545');


// const provider = new Web3.providers.HttpProvider(process.env.INFURA_ENDPOINT);


const web3 = new Web3(provider);

exports.web3 = web3;

const bearToken = JSON.parse(fs.readFileSync(path.resolve(__dirname, './supportedTokens/BearToken.json'), 'utf8'));
const cubToken = JSON.parse(fs.readFileSync(path.resolve(__dirname, './supportedTokens/CubToken.json'), 'utf8'));
const vaultContract = JSON.parse(fs.readFileSync(path.resolve(__dirname, './HydroVaultContract.json'), 'utf8'));

const bearTokenConfig = {
    address: "0x838EFeD0CCe1FF114801113b4d1Aa74D8eB12934",
    decimal: 18,
    name: "BearToken",
    symbol: "BEAR",
    abi: bearToken.abi,
};

const cubTokenConfig = {
    address: "0xd8C88845260d3f4f7594Ea2652EF0E008BC5284c",
    decimal: 18,
    name: "CubToken",
    symbol: "CUB",
    abi: cubToken.abi,
};

const allTokens = {
    "BEAR": bearTokenConfig,
    "CUB": cubTokenConfig,
};

const setGasPrice = () => {
    web3.eth.getGasPrice((err, price) => {
        price = web3.utils.fromWei(price, 'gwei');
        return price;
    });
};

const getCurrentGasPrices = async() => {
    const response = await axios.get('https://ethgasstation.info/json/ethgasAPI.json');
    const prices = {
        low: response.data.safeLow / 10,
        medium: response.data.average / 10,
        high: response.data.fast / 10,
    };
    // log("\r\n");
    // log('Current ETH Gas Prices (in GWEI):');
    // log(`Low: ${prices.low} (transaction completes in < 30 minutes)`);
    // log(`Standard: ${prices.medium} (transaction completes in < 5 minutes)`);
    // log(`Fast: ${prices.high} (transaction completes in < 2 minutes)`);
    // log("\r\n");
    return prices;
};

// const watchEvents_ = async(receiverAddress, amount) => {
//     const accounts = await web3.eth.getAccounts();
//     const tokenzrDeployed = await tokenZendr.deployed();
//     const tokenzrInstance = tokenzrDeployed;
//     let param = { from: accounts[0], to: receiverAddress, amount };

//     tokenzrInstance.TransferSuccessful(param, {
//         fromBlock: 0,
//         toBlock: 'latest'
//     }).watch((error, event) => {
//         console.log(event);
//     })
// }

// const watchEvents = async(receiverAddress, amount) => {
//     const accounts = await web3.eth.getAccounts();
//     let param = { from: accounts[0], to: receiverAddress, amount };
//     const TZContract = new web3.eth.Contract(tzContract, process.env.TZContract);
//     console.log(TZContract.events.TransferSuccessful(param, {
//         fromBlock: 0,
//         toBlock: 'latest'
//     }))
// }

async function signAndTransact(wallet, details) {
    const transaction = new EthereumTx(details, { chain: 'ropsten', hardfork: 'petersburg' });
    transaction.sign(Buffer.from('B493823E0098A0DE2C6A31FC970C2BC7A90C98F3C35E7F74F89D7DC9E3623B72', 'hex'));
    const serializedTransaction = transaction.serialize();
    const addr = transaction.from.toString('hex');
    logger.info(`Based on your private key, your wallet address is ${addr}`);
    web3.eth.sendSignedTransaction(`0x${serializedTransaction.toString('hex')}`)
        .on('confirmation', (number) => {
            console.log({ number });
        })
        .on('receipt', (receipt) => {
            console.log({ receipt });
        })
        .on('error', console.error);

    // return transaction_details ? transaction_details : err;

    // const privateKey = wallet.privateKey;
    // const sender = web3.eth.accounts.privateKeyToAccount(privateKey);
    // const signedTx = await sender.signTransaction(details);

    // console.log({ signedTx })

    // web3.eth.sendSignedTransaction('0x' + serializedTransaction.toString('hex'))
    // web3.eth.sendSignedTransaction(signedTx.rawTransaction)
    //     .on('receipt', (receipt) => {
    //         console.log({ receipt })
    //         console.log(receipt.logs)
    //     })
    //     .on('transactionHash', (hash) => {
    //         console.log({ hash })
    //     })
    // .on('confirmation', (con) => {
    //     console.log({ con })
    // })
}

exports.create = async(senderEmail, vaultId) => {
    const accounts = await web3.eth.getAccounts();
    const VaultContract = new web3.eth.Contract(vaultContract.abi, process.env.CONTRACT_ADDRESS);
    const gasPrices = await getCurrentGasPrices();
    console.log({ gasPrices });
    // return new Promise(((resolve, reject) => {
    //     Vaultcontract.methods.create(userEmail, `"${vaultId}"`).send({
    //             from: "0xD30938b81a4767b9f5eF1Ee35968376ee2959EBc",
    //             gas: "3000000",
    //         }).then((receipt) => {
    //             resolve(receipt);
    //         })
    //         .catch((error) => {
    //             logger.info(`Vault Create Error: ${error.message}`);
    //             reject(error);
    //         });
    // }));
    const transObj = {
        from: "0x0cfC16DBBd960d5F0C312C339906080aEc5E0939",
        gas: '200000',
        gasPrice: setGasPrice(),
    };

    const [bal3, err3] = await of(VaultContract.methods.balanceOf("0x0cfC16DBBd960d5F0C312C339906080aEc5E0939", transObj.from).call());
    console.log({ bal3 });
    const [bal4] = await of(web3.eth.getBalance(transObj.from));
    console.log({ bal4 });
    const [nonce] = await of(web3.eth.getTransactionCount(transObj.from));
    const amountToSend = 0.00100000;
    const details = {
        "to": process.env.CONTRACT_ADDRESS,
        // "to": receiverAddress,
        // "gas": transObj.gas,
        // "gasPrice": transObj.gasPrice,
        // gasLimit: web3.utils.toHex(25000),
        // gasPrice: web3.utils.toHex(10e9),
        // "gas": 8000000,
        // "gasPrice": gasPrices.low * 1000000000,
        // gas: '200000',
        gasPrice: setGasPrice(),
        "gas": 2000000,
        // "gasPrice": gasPrices.low * 1000000000, // converts the gwei price to wei
        "nonce": nonce,
        "data": VaultContract.methods.create(senderEmail, vaultId).encodeABI(),
        "value": web3.utils.toHex(web3.utils.toWei(amountToSend.toString(), 'ether')),
        // "chainId": 3,
    };
    const wallet = {
        privateKey: "B493823E0098A0DE2C6A31FC970C2BC7A90C98F3C35E7F74F89D7DC9E3623B72",
    };
    const res = await signAndTransact(wallet, details);
    console.log({ res });
};

exports.perToken = async() => {
    const accounts = await web3.eth.getAccounts();
    const transObj = {
        from: accounts[7],
    };
    for (token in allTokens) {
        console.log({ token });
        let result = {};
        const TokenContract = new web3.eth.Contract(allTokens[token].abi, allTokens[token].address);
        const [bal] = await of(TokenContract.methods.balanceOf(transObj.from).call());
        const web3bal = await web.eth.getBalance(transObj.from);
        const [name] = await of(TokenContract.methods.name().call());
        const [symbol] = await of(TokenContract.methods.symbol().call());
        const [decimal] = await of(TokenContract.methods.decimals().call());
        const converted = bal / (10 ** decimal);
        console.log({ bal });
        result = {
            name,
            symbol,
            decimal,
            bal: converted.toFixed(decimal),
        };
        console.log({ result });
    }
};

async function approveContract(senderAddress, tokenContract, contractAddress, amount) {
    const gasPrices = await getCurrentGasPrices();
    const transObj = {
        from: senderAddress,
        gas: '0x7a1200',
        // gas: "8000000",
        // gas: web3.utils.toHex(8000000),
        gasPrice: setGasPrice(),
    };
    const [nonce] = await of(web3.eth.getTransactionCount(transObj.from));
    const details = {
        "to": contractAddress,
        "gas": transObj.gas,
        // "gas": "0x7a1200",
        "gasPrice": gasPrices.low * 1000000000,
        "nonce": nonce,
        "data": tokenContract.methods.approve(contractAddress, amount).encodeABI(),
        "value": '0x0',
    };
    const signAndSend = await signAndTransact("", details);
    console.log({ signAndSend });
}


exports.w = async(senderAddress, receiverAddress, amount, symbol) => {
    const gasPrices = await getCurrentGasPrices();
    const senderEmail = "akinde@hydrolabs.org";
    const getTokenInfo = allTokens[symbol];
    const tokenAddress = getTokenInfo.address;
    const TokenContract = new web3.eth.Contract(getTokenInfo.abi, getTokenInfo.address);
    const VaultContract = new web3.eth.Contract(vaultContract.abi, process.env.CONTRACT_ADDRESS);
    const transObj = {
        from: "0x0cfC16DBBd960d5F0C312C339906080aEc5E0939",
        gas: '200000',
        gasPrice: setGasPrice(),
    };
    const approved = await approveContract('0x0cfC16DBBd960d5F0C312C339906080aEc5E0939', TokenContract, process.env.CONTRACT_ADDRESS, amount);
    console.log({ approved });
    // return;
    if (approved) {
        console.log("approved!!");
        //     // amount *= (10 ** getTokenInfo.decimal);
        // const [nonce] = await of(web3.eth.getTransactionCount(transObj.from, 'pending'));
        // const details = {
        //     to: process.env.CONTRACT_ADDRESS,
        //     // gas: "8000000",
        //     //gas: web3.utils.toHex(8000000),
        //     gas: '0x7a1200',
        //     gasPrice: gasPrices.low * 1000000000,
        //     nonce,
        //     data: VaultContract.methods.transferToken(senderEmail, tokenAddress, receiverAddress, amount).encodeABI(),
        //     value: '0x0',
        // };
        // const res = await signAndTransact("", details);
        // console.log({ res })

        // const [bal, err2] = await of(TokenContract.methods.balanceOf(transObj.from).call());
        // console.log({ bal });
        // const [bal3, err3] = await of(VaultContract.methods.balanceOf(getTokenInfo.address, transObj.from).call());
        // console.log({ bal3 });
    }
};

exports.getTransactionReceipt = async(txHash) => {
    const receipt = await web3.eth.getTransactionReceipt('0xf7bc3dbf1e6da3a2319b73e7b10df06f379212aba8535d02f8fc7aabcac053ce');
    console.log({ receipt });
};

exports.wLA8 = async(senderAddress, receiverAddress, amount, symbol) => {
    const senderEmail = "akinde@hydrolabs.org";
    const account1 = '0x0cfC16DBBd960d5F0C312C339906080aEc5E0939'; // Your account address 1
    web3.eth.defaultAccount = account1;
    const getTokenInfo = allTokens[symbol];
    console.log(`token address is ${getTokenInfo.address}`);
    const tokenAddress = getTokenInfo.address;

    const privateKey1 = Buffer.from('B493823E0098A0DE2C6A31FC970C2BC7A90C98F3C35E7F74F89D7DC9E3623B72', 'hex');

    const abi = vaultContract.abi;
    const contract_Address = process.env.CONTRACT_ADDRESS;

    const myContract = new web3.eth.Contract(abi, contract_Address);

    const myData = myContract.methods.transferToken(senderEmail, tokenAddress, receiverAddress, amount).encodeABI();

    web3.eth.getTransactionCount(account1, (err, txCount) => {
        // Build the transaction
        const txObject = {
            nonce: web3.utils.toHex(txCount),
            to: contract_Address,
            value: web3.utils.toHex(web3.utils.toWei('0', 'ether')),
            gasLimit: web3.utils.toHex(4100000),
            gasPrice: web3.utils.toHex(web3.utils.toWei('6', 'gwei')),
            data: myData,
        };
        // Sign the transaction
        // const tx =  Tx(txObject);
        const tx = new EthereumTx(txObject, { chain: 'ropsten', hardfork: 'petersburg' });
        tx.sign(privateKey1);

        const serializedTx = tx.serialize();
        const raw = `0x${serializedTx.toString('hex')}`;

        // Broadcast the transaction
        const transaction = web3.eth.sendSignedTransaction(raw, (err, tx) => {
            console.log({ err });
            console.log({ tx });
        });
        // console.log({ transaction })
    });
};

exports.w_real = async(senderAddress, receiverAddress, amount, symbol) => {
    const getTokenInfo = allTokens[symbol];
    const accounts = await web3.eth.getAccounts();
    const tokenAddress = getTokenInfo.address;
    const TokenContract = new web3.eth.Contract(getTokenInfo.abi, getTokenInfo.address);
    const VaultContract = new web3.eth.Contract(vaultContract.abi, process.env.CONTRACT_ADDRESS);
    const transObj = {
        from: accounts[0],
        gas: '200000',
        gasPrice: setGasPrice(),
    };
    const [bal, err2] = await of(TokenContract.methods.balanceOf(transObj.from).call());
    const [bal3, err3] = await of(VaultContract.methods.balanceOf(getTokenInfo.address, transObj.from).call());
    const [bal5, err5] = await of(TokenContract.methods.approve(process.env.CONTRACT_ADDRESS, amount).send(transObj));

    const [nonce] = await of(web3.eth.getTransactionCount(transObj.from));
    console.log({ nonce });
    // if (res) {
    // console.log({ res });
    // console.log(res.events);
    // watchEvents(receiverAddress, amount);
    // const [res_, err_] = await of(ExchangeContract.methods.transferToken('', tokenAddress, receiverAddress, amount).send(transObj));
    // if (res_) {
    //     console.log("good");
    //     console.log(res_.events.TransferSuccessful);
    // } else {
    //     console.log("aw!!");
    //     console.log({ err_ });
    // }
    const details = {
        "from": transObj.from,
        "to": receiverAddress,
        "gas": transObj.gas,
        "gasPrice": transObj.gasPrice,
        "nonce": nonce,
        "data": VaultContract.methods.transferToken('', '0x0', receiverAddress, amount).encodeABI(),
        "value": '0x0',
    };
    const wallet = {
        privateKey: "d0bdfda237689dcea2aa89711076b689af81082cbb4a24d439088a3f9312b10e",
    };
    const res = await signAndTransact(wallet, details);
    console.log({ res });
};


exports.addNewToken = async(symbol, address) => {
    const accounts = await web3.eth.getAccounts();
    const bytesData = web3.utils.fromAscii(symbol);
    console.log({ bytesData });
    const transObj = {
        from: accounts[0],
        gas: '200000',
        gasPrice: setGasPrice(),
    };
    const TZContract = new web3.eth.Contract(tzContract, process.env.TZContract);
    const [, err] = await of(TZContract.methods.addNewToken(bytesData, address).send(transObj));
    if (err) {
        console.log("add error", err);
        return false;
    }
    return true;
};

exports.removeToken = async(symbol) => {
    const accounts = await web3.eth.getAccounts();
    const bytesData = web3.utils.fromAscii(symbol);
    console.log({ bytesData });
    const transObj = {
        from: accounts[0],
        gas: '200000',
        gasPrice: setGasPrice(),
    };
    const TZContract = new web3.eth.Contract(tzContract, process.env.TZContract);
    const [, err] = await of(TZContract.methods.removeToken(bytesData).send(transObj));
    if (err) {
        console.log("add error", err);
        return false;
    }
    return true;
};