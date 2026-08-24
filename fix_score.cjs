const fs = require('fs');
let code = fs.readFileSync('bot.ts', 'utf8');

const oldMask = `const userIdDisplay = b64UserId.length > 8 ? 
      b64UserId.substring(0, 4) + "****" + b64UserId.substring(b64UserId.length - 3) : b64UserId;`;
const newMask = `const userIdDisplay = b64UserId.length
