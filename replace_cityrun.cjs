const fs = require('fs');

const code = fs.readFileSync('bot.ts', 'utf8');

const startMarker = 'async function cityRunApiPost';
const endMarker = '// ==========================================';

const startIndex = code.indexOf(startMarker);
const endIndex = code.indexOf(endMarker, startIndex);

if (startIndex === -1 || endIndex === -1) {
  console.error("Markers not found");
  process.exit(1);
}

const newCode = `async function getCityRunSession(msisdn: string): Promise<string | null> {
  try {
    const res = await axios.get(\`https://cityrun.pro/ws/redirect/?AdNetwork=atom_app&ClickID=&Publisher=&msisdn=\${msisdn}\`, {
      httpsAgent: botHttpsAgent,
      maxRedirects: 0,
      validateStatus: () => true,
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 12; Redmi K30 5G Build/SKQ1.211006.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/149.0.7827.91 Mobile Safari/537.36",
        "X-Requested-With": "mm.com.atom.store"
      }
    });
    const setCookie = res.headers['set-cookie'];
    if (setCookie && setCookie.length > 0) {
      const match = setCookie[0].match(/ci_session=([^;]+)/);
      if (match) return match[1];
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function cityRunPlayGame(ciSession: string) {
  try {
    await axios.get('https://cityrun.pro/playgame', {
      httpsAgent: botHttpsAgent,
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 12; Redmi K30 5G Build/SKQ1.211006.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/149.0.7827.91 Mobile Safari/537.36",
        "X-Requested-With": "mm.com.atom.store",
        "Cookie": \`ci_session=\${ciSession}\`
      }
    });
  } catch (e) {}
}

async function cityRunApiPost(endpoint: string, body: any, ciSession?: string) {
  try {
    const headers: any = {
      "User-Agent": "Mozilla/5.0 (Linux; Android 12; Redmi K30 5G Build/SKQ1.211006.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/149.0.7827.91 Mobile Safari/537.36",
      "Accept": "*/*",
      "Content-Type": "application/json",
      "AUTH-TOKEN": "YXRvbUdhbWVzQVBJX1NaMDAwMTpBIzlLIVF4UjckUDlAMg==",
      "Origin": "https://cityrun.pro",
      "X-Requested-With": "mm.com.atom.store",
    };
    if (ciSession) {
      headers["Cookie"] = \`ci_session=\${ciSession}\`;
    }
    const res = await axios({
      httpsAgent: botHttpsAgent,
      method: "POST",
      url: \`https://cityrun.pro\${endpoint}\`,
      data: body,
      headers,
      validateStatus: () => true,
      timeout: 15000
    });
    return res.data;
  } catch (e) {
    return null;
  }
}

bot.hears('🏃 City Run ကူပွန်', async (ctx) => {
  const sess = await getSession(ctx.from.id);
  if (!sess) return ctx.reply("❌ အရင်ဆုံး အကောင့်ဝင်ပေးပါဦးဗျ။", getMainKeyboard(false));
  
  const waitMsg = await ctx.reply("⏳ City Run ကူပွန် စစ်ဆေးနေပါတယ်...");
  const b64UserId = Buffer.from(sess.userId.toString()).toString('base64');
  const ciSession = await getCityRunSession(sess.msisdn);
  
  const res = await cityRunApiPost('/getUserData', { user_id: b64UserId }, ciSession || undefined);
  
  await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
  
  if (res && res.status === 'success') {
    const runs = res.data?.user_runs || 0;
    const coins = res.data?.user_coins || 0;
    
    let msg = \`🏃 <b>City Run အချက်အလက်</b>\\n\\n\`;
    msg += \`🎟️ ကစားခွင့် (Runs): <b>\${runs} ကြိမ်</b>\\n\`;
    msg += \`💰 ဒင်္ဂါး (Coins): <b>\${coins} ပြား</b>\`;
    
    await ctx.reply(msg, { parse_mode: 'HTML' });
  } else {
    await ctx.reply("❌ ဆာဗာအခက်အခဲကြောင့် ခဏနေမှ ပြန်ကြိုးစားပေးပါဗျ။");
  }
});

bot.hears('🏃 City Run ဆော့ရန်', async (ctx) => {
  const sess = await getSession(ctx.from.id);
  if (!sess) return ctx.reply("❌ အရင်ဆုံး အကောင့်ဝင်ပေးပါဦးဗျ。", getMainKeyboard(false));
  
  const waitMsg = await ctx.reply("⏳ City Run အချက်အလက် ယူနေပါတယ်...");
  const b64UserId = Buffer.from(sess.userId.toString()).toString('base64');
  const ciSession = await getCityRunSession(sess.msisdn);
  const res = await cityRunApiPost('/getUserData', { user_id: b64UserId }, ciSession || undefined);
  
  await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
  
  if (res && res.status === 'success') {
    const runs = Number(res.data?.user_runs || 0);
    if (runs <= 0) {
      return ctx.reply("❌ လက်ကျန် ကစားခွင့် မရှိတော့ပါ ။");
    }
    
    const buttons = [
      [Markup.button.callback('🎮 ဂိမ်းစတင်ကစားမည် (Auto Play)', 'cityrun_play_auto')]
    ];
    
    await ctx.reply(\`🏃 <b>City Run ဂိမ်းကစားရန်</b>\\n\\n🎟️ လက်ကျန်ကစားခွင့်: <b>\${runs} ကြိမ်</b>\\n\\n<i>အောက်ပါ ခလုတ်ကို နှိပ်၍ ဂိမ်းစတင်ပါ။ (အဆင့် ၄ ခုစလုံးကို အချိန်စောင့်၍ အလိုအလျောက် ဆော့ကစားပေးပါမည်)</i>\`, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  } else {
    await ctx.reply("❌ ဆာဗာအခက်အခဲကြောင့် ခဏနေမှ ပြန်ကြိုးစားပေးပါဗျ။");
  }
});

bot.action('cityrun_play_auto', async (ctx) => {
  const sess = await getSession(ctx.from?.id);
  if (!sess) return ctx.answerCbQuery("❌ အကောင့်ဝင်ရန်လိုအပ်ပါတယ်။", { show_alert: true });
  
  await ctx.answerCbQuery();
  
  const b64UserId = Buffer.from(sess.userId.toString()).toString('base64');
  const ciSession = await getCityRunSession(sess.msisdn);
  
  if (ciSession) {
    await cityRunPlayGame(ciSession);
  }
  
  const checkRes = await cityRunApiPost('/getUserData', { user_id: b64UserId }, ciSession || undefined);
  if (!checkRes || checkRes.status !== 'success') {
    return ctx.editMessageText("❌ ဆာဗာအခက်အခဲကြောင့် ကစား၍မရသေးပါ။");
  }
  
  const runs = Number(checkRes.data?.user_runs || 0);
  if (runs <= 0) {
    return ctx.editMessageText("❌ လက်ကျန် ကစားခွင့် မရှိတော့ပါ ။");
  }
  
  const waitMsg = await ctx.reply("🎮 <b>ဂိမ်းစတင်နေပါသည်...</b>", { parse_mode: 'HTML' });
  
  const milestones = checkRes.data?.milestones || [];
  // Filter unclaimed milestones and sort them in ascending order of score
  const unclaimedMilestones = milestones
    .filter((m: any) => m.milestone_claimed === "0")
    .map((m: any) => Number(m.milestone_score))
    .sort((a: number, b: number) => a - b);
    
  if (unclaimedMilestones.length === 0) {
    await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
    return ctx.reply("❌ ရယူရန် ဆုမကျန်တော့ပါ။ အမြင့်ဆုံးဆုများ ရရှိထားပြီးဖြစ်ပါသည်။");
  }

  let totalCoins = 0;
  let totalRuns = 0;
  let lastScore = 0;

  for (let i = 0; i < unclaimedMilestones.length; i++) {
    const score = unclaimedMilestones[i];
    let waitTime = 12000; // default wait between milestones
    if (score === 1500) waitTime = 15000;
    else if (score === 2500) waitTime = 10000;
    else if (score === 4000) waitTime = 15000;
    else if (score === 6500) waitTime = 25000;
    
    const stageNum = i + 1;
    await ctx.telegram.editMessageText(
      ctx.chat.id, 
      waitMsg.message_id, 
      undefined, 
      \`⏳ <b>အဆင့် (\${stageNum}/${unclaimedMilestones.length}) ဆော့ကစားနေပါသည်...</b>\\n🏃‍♂️ ရည်မှန်းချက် အမှတ် (Score: \${score})\\n⏱️ စောင့်ဆိုင်းရန် (ခန့်မှန်း \${Math.ceil(waitTime/1000)} စက္ကန့်)...\`, 
      { parse_mode: 'HTML' }
    ).catch(() => {});
    
    // Sleep to simulate playing time
    await new Promise(r => setTimeout(r, waitTime));
    
    const claimRes = await cityRunApiPost('/claimMysteryBox', { user_id: b64UserId, score: score }, ciSession || undefined);
    lastScore = score;
    
    if (claimRes && claimRes.status === 'success') {
      if (claimRes.milestone_reward_details && claimRes.milestone_reward_details.length > 0) {
        totalCoins += Number(claimRes.milestone_reward_details[0].milestone_coins || 0);
        totalRuns += Number(claimRes.milestone_reward_details[0].milestone_runs || 0);
      }
    } else {
       // If claim fails (e.g. invalid score or game over), break out
       break;
    }
  }
  
  await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
  
  if (totalCoins > 0 || totalRuns > 0) {
    await ctx.editMessageText(
      \`🎉 <b>ဂုဏ်ယူပါတယ်။ ဂိမ်းကစားခြင်း ပြီးဆုံးပါပြီ။ (အမြင့်ဆုံးအမှတ် - \${lastScore})</b>\\n\\n💰 ရရှိသော ဒင်္ဂါး စုစုပေါင်း: <b>\${totalCoins} ပြား</b>\\n🎟️ ရရှိသော ကစားခွင့် စုစုပေါင်း: <b>\${totalRuns} ကြိမ်</b>\`, 
      { parse_mode: 'HTML' }
    );
  } else {
    await ctx.editMessageText("❌ ဆုရယူရာတွင် အခက်အခဲရှိခဲ့ပါသည်။ ပြန်လည်ကြိုးစားကြည့်ပါ။");
  }
});

bot.hears('💎 City Run Diamond Exchange', async (ctx) => {
  const sess = await getSession(ctx.from.id);
  if (!sess) return ctx.reply("❌ အရင်ဆုံး အကောင့်ဝင်ပေးပါဦးဗျ。", getMainKeyboard(false));
  
  const waitMsg = await ctx.reply("⏳ City Run Diamond Exchange အချက်အလက် ယူနေပါတယ်...");
  const b64UserId = Buffer.from(sess.userId.toString()).toString('base64');
  const ciSession = await getCityRunSession(sess.msisdn);
  
  const res = await cityRunApiPost('/getUserData', { user_id: b64UserId }, ciSession || undefined);
  
  await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
  
  if (res && res.status === 'success') {
    const coins = Number(res.data?.user_coins || 0);
    const redemptionOptions = res.data?.coins_redemption || [];
    
    if (redemptionOptions.length === 0) {
      return ctx.reply("❌ လဲလှယ်နိုင်သော ဆုလက်ဆောင်များ မရှိပါ။");
    }
    
    let msg = \`💎 <b>City Run Diamond Exchange</b>\\n\\n\`;
    msg += \`💰 လက်ရှိ ဒင်္ဂါး (Coins): <b>\${coins} ပြား</b>\\n\\n\`;
    msg += \`<i>လဲလှယ်လိုသော ဆုလက်ဆောင်ကို ရွေးချယ်ပါ:</i>\`;
    
    const buttons = [];
    
    if (coins >= 100) {
       buttons.push([Markup.button.callback('🔄 Auto Max Exchange (ရှိသမျှအကုန်လဲမည်)', 'cityrun_exchange_auto')]);
    }

    redemptionOptions.forEach((opt: any) => {
      let desc = '';
      if (opt.coins_runs > 0) desc = \`\${opt.coins_runs} Runs\`;
      else if (opt.coins_datapack_value !== "0") desc = \`\${opt.coins_datapack_value} Data\`;
      else if (opt.coins_talktime_value !== "0") desc = \`\${opt.coins_talktime_value} Talktime\`;
      
      const threshold = Number(opt.coins_threshold_value);
      if (coins >= threshold) {
         const text = \`💎 \${desc} - \${threshold} Coins\`;
         buttons.push([Markup.button.callback(text, \`cityrun_exchange_\${opt.coins_id}\`)]);
      }
    });
    
    if (buttons.length === 0) {
       msg += \`\\n\\n⚠️ လဲလှယ်ရန် ဒင်္ဂါး မလုံလောက်သေးပါ။ အနည်းဆုံး 100 ပြား လိုအပ်ပါသည်။\`;
    }

    await ctx.reply(msg, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  } else {
    await ctx.reply("❌ ဆာဗာအခက်အခဲကြောင့် ခဏနေမှ ပြန်ကြိုးစားပေးပါဗျ။");
  }
});

bot.action('cityrun_exchange_auto', async (ctx) => {
  const sess = await getSession(ctx.from?.id);
  if (!sess) return ctx.answerCbQuery("❌ အကောင့်ဝင်ရန်လိုအပ်ပါတယ်။", { show_alert: true });
  
  await ctx.answerCbQuery();
  const waitMsg = await ctx.reply("⏳ ရှိသမျှဒင်္ဂါးများကို အများဆုံး Runs ရအောင် အလိုအလျောက် လဲလှယ်နေပါသည်...");
  const b64UserId = Buffer.from(sess.userId.toString()).toString('base64');
  const ciSession = await getCityRunSession(sess.msisdn);
  
  let totalSpent = 0;
  let totalRunsGained = 0;
  let keepRedeeming = true;
  
  while (keepRedeeming) {
    const dataRes = await cityRunApiPost('/getUserData', { user_id: b64UserId }, ciSession || undefined);
    if (!dataRes || dataRes.status !== 'success') break;
    
    let currentCoins = Number(dataRes.data?.user_coins || 0);
    const options = dataRes.data?.coins_redemption || [];
    
    const affordableOptions = options
      .filter((o: any) => Number(o.coins_runs) > 0 && currentCoins >= Number(o.coins_threshold_value))
      .sort((a: any, b: any) => Number(b.coins_threshold_value) - Number(a.coins_threshold_value));
      
    if (affordableOptions.length === 0) {
      keepRedeeming = false;
      break;
    }
    
    const bestOption = affordableOptions[0];
    const redeemRes = await cityRunApiPost('/processCoinsRedemption', { user_id: b64UserId, option_id: bestOption.coins_id }, ciSession || undefined);
    
    if (redeemRes && redeemRes.status === 'success') {
       totalSpent += Number(bestOption.coins_threshold_value);
       totalRunsGained += Number(bestOption.coins_runs);
    } else {
       keepRedeeming = false;
    }
  }
  
  await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
  
  if (totalSpent > 0) {
    await ctx.editMessageText(\`🎉 <b>အလိုအလျောက် လဲလှယ်ခြင်း ပြီးဆုံးပါပြီ။</b>\\n\\n💰 အသုံးပြုခဲ့သော ဒင်္ဂါး: <b>\${totalSpent} ပြား</b>\\n🎟️ ရရှိသော ကစားခွင့်စုစုပေါင်း: <b>\${totalRunsGained} ကြိမ်</b>\`, { parse_mode: 'HTML' });
  } else {
    await ctx.editMessageText(\`❌ လဲလှယ်ရန် ဒင်္ဂါး မလုံလောက်ပါ။\`);
  }
});

bot.action(/cityrun_exchange_(\d+)/, async (ctx) => {
  const optionId = ctx.match[1];
  const sess = await getSession(ctx.from?.id);
  if (!sess) return ctx.answerCbQuery("❌ အကောင့်ဝင်ရန်လိုအပ်ပါတယ်။", { show_alert: true });
  
  await ctx.answerCbQuery();
  const waitMsg = await ctx.reply("⏳ ဆုလက်ဆောင် လဲလှယ်နေပါသည်...");
  
  const b64UserId = Buffer.from(sess.userId.toString()).toString('base64');
  const ciSession = await getCityRunSession(sess.msisdn);
  const res = await cityRunApiPost('/processCoinsRedemption', { user_id: b64UserId, option_id: optionId }, ciSession || undefined);
  
  await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
  
  if (res && res.status === 'success') {
    await ctx.editMessageText(\`🎉 <b>ဆုလက်ဆောင် လဲလှယ်ခြင်း အောင်မြင်ပါသည်။</b>\\n\\n\${res.description || "Reward sent to user"}\`, { parse_mode: 'HTML' });
  } else {
    const errorMsg = res?.message || res?.description || "လဲလှယ်ရန် ဒင်္ဂါး မလုံလောက်ပါ။";
    await ctx.editMessageText(\`❌ \${errorMsg}\`);
  }
});

`;

const finalCode = code.slice(0, startIndex) + newCode + "\n" + code.slice(endIndex);

fs.writeFileSync('bot.ts', finalCode);
console.log("Successfully replaced City Run logic.");

