const http = require('http');
const fs = require('fs');
const Pushover = require("pushover-notifications");
const request = require('request');
const rp = require('request-promise');
const p = new Pushover({
  user: 'us7CARhU1Rw6WXpLEYy2aLjAiaTkCH',
  token: 'aufx54z8fxrkchnkqgj2whv1sed7if',
});
const ProgressBar = require('progress');

let array_index = 0;
let best_number = [];
let loopArr = [['low', 15, 35], ['high', 65, 85], ['interval', 5, 15]];
let unchanged = {
  candleSize: 5,
  historySize: 10,
  method: 'RSI',
  currency: 'BTC',
  asset: 'ETH',
  fromDate: '2017-09-11T00:00:00Z',
  toDate: '2017-10-11T00:00:00Z'
};
let firstArrName = loopArr[0][0];
let secondArrName = loopArr[1][0];
let thirdArrName = loopArr[2][0];

const ARRR = returnArr(unchanged, loopArr);

let bar = new ProgressBar('(:current/:total) |:bar| Elapsed: :elapseds | ETA: :etas', {
  complete: '=',
  incomplete: ' ',
  width: 30,
  total: ARRR.length
});


async function callBacktestApi(strategiConfig) {
  let options = {
    uri: 'http://192.168.50.39:3000/api/backtest',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: strategiConfig,
    json: true,
  };
  return await rp(options)
}

function createStragegy(params) {
  return {
    gekkoConfig: {
      watch: {
        exchange: params.exchange || 'poloniex',
        currency: params.currency,
        asset: params.asset,
      },
      paperTrader: {
        enabled: true,
        // report the profit in the currency or the asset?
        reportInCurrency: true,
        // start balance, on what the current balance is compared with
        simulationBalance: {
          // these are in the unit types configured in the watcher.
          asset: 1,
          currency: 1,
        },
        // how much fee in % does each trade cost?
        feeMaker: 0.15,
        feeTaker: 0.25,
        feeUsing: 'maker',
        // how much slippage/spread should Gekko assume per trade?
        slippage: 0.05,
      },
      backtest: {
        daterange: {
          from: params.fromDate,
          to: params.toDate,
        },
        batchSize: 50
      },
      valid: true,

      'tradingAdvisor': {
        enabled: true,
        method: params.method,
        candleSize: params.candleSize,
        historySize: params.historySize,
      },
      performanceAnalyzer: {
        enabled: true,
        riskFreeReturn: 5
      },
      [params.method]: {
        /*RSI*/interval: params.interval,
        thresholds: {
          /*RSI*/low: params.low,
          /*RSI*/high: params.high,
          // How many candle intervals should a trend persist
          // before we consider it real?
          /*RSI*/persistence: 2
        }
      }
    },
    data: {
      candleProps: [
        'close',
        'start'
      ],
      indicatorResults: true,
      report: true,
      roundtrips: true,
      trades: true
    },
    algoInfo: {
      [firstArrName]: params[firstArrName],
      [secondArrName]: params[secondArrName],
      [thirdArrName]: params[thirdArrName]
    }
  };
}

function returnArr(unchanged, loopArr) {
  let arr = [];
  for (let first = loopArr[0][1]; first <= loopArr[0][2]; first++) {
    for (let second = loopArr[1][1]; second <= loopArr[1][2]; second++) {
      for (let third = loopArr[2][1]; third <= loopArr[2][2]; third++) {
        let loopedData = {
          [firstArrName]: first,
          [secondArrName]: second,
          [thirdArrName]: third,
        };
        arr.push(createStragegy({...unchanged, ...loopedData}));
      }
    }
  }
  return arr;
}

fs.writeFile('testresult.txt', '');


(async() => {
  for (let array of ARRR) {
    fs.appendFileSync('testresult.txt', `TEST#${array_index + 1}
    CandleSize: ${array.gekkoConfig.tradingAdvisor.candleSize}
    HistorySize: ${array.gekkoConfig.tradingAdvisor.historySize}
    ${firstArrName}: ${array['algoInfo'][firstArrName]}
    ${secondArrName}: ${array['algoInfo'][secondArrName]}
    ${thirdArrName}: ${array['algoInfo'][thirdArrName]}\n`);

    const {report:report, trades:trades} = await callBacktestApi(array);

    fs.appendFileSync('testresult.txt',
      `Trades: ${trades.length} | Market: ${report.market.toFixed(2)}% | Bot: ${report.relativeProfit.toFixed(2)}% | Sharpe: ${report.sharpe} \n\n`);

    best_number.push({
      'test_num': array_index + 1,
      'trades': trades.length,
      'market': report.market,
      'gain': report.relativeProfit,
      'sharpe': report.sharpe,
      [firstArrName]: array.algoInfo[firstArrName],
      [secondArrName]: array.algoInfo[secondArrName],
      [thirdArrName]: array.algoInfo[thirdArrName],
    });

    array_index++;
    bar.tick();
    if (bar.complete) {
      let MAX = best_number.reduce((prev, curr) => {
        return prev.gain > curr.gain ? prev : curr;
      });
      let message = {
        message: `Finding RSI is completed... ${ARRR.length} records are calculated.
            Test #: ${MAX.test_num},
            ${firstArrName}: ${MAX[firstArrName]}, ${secondArrName}: ${MAX[secondArrName]}, ${thirdArrName}: ${MAX[thirdArrName]},
            Market Rate: ${MAX.market.toFixed(2)}%,
            Bot Rate: ${MAX.gain.toFixed(2)}%`,
        title: "Found RSI",
        sound: 'cosmic',
        device: 'pliu'
      };
      console.log('\ncomplete\n');
      p.send(message, err => {
        if (err) {
          console.log(err)
        }
      });
    }
  }
})();
