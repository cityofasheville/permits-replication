import { handler } from './lambda.js';

handler({"local":true},{}).then(console.log).catch(console.error);