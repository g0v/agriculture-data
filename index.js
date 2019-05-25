const path = require('path');
const Koa = require('koa');
const cors = require('@koa/cors');
const serve = require('koa-static');
const mount = require('koa-mount');
const app = new Koa();

const PORT = process.env.PORT || 3000;
const data0 = path.resolve(__dirname, 'data');
const data1 = path.resolve(__dirname, '_data');

app.use(cors({ origin: '*' }));
app.use(mount('/data', serve(data0)));
app.use(mount('/_data', serve(data1)));

app.listen(PORT);
