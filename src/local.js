import { handler } from './index.js';

handler({"local":true},{}).then((ret)=>console.log(ret)).catch(console.error);