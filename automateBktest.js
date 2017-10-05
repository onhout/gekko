const http = require('http');
const fs = require('fs');
const Pushover = require("pushover-notifications");
const p = new Pushover({
  user: 'us7CARhU1Rw6WXpLEYy2aLjAiaTkCH',
  token: 'aufx54z8fxrkchnkqgj2whv1sed7if',
});

let array_index = 0;
let best_number = [];
let loopArr = [['low', 15, 35], ['high', 65, 85], ['interval', 7, 15]];
let unchanged = {
  candleSize: 5,
  historySize: 10,
  method: 'RSI',
  fromDate: '2017-09-05T00:00:00Z',
  toDate: '2017-09-30T00:00:00Z'
};
let firstArrName = loopArr[0][0];
let secondArrName = loopArr[1][0];
let thirdArrName = loopArr[2][0];


function callBacktestApi(strategiConfig, callback) {
  let body = JSON.stringify(strategiConfig);
  let options = {
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

function createStragegy(params) {
  let obj = {
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
  };

  obj.gekkoConfig[params.method] = {
    /*RSI*/interval: params.interval,
    thresholds: {
      /*RSI*/low: params.low,
      /*RSI*/high: params.high,
      // How many candle intervals should a trend persist
      // before we consider it real?
      /*RSI*/persistence: 2
    }
  };
  obj.algoInfo = {};
  obj['algoInfo'][firstArrName] = params[firstArrName];
  obj['algoInfo'][secondArrName] = params[secondArrName];
  obj['algoInfo'][thirdArrName] = params[thirdArrName];

  return obj;
}

function returnArr(unchanged, loopArr) {
  let arr = [];
  for (let first = loopArr[0][1]; first <= loopArr[0][2]; first++) {
    for (let second = loopArr[1][1]; second <= loopArr[1][2]; second++) {
      for (let third = loopArr[2][1]; third <= loopArr[2][2]; third++) {
        let dat = unchanged;
        dat[firstArrName] = first;
        dat[secondArrName] = second;
        dat[thirdArrName] = third;

        arr.push(createStragegy(dat));
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
    ${firstArrName}: ${array_list[array_index]['algoInfo'][firstArrName]} 
    ${secondArrName}: ${array_list[array_index]['algoInfo'][secondArrName]}
    ${thirdArrName}: ${array_list[array_index]['algoInfo'][thirdArrName]}\n`);

    callBacktestApi(array_list[array_index],
      (result) => {
        fs.appendFileSync('testresult.txt', `Trades: ${result.trades.length} | Market: ${result.report.market.toFixed(2)}% | Bot: ${result.report.relativeProfit.toFixed(2)}% | Balance: ${result.report.balance} \n\n`);
        let numbers = {
          'test_num': array_index + 1,
          'trades': result.trades.length,
          'market': result.report.market,
          'gain': result.report.relativeProfit,
        };
        numbers[firstArrName] = array_list[array_index]['algoInfo'][firstArrName];
        numbers[secondArrName] = array_list[array_index]['algoInfo'][secondArrName];
        numbers[thirdArrName] = array_list[array_index]['algoInfo'][thirdArrName];

        console.log(numbers);
        best_number.push(numbers);
        array_index++;
      });
  } else {
    let MAX = best_number.reduce(function (prev, curr) {
      return prev.gain > curr.gain ? prev : curr;
    });
    clearInterval(int);
    let message = {
      message: `Finding RSI is completed... ${array_list.length} records are calculated. 
      Test #: ${MAX.test_num}, 
      ${firstArrName}: ${MAX[firstArrName]}, ${secondArrName}: ${MAX[secondArrName]}, ${thirdArrName}: ${MAX[thirdArrName]},
      Market Rate: ${MAX.market.toFixed(2)}%, 
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
  runningFunc(returnArr(unchanged, loopArr), int)
}, 3000);
