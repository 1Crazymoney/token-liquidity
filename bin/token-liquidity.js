/*
  Liquidity app for Wormhole BCH tokens inspired by Bancors whitepaper
*/

'use strict'

const lib = require('../src/utils/token-util.js')
const got = require('got')
const config = require('../config')

// Used for debugging.
const util = require('util')
util.inspect.defaultOptions = {
  showHidden: true,
  colors: true
}

const BITBOXCli = require('bitbox-sdk/lib/bitbox-sdk').default
const BITBOX = new BITBOXCli({ restURL: 'https://trest.bitcoin.com/v1/' })
// const BITBOX = new BITBOXCli({ restURL: 'https://decatur.hopto.org/v1/' })

const Wormhole = require('wormhole-sdk/lib/Wormhole').default
const wormhole = new Wormhole({ restURL: `https://trest.bitcoin.com/v1/` })

const tknLib = require(`../src/utils/send-tokens.js`)
const bchLib = require(`../src/utils/send-bch.js`)

const BCH_ADDR1 = config.BCH_ADDR
const TOKEN_ID = config.TOKEN_ID

let bchBalance
let tokenBalance

async function startTokenLiquidity () {
  // Get BCH balance.
  const addressInfo = await lib.getBCHBalance(BCH_ADDR1, true, BITBOX)
  bchBalance = addressInfo.balance
  console.log(`BCH address ${BCH_ADDR1} has a balance of ${bchBalance} BCH`)

  // Get token balance.
  const tokenInfo = await lib.getTokenBalance(BCH_ADDR1, wormhole)
  console.log(`tokenInfo: ${JSON.stringify(tokenInfo, null, 2)}`)
  const thisToken = tokenInfo.find(token => token.propertyid === TOKEN_ID)
  tokenBalance = thisToken.balance
  console.log(`Token balance: ${tokenBalance}`)

  // Get the BCH-USD exchange rate.
  let USDperBCH
  try {
    const rawRate = await got(`https://api.coinbase.com/v2/exchange-rates?currency=BCH`)
    const jsonRate = JSON.parse(rawRate.body)
    // console.log(`jsonRate: ${JSON.stringify(jsonRate, null, 2)}`);
    USDperBCH = jsonRate.data.rates.USD
    console.log(`USD/BCH exchange rate: $${USDperBCH}`)
  } catch (err) {
    console.log(`Coinbase exchange rate could not be retrieved!. Assuming hard coded value.`)
    console.error(err)
    USDperBCH = 560
  }

  // Calculate exchange rate spot price.;
  const marketCap = USDperBCH * bchBalance
  console.log(`Market cap of BCH controlled by app: $${marketCap}`)
  const price = marketCap / tokenBalance
  console.log(`Token spot price: $${price}`)

  // Get the last transaction associated with this address.
  let lastTransaction = await lib.getLastConfirmedTransaction(BCH_ADDR1, BITBOX)

  // Periodically check the last transaction.
  setInterval(async function () {
    console.log(`Checking transactions...`)
    const obj = {
      bchAddr: BCH_ADDR1,
      txid: lastTransaction,
      bchBalance: bchBalance,
      tokenBalance: tokenBalance
    }

    const retObj = await lib.compareLastTransaction(obj, tknLib, bchLib, wormhole)
    const newTx = retObj.lastTransaction

    // Update the last transaction.
    if (newTx) lastTransaction = newTx
    if (retObj.bchBalance) bchBalance = retObj.bchBalance
    if (retObj.tokenBalance) tokenBalance = retObj.tokenBalance

    // New Balances:
    console.log(`bchBalance: ${bchBalance}, tokenBalance: ${tokenBalance}`)
  }, 60000 * 2)
}

module.exports = {
  startTokenLiquidity
}
