const fs = require('fs');
let code = fs.readFileSync('bot.ts', 'utf8');

// Fix Diamond Exchange text
const oldDiamondTitle = `let msg = "💎 <b>City Run Diamond Exchange</b>\\n\\n";
    msg += "💰 လက်ရှိ ဒင်္ဂါး (Coins): <b>" + coins + " ပြား</b>\\n\\n";`;
const newDiamondTitle 
