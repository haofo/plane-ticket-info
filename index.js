require('dotenv').config();
const Koa = require('koa');
const staticServer = require('koa-static');
const router = require('@koa/router')();
const koaBody = require('koa-body');
const fs = require('fs');
const path = require('path');
const job = require('./cronjob/index');
const dayjs = require('dayjs');
const app = new Koa();

const static = staticServer(path.join(__dirname))
app.use(static);

app.use(koaBody());

router.get('/', index)
  .get('/query/:date', query)
app.use(router.routes());

async function index(ctx) {
  ctx.body = await fs.readFileSync(path.join(__dirname, './views/index.html'), 'utf8')
}

let cronJob = null;
async function query(ctx){
  const date = dayjs(ctx.params.date);
  if (!cronJob) {
    cronJob = await job.searchTicket();
  }
  let result = await cronJob(date.date(), date.month()+1, date.year());
  if (!result) {
    result = { code: 1, msg: 'no result' }
  }
  ctx.body = JSON.stringify(result);
}

app.listen(process.env.PORT || 3000);
