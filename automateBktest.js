const http = require('http');
const fs = require('fs');
const Pushover = require("pushover-notifications");
const p = new Pushover({
  user: 'us7CARhU1Rw6WXpLEYy2aLjAiaTkCH',
  token: 'aufx54z8fxrkchnkqgj2whv1sed7if',
});

function callBacktestApi(strategiConfig, callback) {
  var body = JSON.stringify(strategiConfig);
  var options = {
    host: '192.168.50.39',
    port: 3000,
    path: '/api/backtest',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };
  const postRequest = http.request(options, (response) => {
    let str = '';
    response.on('data', chunk => str += chunk);
    response.on('end', () => callback(JSON.parse(str)));
  });
  postRequest.write(body);
  postRequest.end();
}

function createRSIStragegy(params) {
  return {
    gekkoConfig: {
      watch: {
        exchange: params.exchange || 'poloniex',
        currency: params.currency || 'BTC',
        asset: params.asset || 'ETH',
      },
      paperTrader: {
        enabled: true,
        // report the profit in the currency or the asset?
        reportInCurrency: true,
        // start balance, on what the current balance is compared with
        simulationBalance: {
          // these are in the unit types configured in the watcher.
          asset: 1,
          currency: 100,
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
          from: params.fromDate || '2017-09-22T00:00:00Z',
          to: params.toDate || '2017-09-28T00:00:00Z',
        },
        batchSize: 50
      },
      valid: true,

      'RSI': {
        /*RSI*/interval: params.interval,
        thresholds: {
          /*RSI*/low: params.low,
          /*RSI*/high: params.high,
          /*RSI*/persistence: params.persistence
        }
      },
      'tradingAdvisor': {
        enabled: true,
        method: 'RSI',
        candleSize: params.candleSize,
        historySize: params.historySize,
      },
      performanceAnalyzer: {
        enabled: true,
        riskFreeReturn: 5
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
    }
  }
}

let array_index = 0;
let best_number = [];
let firstStat = ['interval', 7, 12];
let secondStat = ['low', 25, 35];
let thirdStat = ['high', 65, 75];
let unchanged = {
  persistence: 1,
  candleSize: 4,
  historySize: 10,
}

function returnArr(unchanged) {
  let arr = [];
  for (let first = firstStat[1]; first <= firstStat[2]; first++) {
    for (let second = secondStat[1]; second <= secondStat[2]; second++) {
      for (let third = thirdStat[1]; third <= thirdStat[2]; third++) {
        let dat = unchanged;
        dat[firstStat[0]] = first;
        dat[secondStat[0]] = second;
        dat[thirdStat[0]] = third;

        arr.push(createRSIStragegy(dat));
      }
    }
  }
  return arr;
}

fs.writeFile('testresult.txt', '');

function runningFunc(array_list, int) {
  if (array_list.length > array_index) {
    fs.appendFileSync('testresult.txt', `TEST#${array_index + 1}
    CandleSize: ${array_list[array_index].gekkoConfig.tradingAdvisor.candleSize}
    HistorySize: ${array_list[array_index].gekkoConfig.tradingAdvisor.historySize}
    Interval: ${array_list[array_index].gekkoConfig.RSI.interval}
    Low: ${array_list[array_index].gekkoConfig.RSI.thresholds.low} 
    High: ${array_list[array_index].gekkoConfig.RSI.thresholds.high} 
    Persistence: ${array_list[array_index].gekkoConfig.RSI.thresholds.persistence}\n`);

    callBacktestApi(array_list[array_index],
      (result) => {
        fs.appendFileSync('testresult.txt', `Trades: ${result.trades.length} | Market: ${result.report.market.toFixed(2)}% | Bot: ${result.report.relativeProfit.toFixed(2)}% | Balance: ${result.report.balance} \n\n`);
        best_number.push({
          'test_num': array_index,
          'trades': result.trades.length,
          'market': result.report.market,
          'gain': result.report.relativeProfit
        });
        array_index++;
      });
  } else {
    let MAX = best_number.reduce(function (prev, curr) {
      return prev.gain > curr.gain ? prev : curr;
    });
    clearInterval(int);
    let message = {
      message: `Finding RSI is completed... ${array_list.length} records are calculated. 
      Test #: ${MAX.test_num + 1}
      Market Rate: ${MAX.market.toFixed(2)}% 
      Bot Rate: ${MAX.gain.toFixed(2)}%`,
      title: "Found RSI",
      sound: 'cosmic',
      device: 'pliu'
    };
    p.send(message, err => {
      if (err) {
        console.log(err)
      }
    });
  }
}

let int = setInterval(() => {
  runningFunc(returnArr(unchanged), int)
}, 2000);
