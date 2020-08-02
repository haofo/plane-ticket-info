require('dotenv').config();
const qs = require('qs');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

const params = {
  tripType: 'OW',
  searchType: 'FARE',
  flexibleSearch: false,
  directFlightsOnly: false,
  fareOptions: '1.FAR.X',
  'outboundOption.originLocationCode': 'NRT',
  'outboundOption.destinationLocationCode': 'PVG',
  'outboundOption.departureDay': '01',
  'outboundOption.departureMonth': '10',
  'outboundOption.departureYear': '2020',
  'outboundOption.departureTime': 'NA',
  'guestTypes[0].type': 'ADT',
  'guestTypes[0].amount': '1',
  'guestTypes[1].type': 'CNN',
  'guestTypes[1].amount': '0',
  'guestTypes[3].type': 'MWD',
  'guestTypes[3].amount': '0',
  'guestTypes[4].type': 'PWD',
  'guestTypes[4].amount': '0',
  'guestTypes[2].type': 'INF',
  'guestTypes[2].amount': '0',
  pos: 'AIRCHINA_CN',
  lang: 'zh_CN'
};

// 查询请求
const actionUrl = process.env.ACTION_URL;
// 查询页面
const initUrl = process.env.INIT_URL;

async function searchTicket() {
  // init
  if (!actionUrl || !initUrl) {
    return;
  }
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.105 Safari/537.36')

  await page.goto(initUrl, { waitUntil: 'networkidle0'} );

  await page.waitFor(200);

  const url = getUrl();
  // TODO 第一次访问会报系统繁忙...暂未找到原因
  await page.goto(url, { waitUntil: 'networkidle0' });
  const searchFn = async (departureDay, departureMonth, departureYear) => {
    const url = getUrl(departureDay, departureMonth, departureYear);
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.waitFor(500);

    let result = await searchResult(page);
    return result;
  }
  return searchFn;
}

function getUrl(departureDay, departureMonth, departureYear) {
  let query = {
    ...params
  }
  if (departureDay) {
    query['outboundOption.departureDay'] = departureDay;
  }
  if (departureMonth) {
    query['outboundOption.departureMonth'] = departureMonth;
  }
  if (departureYear) {
    query['outboundOption.departureYear'] = departureYear;
  }
  const qsString = qs.stringify(query);
  return actionUrl + '?' + qsString;
}

async function searchResult(page) {
  let headBlock_0 = await page.$('#headBlock_0');
  if (headBlock_0) {
    let flightInfo = await headBlock_0.$eval('h2', node => node.innerText)
    console.log(flightInfo)
  }

  let result = null;
  let resultBlock = await page.$('#resultsFFBlock1')
  if (resultBlock) {
    let table = await resultBlock.$eval('#AIR_SEARCH_RESULT_CONTEXT_ID0', node => node.outerHTML);
    list = parse(table);
    result = {
      code: 0,
      list
    }
  } else {
    // no ticket
    let warningText = await page.$('#warningText')
    if (warningText) {
      let text = await warningText.$eval('p', node => node.innerText)
      console.log(text)
      result = {
        code: 1,
        msg: text
      }
    }
  }
  return result;
}

function getFlightItemInfo(td, selector) {
  let el = td.find(selector);
  if (el.length) { return el.eq(0).text(); }
}

function parse(table) {
  let $ = cheerio.load(table);
  let $tbodys = $('#AIR_SEARCH_RESULT_CONTEXT_ID0>tbody')
  let result = [];
  $tbodys.each((i, el) => {
    let trs = el.childNodes.filter(node => node.type==='tag');
    let prices = []
    for (const tr of trs) {
      let $tr = $(tr);
      let flightNo = getFlightItemInfo($tr, '.colFlight a');
      let depart = getFlightItemInfo($tr, '.colDepart div');
      let arrive = getFlightItemInfo($tr, '.colArrive div');
      let airports = getFlightItemInfo($tr, '.colAirports div>span:nth-of-type(1)');
      $tr.find('.colCost').not('.colCostNotAvail').each((i, item) => {
        let price = getFlightItemInfo($(item), '.colPrice>label');
        price && prices.push(price);
      })
      result.push({
        flightNo,
        depart,
        arrive,
        airports,
        prices
      });
    }
  })
  return result;
}

async function closeBrowser(browser) {
  await browser.close();
}

module.exports = {
  searchTicket,
  closeBrowser
}
