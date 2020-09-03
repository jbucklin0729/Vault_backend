/* eslint-disable no-trailing-spaces */
/* eslint-disable indent */
/* eslint-disable eol-last */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const bearToken = JSON.parse(fs.readFileSync(path.resolve(__dirname, './supportedTokens/BearToken.json'), 'utf8'));
const cubToken = JSON.parse(fs.readFileSync(path.resolve(__dirname, './supportedTokens/CubToken.json'), 'utf8'));
const Dai = JSON.parse(fs.readFileSync(path.resolve(__dirname, './supportedTokens/Dai.json'), 'utf8'));
const Hydro = JSON.parse(fs.readFileSync(path.resolve(__dirname, './supportedTokens/Hydro.json'), 'utf8'));

// const bearToken = JSON.parse(fs.readFileSync(path.resolve(__dirname, './supportedTokens/BearToken_.json'), 'utf8'));
// const cubToken = JSON.parse(fs.readFileSync(path.resolve(__dirname, './supportedTokens/CubToken_.json'), 'utf8'));

exports.allTokens = {
    BEAR: {
        address: process.env.BEAR_ADDRESS,
        abi: bearToken.abi,
    },
    CUB: {
        address: process.env.CUB_ADDRESS,
        abi: cubToken.abi,
    },
    ETH: {
        // address: process.env.HYDRO_ADDRESS
        address: process.env.CUB_ADDRESS,
    },
    DAI: {
        address: process.env.DAI_ADDRESS,
        abi: Dai.abi,
    },
    HYDRO: {
        address: process.env.HYDRO_ADDRESS,
        abi: Hydro.abi
    }
};

exports.tokenSymbol = {
    [process.env.BEAR_ADDRESS]: 'BEAR',
    [process.env.CUB_ADDRESS]: 'CUB',
    [process.env.DAI_ADDRESS]: 'DAI',
    [process.env.HYDRO_ADDRESS]: 'HYDRO'
};