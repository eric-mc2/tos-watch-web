import dotenv from 'dotenv';
dotenv.config();

import { downloadJsonBlob,  } from './src/_data/_common.js';


const content = await downloadJsonBlob("static_urls.json");
console.log(content);