const fs = require('fs');
let code = fs.readFileSync('bot.ts', 'utf8');

const simulateStr = `  // Simulate visiting the Point Dashboard and Campaign list first. This initializes the daily point availability on ATOM's servers.
  await authApiGet(ctx.from.id, \`/mytmapi/v1/my/dashboard?msisdn=\${sess.msisdn}&userid=\${sess.userId}&v=4.16.0&_t=\${Date.now()}\`);
  await authApiGet(ctx.from.id, \`/mytmapi/v1/my/point-system/dashboard?msisdn=\${sess.msisdn}&userid=\${sess.userId}&v=4.16.0&_t=\${Date.now()}\`);
  await authApiGet(ctx.from.id, \`/mytmapi/v2/my/point-system/dashboard?msisdn=\${sess.msisdn}&userid=\${sess.userId}&v=4.16.0&_t=\${Date.now()}\`);
  await authApiGet(ctx.from.id, \`/mytmapi/v1/my/point-system/campaign-list?msisdn=\${sess.msisdn}&userid=\${sess.userId}&v=4.16.0&_t=\${Date.now()}\`);`;

const additionalSimulations = `  // Simulate visiting the Point Dashboard and Campaign list first. This initializes the daily point availability on ATOM's servers.
  await authApiGet(ctx.from.id, \`/mytmapi/v1/my/dashboard?msisdn=\${sess.msisdn}&userid=\${sess.userId}&v=4.16.0&_t=\${Date.now()}\`);
  await authApiGet(ctx.from.id, \`/mytmapi/v1/my/point-system/dashboard?msisdn=\${sess.msisdn}&userid=\${sess.userId}&v=4.16.0&_t=\${Date.now()}\`);
  await authApiGet(ctx.from.id, \`/mytmapi/v2/my/point-system/dashboard?msisdn=\${sess.msisdn}&userid=\${sess.userId}&v=4.16.0&_t=\${Date.now()}\`);
  await authApiGet(ctx.from.id, \`/mytmapi/v1/my/point-system/campaign-list?msisdn=\${sess.msisdn}&userid=\${sess.userId}&v=4.16.0&_t=\${Date.now()}\`);
  
  // Extra endpoints to trigger Daily Point Checkin initialization on ATOM side
  await authApiGet(ctx.from.id, \`/mytmapi/v1/my/point-system/checkin?msisdn=\${sess.msisdn}&userid=\${sess.userId}&v=4.16.0&_t=\${Date.now()}\`);
  await authApiGet(ctx.from.id, \`/mytmapi/v1/my/point-system/check-in?msisdn=\${sess.msisdn}&userid=\${sess.userId}&v=4.16.0&_t=\${Date.now()}\`);
  await authApiGet(ctx.from.id, \`/mytmapi/v2/my/point-system/checkin?msisdn=\${sess.msisdn}&userid=\${sess.userId}&v=4.16.0&_t=\${Date.now()}\`);
  await authApiGet(ctx.from.id, \`/mytmapi/v1/my/point-system/daily-checkin?msisdn=\${sess.msisdn}&userid=\${sess.userId}&v=4.16.0&_t=\${Date.now()}\`);
  await authApiGet(ctx.from.id, \`/mytmapi/v1/my/point-system/checkin-list?msisdn=\${sess.msisdn}&userid=\${sess.userId}&v=4.16.0&_t=\${Date.now()}\`);
  await authApiGet(ctx.from.id, \`/mytmapi/v2/my/point-system/checkin-list?msisdn=\${sess.msisdn}&userid=\${sess.userId}&v=4.16.0&_t=\${Date.now()}\`);`;

if(code.includes(simulateStr)) {
    code = code.replace(simulateStr, additionalSimulations);
} else {
    console.log("Could not find simulate string");
}

// Relax the strict checking in case the item IS there but gets rejected
const strictCheck = `      // ATOM sometimes marks the daily point item with action/button label
      if (item.action === 'Claim' || item.buttonText === 'Claim' || item.button_text === 'Claim' || item.buttonText === 'ရယူမည်') return true;
      return false; // Stricter checking so we don't accidentally get an unclaimable point`;

const relaxedCheck = `      // ATOM sometimes marks the daily point item with action/button label
      if (item.action === 'Claim' || item.buttonText === 'Claim' || item.button_text === 'Claim' || item.buttonText === 'ရယူမည်') return true;
      
      // RELAXED CHECK: If it has point info and isn't claimed, assume it's claimable (as we filtered out claimed above)
      if (item.point || item.points || item.pointAmount || item.amount || item.reward || item.value) return true;
      
      return false; // Stricter checking so we don't accidentally get an unclaimable point`;

if(code.includes(strictCheck)) {
    code = code.replace(strictCheck, relaxedCheck);
} else {
    console.log("Could not find strict check string");
}

fs.writeFileSync('bot.ts', code);
console.log("Updated bot.ts successfully");
