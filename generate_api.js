const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.join(__dirname, 'frontend');
const API_DIR = path.join(FRONTEND_DIR, 'app/api');
const LIB_DIR = path.join(FRONTEND_DIR, 'lib');

const mkdir = (p) => fs.mkdirSync(p, { recursive: true });
const write = (p, content) => fs.writeFileSync(p, content.trim() + '\n');

mkdir(API_DIR);
mkdir(LIB_DIR);

console.log('API and Lib directories verified.');
