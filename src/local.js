import { handler } from './lambda.js';

handler({"local":true},{}).then((ret)=>console.log(ret)).catch(console.error);