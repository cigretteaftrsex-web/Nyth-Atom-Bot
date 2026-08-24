const fs = require('fs');
let code = fs.readFileSync('bot.ts', 'utf8');

const oldKupon = `bot.hears('🏃 City Run ကူပွန်', async (ctx) => {
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
    
    let msg = "🏃 <b>City Run အချက်အလက်</b>\\n\\n";
    msg += "🎟️ ကစားခွင့် (Runs): <b>" + runs + " ကြိမ်</b>\\n";
    msg += "💰 ဒင်္ဂါး (Coins): <b>" + coins + " ပြား</b>";
    
    await ctx.reply(msg, { parse_mode: 'HTML' });
  } else {
    await ctx.reply("❌ ဆာဗာအခက်အခဲကြောင့် ခဏနေမှ ပြန်ကြိုးစားပေးပါဗျ။");
  }
});`;

const newKupon = `bot.hears('🏃 City Run ကူပွန်', async (ctx) => {
  const sess = await getSession(ctx.from.id);
  if (!sess) return ctx.reply("❌ အရင်ဆုံး အကောင့်ဝင်ပေးပါဦးဗျ။", getMainKeyboard(false));
  
  const waitMsg = await ctx.reply("⏳ City Run အချက်အလက်များကို ရယူနေပါတယ်...");
  const b64UserId = Buffer.from(sess.userId.toString()).toString('base64');
  const ciSession = await getCityRunSession(sess.msisdn);
  
  const res = await cityRunApiPost('/getUserData', { user_id: b64UserId }, ciSession || undefined);
  
  await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
  
  if (res && res.status === 'success') {
    const data = res.data || {};
    const runs = Number(data.user_runs || 0);
    const coins = data.user_coins ? Number(data.user_coins) : 0;
    const userType = data.user_type ? data.user_type.toUpperCase() : 'SUBSCRIBER';
    
    const userIdDisplay = b64UserId.length > 8 ? 
      b64UserId.substring(0, 4) + "****" + b64UserId.substring(b64UserId.length - 3) : b64UserId;
    
    const milestones = data.milestones || [];
    const totalMilestones = milestones.length;
    const claimedMilestones = milestones.filter((m: any) => m.milestone_claimed === "1").length;
    
    let msg = "🏃 <b>City Run Profile</b>\\n\\n";
    msg += "👤 <b>ID:</b> <code>" + userIdDisplay + "</code> (<code>" + b64UserId + "</code>)\\n";
    msg += "👑 <b>Status:</b> " + userType + "\\n";
    msg += "💎 <b>Diamond:</b> " + (coins >= 1000 ? (coins / 1000).toFixed(1) + "K" : coins) + "\\n";
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
});`;

if (code.includes(oldKupon)) {
    code = code.replace(oldKupon, newKupon);
    console.log("Successfully replaced City Run Kupon logic.");
} else {
    console.log("Could not find City Run Kupon logic.");
}

fs.writeFileSync('bot.ts', code);
