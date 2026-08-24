const fs = require('fs');
let code = fs.readFileSync('bot.ts', 'utf8');

const strictRegex = /\/\/\s*ATOM sometimes marks the daily point item with action\/button label\s*if\s*\(item\.action\s*===\s*'Claim'\s*\|\|\s*item\.buttonText\s*===\s*'Claim'\s*\|\|\s*item\.button_text\s*===\s*'Claim'\s*\|\|\s*item\.buttonText\s*===\s*'ရယူမည်'\)\s*return\s*true;\s*return\s*false;\s*\/\/\s*Stricter checking so we don't accidentally get an unclaimable
