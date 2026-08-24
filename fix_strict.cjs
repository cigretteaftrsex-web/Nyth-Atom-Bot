const fs = require('fs');
let code = fs.readFileSync('bot.ts', 'utf8');

const strictRegex = /\/\/\s*ATOM sometimes marks the daily point item with action\/button label\s*if\s*\(item\.action\s*===\s*'Claim'\s*\|\|\s*item\.buttonText\s*===\s*'Claim'\s*\|\|\s*item\.button_text\s*===\s*'Claim'\s*\|\|\s*item\.buttonText\s*===\s*'ရယူမည်'\)\s*return\s*true;\s*return\s*false;\s*\/\/\s*Stricter checking so we don't accidentally get an unclaimable point/g;

const relaxedCheck = `      // ATOM sometimes marks the daily point item with action/button label
      if (item.action === 'Claim' || item.buttonText === 'Claim' || item.button_text === 'Claim' || item.buttonText === 'ရယူမည်') return true;
      
      // RELAXED CHECK: If it has point info and isn't claimed, assume it's claimable (as we filtered out claimed above)
      if (item.point || item.points || item.pointAmount || item.amount || item.reward || item.value) return true;
      
      return false; // Stricter checking so we don't accidentally get an unclaimable point`;

if (code.match(strictRegex)) {
    code = code.replace(strictRegex, relaxedCheck);
    console.log("Relaxed strict check successfully");
} else {
    console.log("Still couldn't find it.");
}

fs.writeFileSync('bot.ts', code);

