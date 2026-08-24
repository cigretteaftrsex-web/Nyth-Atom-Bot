const fs = require('fs');
let code = fs.readFileSync('/app/applet/Nyth-Atom-Bot-main/bot.ts', 'utf8');

const startStr = "async function cityRunApiPost(endpoint: string, body: any) {";
const endStr = "// ==========================================\n// 🛠️ ADMIN PANEL";

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr);

if (startIndex === -1 || endIndex === -1) {
    console.log("Not found", startIndex, endIndex);
    process.exit(1);
}

const replacementCode = `async function getCityRunSession(msisdn: string): Promise<string | null> {
  try {
    const res = await axios.get("https://cityrun.pro/ws/redirect/?AdNetwork=atom_app&ClickID=&Publisher=&msisdn=" + msisdn, {
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
        "Cookie": "ci_session=" + ciSession
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
      headers["Cookie"] = "ci_session=" + ciSession;
    }
    const res = await axios({
      httpsAgent: botHttpsAgent,
      method: "POST",
      url: "https://cityrun.pro" + endpoint,
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
  
  const waitMsg = await ctx.reply("⏳ City Run အချက်အလက်များကို ရယူနေပါတယ်...");
  
  // Try to use the original subscriber ID or fallback to MSISDN base64
  let subId = sess.userId ? sess.userId.toString() : sess.msisdn;
  let b64UserId = Buffer.from(subId).toString('base64');
  
  const ciSession = await getCityRunSession(sess.msisdn);
  
  // Use CI Session with getUserData
  let res = await cityRunApiPost('/getUserData', { user_id: b64UserId }, ciSession || undefined);
  
  // Retry if not found
  if ((!res || res.status !== 'success' || !res.data) && sess.userId && sess.userId.toString() !== sess.msisdn) {
     b64UserId = Buffer.from(sess.msisdn).toString('base64');
     res = await cityRunApiPost('/getUserData', { user_id: b64UserId }, ciSession || undefined);
  }
  
  await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
  
  if (res && res.status === 'success' && res.data) {
    const data = res.data || {};
    const runs = Number(data.user_runs || 0);
    const coins = data.user_coins ? Number(data.user_coins) : 0;
    const userType = data.user_type ? data.user_type.toUpperCase() : 'SUBSCRIBER';
    
    // Mask ID slightly for display
    const userIdDisplay = b64UserId.length >= 7 ? 
      b64UserId.substring(0, 4) + "****" + b64UserId.substring(b64UserId.length - 3) : b64UserId;
    
    const milestones = data.milestones || [];
    const totalMilestones = milestones.length;
    const claimedMilestones = milestones.filter((m: any) => m.milestone_claimed === "1").length;
    
    let msg = "🏃 <b>City Run Profile</b>\\n\\n";
    msg += "👤 <b>ID:</b> <code>" + userIdDisplay + "</code>\\n";
    msg += "👑 <b>Status:</b> " + userType + "\\n";
    msg += "💎 <b>Diamond:</b> " + (coins >= 1000 ? (coins / 1000).toFixed(1) + "K" : coins) + " (" + coins + ")\\n";
    msg += "🎟️ <b>Runs:</b> " + runs + "\\n";
    msg += "🎯 <b>Milestone:</b> " + claimedMilestones + "/" + totalMilestones + "\\n\\n";
    
    if (totalMilestones > 0 && claimedMilestones === totalMilestones) {
       msg += "✅ <i>ယနေ့ Milestones Claim ပြီး — မနက်ဖြန် ပြန်ရမည်</i>";
    } else {
       msg += "⏳ <i>ယနေ့ Milestones " + (totalMilestones - claimedMilestones) + " ခု ယူရန်ကျန်သေးပါသည်</i>";
    }
    
    await ctx.reply(msg, { parse_mode: 'HTML' });
  } else {
    await ctx.reply("❌ ဆာဗာအခက်အခဲကြောင့် ခဏနေမှ ပြန်ကြိုးစားပေးပါဗျ။ (API Data မရရှိပါ)");
  }
});

bot.hears('🏃 City Run ဆော့ရန်', async (ctx) => {
  const sess = await getSession(ctx.from.id);
  if (!sess) return ctx.reply("❌ အရင်ဆုံး အကောင့်ဝင်ပေးပါဦးဗျ。", getMainKeyboard(false));
  
  const waitMsg = await ctx.reply("⏳ City Run အချက်အလက် ယူနေပါတယ်...");
  let subId = sess.userId ? sess.userId.toString() : sess.msisdn;
  let b64UserId = Buffer.from(subId).toString('base64');
  const ciSession = await getCityRunSession(sess.msisdn);
  
  let res = await cityRunApiPost('/getUserData', { user_id: b64UserId }, ciSession || undefined);
  if ((!res || res.status !== 'success' || !res.data) && sess.userId && sess.userId.toString() !== sess.msisdn) {
     b64UserId = Buffer.from(sess.msisdn).toString('base64');
     res = await cityRunApiPost('/getUserData', { user_id: b64UserId }, ciSession || undefined);
  }
  
  await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
  
  if (res && res.status === 'success' && res.data) {
    const runs = Number(res.data?.user_runs || 0);
    if (runs <= 0) {
      return ctx.reply("❌ လက်ကျန် ကစားခွင့် မရှိတော့ပါ ။");
    }
    
    const buttons = [
      [Markup.button.callback('🎮 ဂိမ်းစတင်ကစားမည် (Auto Play)', 'cityrun_play_auto_' + b64UserId)]
    ];
    
    let replyMsg = "🏃 <b>City Run ဂိမ်းကစားရန်</b>\\n\\n🎟️ လက်ကျန်ကစားခွင့်: <b>" + runs + " ကြိမ်</b>\\n\\n<i>အောက်ပါ ခလုတ်ကို နှိပ်၍ ဂိမ်းစတင်ပါ။ (အဆင့် ၄ ခုစလုံးကို အချိန်စောင့်၍ အလိုအလျောက် ဆော့ကစားပေးပါမည်)</i>";
    
    await ctx.reply(replyMsg, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  } else {
    await ctx.reply("❌ ဆာဗာအခက်အခဲကြောင့် ခဏနေမှ ပြန်ကြိုးစားပေးပါဗျ။");
  }
});

bot.action(/cityrun_play_auto_(.+)/, async (ctx) => {
  const sess = await getSession(ctx.from?.id);
  if (!sess) return ctx.answerCbQuery("❌ အကောင့်ဝင်ရန်လိုအပ်ပါတယ်။", { show_alert: true });
  
  await ctx.answerCbQuery();
  
  const b64UserId = ctx.match[1];
  const ciSession = await getCityRunSession(sess.msisdn);
  
  if (ciSession) {
    await cityRunPlayGame(ciSession);
  }
  
  const checkRes = await cityRunApiPost('/getUserData', { user_id: b64UserId }, ciSession || undefined);
  if (!checkRes || checkRes.status !== 'success' || !checkRes.data) {
    return ctx.editMessageText("❌ ဆာဗာအခက်အခဲကြောင့် ကစား၍မရသေးပါ။");
  }
  
  const runs = Number(checkRes.data?.user_runs || 0);
  if (runs <= 0) {
    return ctx.editMessageText("❌ လက်ကျန် ကစားခွင့် မရှိတော့ပါ ။");
  }
  
  const waitMsg = await ctx.reply("🎮 <b>ဂိမ်းစတင်နေပါသည်...</b>", { parse_mode: 'HTML' });
  
  const milestones = checkRes.data?.milestones || [];
  const unclaimedMilestones = milestones
    .filter((m: any) => m.milestone_claimed === "0")
    .map((m: any) => Number(m.milestone_threshold_value || m.milestone_score))
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
    let waitTime = 12000;
    if (score === 1500) waitTime = 15000;
    else if (score === 2500) waitTime = 10000;
    else if (score === 4000) waitTime = 15000;
    else if (score === 6500) waitTime = 25000;
    
    const stageNum = i + 1;
    const progressText = "⏳ <b>Milestone (" + stageNum + "/" + unclaimedMilestones.length + ") ဆော့ကစားနေပါသည်...</b>\\n🏃‍♂️ ရည်မှန်းချက် အမှတ် (Score: " + score + ")\\n⏱️ စောင့်ဆိုင်းရန် (ခန့်မှန်း " + Math.ceil(waitTime/1000) + " စက္ကန့်)...";
    
    await ctx.telegram.editMessageText(
      ctx.chat.id, 
      waitMsg.message_id, 
      undefined, 
      progressText, 
      { parse_mode: 'HTML' }
    ).catch(() => {});
    
    await new Promise(r => setTimeout(r, waitTime));
    
    const claimRes = await cityRunApiPost('/claimMysteryBox', { user_id: b64UserId, score: score }, ciSession || undefined);
    lastScore = score;
    
    if (claimRes && claimRes.status === 'success') {
      if (claimRes.milestone_reward_details && claimRes.milestone_reward_details.length > 0) {
        totalCoins += Number(claimRes.milestone_reward_details[0].milestone_coins || 0);
        totalRuns += Number(claimRes.milestone_reward_details[0].milestone_runs || 0);
      }
    } else {
       break;
    }
  }
  
  await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
  
  if (totalCoins > 0 || totalRuns > 0) {
    const successText = "🎉 <b>ဂုဏ်ယူပါတယ်။ ဂိမ်းကစားခြင်း ပြီးဆုံးပါပြီ။ (အမြင့်ဆုံးအမှတ
