import { handler } from './lambda.js';

handler({},{}).then(console.log).catch(console.error);