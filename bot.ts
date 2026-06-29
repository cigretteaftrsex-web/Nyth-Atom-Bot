import { Telegraf, Scenes, session, Markup } from 'telegraf';
import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import https from 'https';

export const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8976003318:AAHZQ0sSiw4IlkRRGRsfFNe7asqs5ZGIbpk';
export const bot = new Telegraf<any>(BOT_TOKEN);

const DB_FILE = path.join(process.cwd(), 'bot_db.json');

// Helper to generate node checksum
function generateChecksumNode(userId: string | null, body: string): string {
  const keyStr = "b^[VCHDL786mkTp]*" + (userId || "");
  const hmac = crypto.createHmac('sha256', keyStr);
  hmac.update(body);
  return hmac.digest('hex');
}

// Simple JSON DB
async function getDb() {
  try {
    const data = await fs.readFile(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return { sessions: {} };
  }
}

async function saveDb(data: any) {
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

async function getSession(tgUserId: number) {
  const db = await getDb();
  return db.sessions[tgUserId.toString()];
}

async function saveSession(tgUserId: number, sessionData: any) {
  const db = await getDb();
  db.sessions[tgUserId.toString()] = sessionData;
  await saveDb(db);
}

async function clearSession(tgUserId: number) {
  const db = await getDb();
  delete db.sessions[tgUserId.toString()];
  await saveDb(db);
}

const COMMON_HEADERS = {
  "accept": "application/json, text/plain, */*",
  "user-agent": "MyTM/4.13.0/Android/30",
  "device-name": "Xiaomi 2201122C", "X-Client-Channel": "Android",
  "x-server-select": "production"
};

const botHttpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
  keepAliveMsecs: 10000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000
});

async function atomApiPost(endpoint: string, data: any, headers: any = {}, retries = 3) {
  const url = `https://store.atom.com.mm${endpoint}`;
  for (let i = 0; i < retries; i++) {
    try {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      const res = await axios({
        httpsAgent: botHttpsAgent,
        method: "POST",
        url: url,
        data: payload,
        headers: { ...COMMON_HEADERS, "Content-Type": "application/json", ...headers },
        validateStatus: () => true,
        timeout: 10000
      });
      return res.data;
    } catch (e: any) {
      if (i === retries - 1) {
        console.error("atomApiPost error:", e.response?.data || e.message);
        return null;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return null;
}

async function atomApiGet(endpoint: string, headers: any = {}, retries = 3) {
  const url = `https://store.atom.com.mm${endpoint}`;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios({
        httpsAgent: botHttpsAgent,
        method: "GET",
        url: url,
        headers: { ...COMMON_HEADERS, ...headers },
        validateStatus: () => true,
        timeout: 10000
      });
      return res.data;
    } catch (e: any) {
      if (i === retries - 1) {
        console.error("atomApiGet error:", e.response?.data || e.message);
        return null;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return null;
}

function isTokenExpired(res: any): boolean {
  if (!res) return false;
  if (res === 401 || res.status === 401 || res.statusCode === 401) return true;
  if (res.response && res.response.status === 401) return true;
  
  if (typeof res === 'string') {
     const str = res.toLowerCase();
     return str.includes('unauthenticated') || str.includes('unauthorized') || str.includes('token expired') || str.includes('invalid token') || str.includes('9001');
  }

  const errCode = String(res.errors?.message?.code || res.errors?.code || res.statusCode || "");
  const errTitle = String(res.errors?.message?.title || res.errors?.title || "").toLowerCase();
  const errMsg = String(res.errors?.message?.message || res.message || res.errors?.message || "").toLowerCase();
     
  if (errCode === "9001" || errCode === "401") return true;
  if (errTitle.includes('unauthenticated') || errTitle.includes('unauthorized') || errTitle.includes('invalid token') || errTitle.includes('token expired')) return true;
  if (errMsg.includes('unauthenticated') || errMsg.includes('unauthorized') || errMsg.includes('invalid token') || errMsg.includes('token expired') || errMsg.includes('9001')) return true;

  return false;
}

async function performTokenRefresh(tgUserId: number, sess: any): Promise<any> {
    const endpoints = [
      `/mytmapi/v1/my/local-auth/refresh-token?msisdn=${sess.msisdn}&userid=${sess.userId || -1}&v=4.16.0`,
      `/mytmapi/v1/my/auth/refresh-token?msisdn=${sess.msisdn}&userid=${sess.userId || -1}&v=4.16.0`,
      `/mytmapi/v1/my/local-auth/refresh-token?msisdn=${sess.msisdn}&userid=-1&v=4.16.0`
    ];
    
    for (const url of endpoints) {
        let res = await atomApiPost(url, { refresh_token: sess.refreshToken }, {}, 1);
        if (!res || res.status !== 'success') {
           res = await atomApiPost(url, { refreshToken: sess.refreshToken }, {}, 1);
        }
        if (res && res.status === 'success' && res.data?.attribute) {
            const payload = res.data.attribute;
            const newSess = {
              token: payload.token || sess.token,
              msisdn: payload.msisdn || sess.msisdn,
              userId: payload.user_id || sess.userId,
              refreshToken: payload.refresh_token || sess.refreshToken
            };
            await saveSession(tgUserId, newSess);
            return newSess;
        }
    }
    return null;
}

async function authApiGet(tgUserId: number, endpoint: string, customHeaders: any = {}) {
  let sess = await getSession(tgUserId);
  if (!sess) return null;
  
  let headers = { "Authorization": `Bearer ${sess.token}`, ...customHeaders };
  let res = await atomApiGet(endpoint, headers);
  
  if (res && res.status !== 'success' && isTokenExpired(res)) {
     const newSess = await performTokenRefresh(tgUserId, sess);
     if (newSess) {
       headers["Authorization"] = `Bearer ${newSess.token}`;
       res = await atomApiGet(endpoint, headers);
     } else {
       if (!res) res = {};
       res._authFailed = true;
     }
  }
  return res || { _authFailed: true };
}

async function authApiPost(tgUserId: number, endpoint: string, bodyObj: any, customHeaders: any = {}) {
  let sess = await getSession(tgUserId);
  if (!sess) return null;
  
  const rawBody = typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj);
  let checksum = generateChecksumNode(sess.userId.toString().trim(), rawBody);
  
  let headers = {
    "Authorization": `Bearer ${sess.token}`,
    "Checksum": checksum,
    "X-Atom-Signature": checksum,
    "X-Signature": checksum,
    ...customHeaders
  };
  
  let res = await atomApiPost(endpoint, bodyObj, headers);
  
  if (res && res.status !== 'success' && isTokenExpired(res)) {
     const newSess = await performTokenRefresh(tgUserId, sess);
     if (newSess) {
       let newChecksum = generateChecksumNode(newSess.userId.toString().trim(), rawBody);
       headers["Authorization"] = `Bearer ${newSess.token}`;
       headers["Checksum"] = newChecksum;
       headers["X-Atom-Signature"] = newChecksum;
       headers["X-Signature"] = newChecksum;
       res = await atomApiPost(endpoint, bodyObj, headers);
     } else {
       if (!res) res = {};
       res._authFailed = true;
     }
  }
  return res || { _authFailed: true };
}

const isMenuCommand = (text: string) => {
  const menu = ['🔑 အကောင့်ဝင်ရန်', '🔄 အကောင့်ထွက်ရန်', '💰 လက်ကျန်ငွေစစ်ရန်', '📊 ပွိုင့်စစ်ရန်', '🎟️ TohToh ကူပွန်', '🎮 TohToh ဆော့ရန်', '🎟️ TohToh Live ဝယ်ယူရန်', '🌾 ရွှေလယ်တော ကူပွန်', '🐔 ရွှေလယ်တော ဆော့ရန်', '🌾 ရွှေလယ်တော Live ဝယ်ယူရန်', '🎁 Daily Point Claim', '/start', '/cancel'];
  return menu.includes(text);
};

const authWizard = new Scenes.WizardScene<any>(
  'AUTH_WIZARD',
  async (ctx) => {
    await ctx.reply("📲 ဖုန်းနံပါတ်လေး ရိုက်ထည့်ပေးပါဗျ။ (ဥပမာ - 097xxxxxxx)\n\n(မလုပ်လိုပါက /cancel ကိုနှိပ်ပါ)");
    return ctx.wizard.next();
  },
  async (ctx) => {
    if ('text' in ctx.message) {
      if (isMenuCommand(ctx.message.text)) {
        await ctx.scene.leave();
        await ctx.reply("❌ လုပ်ဆောင်ချက်ကို ရပ်စဲလိုက်ပါသည်။ ခလုတ်ကို ပြန်နှိပ်ပေးပါ။");
        return;
      }
      
      let phone = ctx.message.text.replace(/\D/g, '');
      if (phone.startsWith("95")) phone = phone.slice(2);
      if (phone.startsWith("09")) phone = phone.slice(1);
      
      if (phone.length < 7 || phone.length > 10) {
        await ctx.reply("❌ ဖုန်းနံပါတ် မှားယွင်းနေပါတယ်၊ ပြန်လည်စစ်ဆေးပေးပါ။");
        return;
      }
      
      ctx.wizard.state.phone = phone;
      const msg = await ctx.reply("⏳ OTP ပို့နေပါပြီဗျ...");
      
      const res = await atomApiPost('/mytmapi/v1/my/local-auth/send-otp?msisdn=&userid=-1&v=4.16.0', { msisdn: phone });
      await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
      
      if (res && res.status === 'success' && res.data?.attribute?.code) {
        ctx.wizard.state.otpCode = res.data.attribute.code;
        await ctx.reply(`📨 +95${phone} ကို OTP ပို့လိုက်ပါပြီ။`);
        return ctx.wizard.next();
      } else {
        await ctx.reply("❌ ဆာဗာအခက်အခဲကြောင့် ခဏနေမှ ပြန်ကြိုးစားပေးပါဗျ။");
        return ctx.scene.leave();
      }
    }
  },
  async (ctx) => {
    if ('text' in ctx.message) {
      if (isMenuCommand(ctx.message.text)) {
        await ctx.scene.leave();
        await ctx.reply("❌ လုပ်ဆောင်ချက်ကို ရပ်စဲလိုက်ပါသည်။ ခလုတ်ကို ပြန်နှိပ်ပေးပါ။");
        return;
      }

      const otp = ctx.message.text.replace(/\D/g, '');
      if (otp.length !== 6) {
        await ctx.reply("❌ OTP ဂဏန်း ၆ လုံး ပြည့်အောင် ရိုက်ထည့်ပေးပါဗျ။ (မလုပ်လိုပါက /cancel ဟုရိုက်၍ ထွက်နိုင်ပါသည်)");
        return;
      }

      
      const msg = await ctx.reply("⏳ OTP မှန်မမှန် စစ်ဆေးနေတယ်ဗျ...");
      
      const res = await atomApiPost('/mytmapi/v1/my/local-auth/verify-otp?msisdn=&userid=-1&v=4.16.0', {
        msisdn: ctx.wizard.state.phone,
        code: ctx.wizard.state.otpCode,
        otp: otp
      });
      
      await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
      
      if (res && res.status === 'success' && res.data?.attribute) {
        const payload = res.data.attribute;
        await saveSession(ctx.from.id, {
          token: payload.token,
          msisdn: payload.msisdn,
          userId: payload.user_id,
          refreshToken: payload.refresh_token
        });
        
        await ctx.reply("✅ အကောင့်ဝင်တာ အောင်မြင်သွားပါပြီ 🎉", getMainKeyboard(true));
        return ctx.scene.leave();
      } else {
        await ctx.reply("❌ OTP မှားနေပါတယ်။ /start ကိုနှိပ်ပြီး ပြန်စမ်းကြည့်ပေးပါဗျ။");
        return ctx.scene.leave();
      }
    }
  }
);

function getMainKeyboard(isLoggedIn: boolean) {
  if (!isLoggedIn) {
    return Markup.keyboard([
      ['🔑 အကောင့်ဝင်ရန်']
    ]).resize();
  }
  return Markup.keyboard([
    ['💰 လက်ကျန်ငွေစစ်ရန်', '📊 ပွိုင့်စစ်ရန်'],
    ['🎟️ TohToh ကူပွန်', '🎮 TohToh ဆော့ရန်'],
    ['🎟️ TohToh Live ဝယ်ယူရန်'],
    ['🌾 ရွှေလယ်တော ကူပွန်', '🐔 ရွှေလယ်တော ဆော့ရန်'],
    ['🌾 ရွှေလယ်တော Live ဝယ်ယူရန်'],
    ['🎁 Daily Point Claim', '🔄 အကောင့်ထွက်ရန်']
  ]).resize();
}

const stage = new Scenes.Stage([authWizard]);
bot.use(session());
bot.use(stage.middleware());

bot.start(async (ctx) => {
  const sess = await getSession(ctx.from.id);
  const msg = sess ? "ပြန်လည်ကြိုဆိုပါတယ်ဗျ။ အောက်က menu ခလုတ်လေးတွေနှိပ်ပြီး ဆက်သုံးလို့ရပါပြီ။" : "Nyth Atom Bot ကနေ ကြိုဆိုပါတယ်။ စသုံးဖို့ '🔑 အကောင့်ဝင်ရန်' ကို နှိပ်ပေးပါ။";
  await ctx.reply(msg, getMainKeyboard(!!sess));
});

bot.hears('🔑 အကောင့်ဝင်ရန်', (ctx) => ctx.scene.enter('AUTH_WIZARD'));

bot.hears('🔄 အကောင့်ထွက်ရန်', async (ctx) => {
  await clearSession(ctx.from.id);
  await ctx.reply("👋 အကောင့် ထွက်လိုက်ပါပြီ ။", getMainKeyboard(false));
});

bot.hears('💰 လက်ကျန်ငွေစစ်ရန်', async (ctx) => {
  const sess = await getSession(ctx.from.id);
  if (!sess) return ctx.reply("❌ အရင်ဆုံး အကောင့်ဝင်ပေးပါဦးဗျ။", getMainKeyboard(false));
  
  const waitMsg = await ctx.reply("⏳ လက်ကျန်ငွေ စစ်ဆေးနေပါတယ်...");
  const res = await authApiGet(ctx.from.id, `/mytmapi/v1/my/lightweight-balance?msisdn=${sess.msisdn}&userid=${sess.userId}&v=4.16.0`);
  await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
  
  if (res?._authFailed) return ctx.reply("❌ အကောင့် Token သက်တမ်းကုန်သွားပါပြီ။ ကျေးဇူးပြု၍ '🔄 အကောင့်ထွက်ရန်' ကိုနှိပ်ပြီး အကောင့်ပြန်ဝင်ပေးပါ။", getMainKeyboard(false));

  if (res && res.status === 'success') {
    const attr = res.data?.attribute || {};
    const mb = attr.mainBalance?.value ?? 0;
    const dataPack = attr.packsPieData?.data?.remaining ?? 0;
    const voicePack = attr.packsPieData?.voice?.remaining ?? 0;
    const smsPack = attr.packsPieData?.sms?.remaining ?? 0;
    
    await ctx.reply(`💰 လက်ကျန်ငွေ: ${mb.toLocaleString()} Ks\n🌐 Data: ${dataPack.toLocaleString()} MB\n📞 Voice: ${voicePack.toLocaleString()} Min\n💬 SMS: ${smsPack.toLocaleString()} SMS`);
  } else {
    await ctx.reply("❌ အခုချိန် အချက်အလက်ယူလို့ မရသေးပါဘူး။ ခဏနေမှ ထပ်စမ်းကြည့်ပေးပါဗျ။");
  }
});

bot.hears('📊 ပွိုင့်စစ်ရန်', async (ctx) => {
  const sess = await getSession(ctx.from.id);
  if (!sess) return ctx.reply("❌ အရင်ဆုံး အကောင့်ဝင်ပေးပါဦးဗျ။", getMainKeyboard(false));
  
  const waitMsg = await ctx.reply("⏳ ပွိုင့်များကို စစ်ဆေးနေပါတယ်...");
  const res = await authApiGet(ctx.from.id, `/mytmapi/v1/my/point-system/dashboard?msisdn=${sess.msisdn}&userid=${sess.userId}&v=4.16.0`);
  await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
  
  if (res?._authFailed) return ctx.reply("❌ အကောင့် Token သက်တမ်းကုန်သွားပါပြီ။ ကျေးဇူးပြု၍ '🔄 အကောင့်ထွက်ရန်' ကိုနှိပ်ပြီး အကောင့်ပြန်ဝင်ပေးပါ။", getMainKeyboard(false));

  if (res && res.status === 'success') {
    const attr = res.data?.attribute || {};
    await ctx.reply(`⭐ ပွိုင့်အမှတ်: ${attr.totalPoint?.toLocaleString()} Pts\n🏅 အဆင့်: ${attr.starStatusLabel}\n📅 Point သက်တမ်း: ${attr.validityEndDateText}`);
  } else {
    await ctx.reply("❌ အခုချိန် အချက်အလက်ယူလို့ မရသေးပါဘူး။ ခဏနေမှ ထပ်စမ်းကြည့်ပေးပါဗျ။");
  }
});

bot.hears('🎟️ TohToh ကူပွန်', async (ctx) => {
  const sess = await getSession(ctx.from.id);
  if (!sess) return ctx.reply("❌ အရင်ဆုံး အကောင့်ဝင်ပေးပါဦးဗျ。", getMainKeyboard(false));
  
  const res = await authApiGet(ctx.from.id, `/mytmapi/v1/my/tohtohunited/get-coupon-balance?msisdn=${sess.msisdn}&userid=${sess.userId}&v=4.16.0`);
  
  if (res?._authFailed) return ctx.reply("❌ အကောင့် Token သက်တမ်းကုန်သွားပါပြီ။ ကျေးဇူးပြု၍ '🔄 အကောင့်ထွက်ရန်' ကိုနှိပ်ပြီး အကောင့်ပြန်ဝင်ပေးပါ။", getMainKeyboard(false));

  if (res && res.status === 'success') {
    const count = res.data?.attribute?.couponBalance?.totalCoupon ?? 0;
    await ctx.reply(`🎟️ TohToh ဂိမ်း ကစားခွင့် (${count}) ကြိမ်`);
  } else {
    await ctx.reply("❌ ဆာဗာအခက်အခဲကြောင့် ခဏနေမှ ပြန်ကြိုးစားပေးပါဗျ။");
  }
});

bot.hears('🌾 ရွှေလယ်တော ကူပွန်', async (ctx) => {
  const sess = await getSession(ctx.from.id);
  if (!sess) return ctx.reply("❌ အရင်ဆုံး အကောင့်ဝင်ပေးပါဦးဗျ။", getMainKeyboard(false));
  
  const res = await authApiGet(ctx.from.id, `/mytmapi/v1/my/goldenfarm/get-coupon-balance?msisdn=${sess.msisdn}&userid=${sess.userId}&v=4.16.0`);
  
  if (res?._authFailed) return ctx.reply("❌ အကောင့် Token သက်တမ်းကုန်သွားပါပြီ။ ကျေးဇူးပြု၍ '🔄 အကောင့်ထွက်ရန်' ကိုနှိပ်ပြီး အကောင့်ပြန်ဝင်ပေးပါ။", getMainKeyboard(false));

  if (res && res.status === 'success') {
    const count = res.data?.attribute?.couponBalance ?? 0;
    await ctx.reply(`🌾 ရွှေလယ်တော ဂိမ်း ကစားခွင့် (${count}) ကြိမ်`);
  } else {
    await ctx.reply("❌ ဆာဗာအခက်အခဲကြောင့် ခဏနေမှ ပြန်ကြိုးစားပေးပါဗျ။");
  }
});

bot.hears('🎮 TohToh ဆော့ရန်', async (ctx) => {
  const sess = await getSession(ctx.from.id);
  if (!sess) return ctx.reply("❌ အရင်ဆုံး အကောင့်ဝင်ပေးပါဦးဗျ။", getMainKeyboard(false));
  
  const waitMsg = await ctx.reply("⏳ Toh Toh ဂိမ်း ဆော့နေပါတယ်...");

  const dashRes = await authApiGet(ctx.from.id, `/mytmapi/v1/my/tohtohunited/get-coupon-balance?msisdn=${sess.msisdn}&userid=${sess.userId}&v=4.16.0&_t=${Date.now()}`);

  if (dashRes?._authFailed) {
    await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
    return ctx.reply("❌ အကောင့် Token သက်တမ်းကုန်သွားပါပြီ။ ကျေးဇူးပြု၍ '🔄 အကောင့်ထွက်ရန်' ကိုနှိပ်ပြီး အကောင့်ပြန်ဝင်ပေးပါ။", getMainKeyboard(false));
  }

  if (!dashRes || dashRes.status !== 'success') {
    await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
    return ctx.reply("❌ ဆာဗာအခက်အခဲကြောင့် ခဏနေမှ ပြန်ကြိုးစားပေးပါဗျ။");
  }

  const count = dashRes.data?.attribute?.couponBalance?.totalCoupon ?? 0;
  if (count <= 0) {
    await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
    return ctx.reply("❌ လက်ကျန် ကစားခွင့် မရှိတော့ပါ ။");
  }

  let maxLevel = 3;
  if (dashRes.data?.attribute?.levelData) {
    const levels = dashRes.data.attribute.levelData.map((l: any) => l.level).filter((n: any) => !isNaN(n));
    if (levels.length > 0) maxLevel = Math.max(...levels);
  }

  const bodyObj = { isCompleted: 1, currentPlayLevel: maxLevel, chosenPrize: "Instant" };
  
  const res = await authApiPost(ctx.from.id, `/mytmapi/v1/my/tohtohunited/draw?msisdn=${sess.msisdn}&userid=${sess.userId}&v=4.16.0`, bodyObj);
  
  await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
  
  if (res?._authFailed) {
    return ctx.reply("❌ အကောင့် Token သက်တမ်းကုန်သွားပါပြီ။ ကျေးဇူးပြု၍ '🔄 အကောင့်ထွက်ရန်' ကိုနှိပ်ပြီး အကောင့်ပြန်ဝင်ပေးပါ။", getMainKeyboard(false));
  }

  if (res && res.status === 'success' && res.data?.attribute) {
    const attr = res.data.attribute;
    let remaining = count - 1;
    if (attr.toTohBalance?.totalCoupon !== undefined) remaining = attr.toTohBalance.totalCoupon;
    else if (attr.couponBalance?.totalCoupon !== undefined) remaining = attr.couponBalance.totalCoupon;
    else if (attr.preCouponBalance?.totalCoupon !== undefined && attr.preCouponBalance?.totalCoupon < count) remaining = attr.preCouponBalance.totalCoupon;
    if (remaining < 0) remaining = 0;

    const balanceText = remaining > 0 ? `လက်ကျန်အကြိမ် - ${remaining}` : `လက်ကျန် ကစားခွင့် မရှိတော့ပါ ။`;
    await ctx.reply(`🎉 ဂုဏ်ယူပါတယ်။\n"${attr.prizeName}" ကို လက်ခံရရှိပါပြီ\n${balanceText}`);
  } else {
    let errMsg = res?.errors?.message?.message || res?.message || res?.errors?.title || "ကစားခွင့် မကျန်တော့ပါ။";
    if (res?.errors?.message?.title && typeof res.errors.message.title === 'string' && !res.errors.message.title.includes("Failed") && !res.errors.message.title.includes("မအောင်မြင်ပါ")) {
       errMsg = res.errors.message.title + " - " + errMsg;
    }
    await ctx.reply(`❌ ${errMsg}`);
  }
});

bot.hears('🐔 ရွှေလယ်တော ဆော့ရန်', async (ctx) => {
  const sess = await getSession(ctx.from.id);
  if (!sess) return ctx.reply("❌ အရင်ဆုံး အကောင့်ဝင်ပေးပါဦးဗျ။", getMainKeyboard(false));
  
  const waitMsg = await ctx.reply("⏳ ရွှေလယ်တော ဂိမ်း ဆော့နေပါတယ်...");

  const dashRes = await authApiGet(ctx.from.id, `/mytmapi/v1/my/goldenfarm/get-coupon-balance?msisdn=${sess.msisdn}&userid=${sess.userId}&v=4.16.0&_t=${Date.now()}`);

  if (dashRes?._authFailed) {
    await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
    return ctx.reply("❌ အကောင့် Token သက်တမ်းကုန်သွားပါပြီ။ ကျေးဇူးပြု၍ '🔄 အကောင့်ထွက်ရန်' ကိုနှိပ်ပြီး အကောင့်ပြန်ဝင်ပေးပါ။", getMainKeyboard(false));
  }

  if (!dashRes || dashRes.status !== 'success') {
    await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
    return ctx.reply("❌ ဆာဗာအခက်အခဲကြောင့် ခဏနေမှ ပြန်ကြိုးစားပေးပါဗျ။");
  }

  const count = dashRes.data?.attribute?.couponBalance ?? 0;
  if (count <= 0) {
    await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
    return ctx.reply("❌ လက်ကျန် ကစားခွင့် မရှိတော့ပါ ။");
  }

  let maxScore = 165;
  const levelData = dashRes.data?.attribute?.levelData;
  if (Array.isArray(levelData)) {
    const extractedScores = levelData.map((l: any) => l.score || 0);
    if (extractedScores.length > 0) {
      const highest = Math.max(...extractedScores);
      if (highest > 0) maxScore = highest;
    }
  }

  const bodyObj = { score: maxScore };
  const res = await authApiPost(ctx.from.id, `/mytmapi/v1/my/goldenfarm/draw?msisdn=${sess.msisdn}&userid=${sess.userId}&v=4.16.0`, bodyObj);
  
  await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
  
  if (res?._authFailed) {
    return ctx.reply("❌ အကောင့် Token သက်တမ်းကုန်သွားပါပြီ။ ကျေးဇူးပြု၍ '🔄 အကောင့်ထွက်ရန်' ကိုနှိပ်ပြီး အကောင့်ပြန်ဝင်ပေးပါ။", getMainKeyboard(false));
  }

  if (res && res.status === 'success' && res.data?.attribute) {
    const attr = res.data.attribute;
    let prize = attr.prizeName;
    if (!prize && attr.message) {
      const match = attr.message.match(/ဖြစ်ပြီး\s+(.*?)\s+ကို/);
      if (match && match[1]) prize = match[1].trim();
    }
    if (!prize) prize = attr.prizeAmountText || "ဆုလက်ဆောင်";
    
    let remaining = count - 1;
    if (typeof attr.couponBalance === 'number' && attr.couponBalance < count) remaining = attr.couponBalance;
    if (remaining < 0) remaining = 0;

    const balanceText = remaining > 0 ? `လက်ကျန်အကြိမ် - ${remaining}` : `လက်ကျန် ကစားခွင့် မရှိတော့ပါ ။`;
    await ctx.reply(`🎉 ဂုဏ်ယူပါတယ်။\n"${prize}" ကို လက်ခံရရှိပါပြီ\n${balanceText}`);
  } else {
    const errorMsg = res?.message || res?.originalResponse?.message || "ကစားခွင့် မကျန်တော့ပါ။";
    await ctx.reply(`❌ ${errorMsg}`);
  }
});

bot.hears('🎟️ TohToh Live ဝယ်ယူရန်', async (ctx) => {
  const sess = await getSession(ctx.from.id);
  if (!sess) return ctx.reply("❌ အရင်ဆုံး အကောင့်ဝင်ပေးပါဦးဗျ။", getMainKeyboard(false));

  const waitMsg = await ctx.reply("⏳ ခနစောင့်ပေးပါ...");

  const getPackRes = await authApiGet(ctx.from.id, `/mytmapi/v1/my/tohtohunited/get-coupon-balance?msisdn=${sess.msisdn}&userid=${sess.userId}&v=4.16.0`);

  await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});

  if (getPackRes?._authFailed) return ctx.reply("❌ အကောင့် Token သက်တမ်းကုန်သွားပါပြီ။ ကျေးဇူးပြု၍ '🔄 အကောင့်ထွက်ရန်' ကိုနှိပ်ပြီး အကောင့်ပြန်ဝင်ပေးပါ။", getMainKeyboard(false));

  const packs = getPackRes?.data?.attribute?.luckyChanceItems?.packPurchase?.filter((p: any) => p.type === 'toh_toh_united_pack');

  if (getPackRes && getPackRes.status === 'success' && packs && packs.length > 0) {
    const buttons = packs.map((p: any) => {
      let finalChances = p.chances;
      const isDoublePack = p.title?.toLowerCase().includes('2x') || p.title?.toLowerCase().includes('double') || (p.price > 0 && (p.chances / p.price) >= 0.02);
      const displayPrice = p.desc?.match(/[\d,]+/) ? p.desc.match(/[\d,]+/)?.[0] + " KS" : `${p.price} KS`;
      const text = `${finalChances} Lives${isDoublePack ? ' (x2)' : ''} - ${displayPrice}`;
      return [Markup.button.callback(text, `buy_tohtoh_${p.offerId}`)];
    });
    
    await ctx.reply("ဝယ်ယူလိုသော ပက်ကေ့ချ်ကို ရွေးချယ်ပါ -", Markup.inlineKeyboard(buttons));
  } else {
    await ctx.reply("❌ ဝယ်ယူရန် ပက်ကေ့ချ် ရှာမတွေ့ပါ။");
  }
});

bot.action(/buy_tohtoh_(.+)/, async (ctx) => {
  const offerId = ctx.match[1];
  const sess = await getSession(ctx.from?.id);
  if (!sess) {
    await ctx.answerCbQuery("❌ အကောင့်ဝင်ရန်လိုအပ်ပါတယ်။", { show_alert: true });
    return;
  }
  
  await ctx.answerCbQuery();
  const waitMsg = await ctx.reply("⏳ ခနစောင့်ပေးပါ...");

  const bodyObj = { offerId };
  const buyRes = await authApiPost(ctx.from.id, `/mytmapi/v1/my/tohtohunited/purchase-game-pack-life?msisdn=${sess.msisdn}&userid=${sess.userId}&v=4.16.0`, bodyObj);

  await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});

  if (buyRes?._authFailed) {
      await ctx.reply("❌ အကောင့် Token သက်တမ်းကုန်သွားပါပြီ။ ကျေးဇူးပြု၍ '🔄 အကောင့်ထွက်ရန်' ကိုနှိပ်ပြီး အကောင့်ပြန်ဝင်ပေးပါ။", getMainKeyboard(false));
      return;
  }

  if (buyRes && buyRes.status === 'success') {
     // Fetch the updated balance to show
     const getPackRes = await authApiGet(ctx.from.id, `/mytmapi/v1/my/tohtohunited/get-coupon-balance?msisdn=${sess.msisdn}&userid=${sess.userId}&v=4.16.0`);
     let remain = '-';
     if (getPackRes && getPackRes.status === 'success') {
        remain = getPackRes.data?.attribute?.couponBalance?.totalCoupon ?? getPackRes.data?.attribute?.couponBalance ?? getPackRes.data?.attribute?.toTohBalance?.totalCoupon ?? '-';
     }
     await ctx.editMessageText(`✅ ၀ယ်ယူမှုအောင်မြင်ပါတယ်။ ယခုလက်ကျန်အကြိမ် - ${remain}`);
  } else {
     let errMsg = buyRes?.errors?.message?.message || buyRes?.message || buyRes?.errors?.title;
     
     const resString = buyRes ? JSON.stringify(buyRes).toLowerCase() : "";
     const isInsufficient = !buyRes || 
                            resString.includes("insufficient") || 
                            resString.includes("balance") || 
                            resString.includes("credit") || 
                            resString.includes("not enough") || 
                            resString.includes("မလုံလောက်") || 
                            resString.includes("လုံလောက်") || 
                            resString.includes("ငွေ") ||
                            resString.includes("9010") ||
                            resString.includes("9009") ||
                            (errMsg && (
                              errMsg.toLowerCase().includes("insufficient") ||
                              errMsg.toLowerCase().includes("balance") ||
                              errMsg.toLowerCase().includes("မလုံလောက်") ||
                              errMsg.toLowerCase().includes("ငွေ")
                            ));

     if (isInsufficient || !errMsg) {
       errMsg = "လက်ကျန်ငွေ မလုံလောက်ပါ။";
     } else if (buyRes?.errors?.message?.title && typeof buyRes.errors.message.title === 'string' && !buyRes.errors.message.title.includes("Failed") && !buyRes.errors.message.title.includes("မအောင်မြင်ပါ")) {
         errMsg = buyRes.errors.message.title + " - " + errMsg;
     }

     await ctx.editMessageText(`❌ ${errMsg}`);
  }
});

bot.hears('🌾 ရွှေလယ်တော Live ဝယ်ယူရန်', async (ctx) => {
  const sess = await getSession(ctx.from.id);
  if (!sess) return ctx.reply("❌ အရင်ဆုံး အကောင့်ဝင်ပေးပါဦးဗျ။", getMainKeyboard(false));
  
  const waitMsg = await ctx.reply("⏳ ခနစောင့်ပေးပါ...");
  
  const res = await authApiGet(ctx.from.id, `/mytmapi/v1/my/goldenfarm/get-coupon-balance?msisdn=${sess.msisdn}&userid=${sess.userId}&v=4.16.0`);
  
  await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});

  if (res?._authFailed) return ctx.reply("❌ အကောင့် Token သက်တမ်းကုန်သွားပါပြီ။ ကျေးဇူးပြု၍ '🔄 အကောင့်ထွက်ရန်' ကိုနှိပ်ပြီး အကောင့်ပြန်ဝင်ပေးပါ။", getMainKeyboard(false));

  if (res && res.status === 'success' && res.data?.attribute?.purchaseLife) {
    const purchaseInfo = res.data.attribute.purchaseLife;
    const price = purchaseInfo.price || 99;
    const title = purchaseInfo.regular?.title || "1 Lives";
    
    const buttons = [
      [Markup.button.callback(`${title} - ${price} KS`, `buy_goldenfarm`)]
    ];
    await ctx.reply("ဝယ်ယူလိုသော ပက်ကေ့ချ်ကို ရွေးချယ်ပါ -", Markup.inlineKeyboard(buttons));
  } else {
    // Fallback if structure is missing but we still want to give an option
    const buttons = [
      [Markup.button.callback(`1 Lives - 99 KS`, `buy_goldenfarm`)]
    ];
    await ctx.reply("ဝယ်ယူလိုသော ပက်ကေ့ချ်ကို ရွေးချယ်ပါ -", Markup.inlineKeyboard(buttons));
  }
});

bot.action('buy_goldenfarm', async (ctx) => {
  const sess = await getSession(ctx.from?.id);
  if (!sess) {
    await ctx.answerCbQuery("❌ အကောင့်ဝင်ရန်လိုအပ်ပါတယ်။", { show_alert: true });
    return;
  }

  await ctx.answerCbQuery();
  const waitMsg = await ctx.reply("⏳ ခနစောင့်ပေးပါ...");

  const res = await authApiGet(ctx.from.id, `/mytmapi/v1/my/goldenfarm/purchase-life?msisdn=${sess.msisdn}&userid=${sess.userId}&v=4.16.0`);

  await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
  
  if (res?._authFailed) {
      await ctx.reply("❌ အကောင့် Token သက်တမ်းကုန်သွားပါပြီ။ ကျေးဇူးပြု၍ '🔄 အကောင့်ထွက်ရန်' ကိုနှိပ်ပြီး အကောင့်ပြန်ဝင်ပေးပါ။", getMainKeyboard(false));
      return;
  }

  if (res && res.status === 'success') {
    // Fetch updated balance
    const getPackRes = await authApiGet(ctx.from.id, `/mytmapi/v1/my/goldenfarm/get-coupon-balance?msisdn=${sess.msisdn}&userid=${sess.userId}&v=4.16.0`);
    let remain = '-';
    if (getPackRes && getPackRes.status === 'success') {
       remain = getPackRes.data?.attribute?.couponBalance ?? '-';
    }
    await ctx.editMessageText(`✅ ၀ယ်ယူမှုအောင်မြင်ပါတယ်။ ယခုလက်ကျန်အကြိမ် - ${remain}`);
  } else {
    let errMsg = res?.errors?.message?.message || res?.message || res?.errors?.title;
    
    const resString = res ? JSON.stringify(res).toLowerCase() : "";
    const isInsufficient = !res || 
                           resString.includes("insufficient") || 
                           resString.includes("balance") || 
                           resString.includes("credit") || 
                           resString.includes("not enough") || 
                           resString.includes("မလုံလောက်") || 
                           resString.includes("လုံလောက်") || 
                           resString.includes("ငွေ") ||
                           resString.includes("9010") ||
                           resString.includes("9009") ||
                           (errMsg && (
                             errMsg.toLowerCase().includes("insufficient") ||
                             errMsg.toLowerCase().includes("balance") ||
                             errMsg.toLowerCase().includes("မလုံလောက်") ||
                             errMsg.toLowerCase().includes("ငွေ")
                           ));

    if (isInsufficient || !errMsg) {
      errMsg = "လက်ကျန်ငွေ မလုံလောက်ပါ။";
    } else if (res?.errors?.message?.title && typeof res.errors.message.title === 'string' && !res.errors.message.title.includes("Failed") && !res.errors.message.title.includes("မအောင်မြင်ပါ")) {
        errMsg = res.errors.message.title + " - " + errMsg;
    }

    if (typeof res === 'string' && res.includes('404')) {
        errMsg = "လောလောဆယ် ဝယ်ယူ၍မရနိုင်သေးပါ။";
    }
    await ctx.editMessageText(`❌ ${errMsg}`);
  }
});

bot.hears('🎁 Daily Point Claim', async (ctx) => {
  const sess = await getSession(ctx.from.id);
  if (!sess) return ctx.reply("❌ အရင်ဆုံး အကောင့်ဝင်ပေးပါဦးဗျ။", getMainKeyboard(false));
  
  const waitMsg = await ctx.reply("⏳ နေ့စဉ် Point ယူနေပါတယ်...");
  
  // Simulate visiting the Point Dashboard first. This initializes the daily point availability on ATOM's servers.
  await authApiGet(ctx.from.id, `/mytmapi/v1/my/point-system/dashboard?msisdn=${sess.msisdn}&userid=${sess.userId}&v=4.16.0&_t=${Date.now()}`);
  
  let listRes = await authApiGet(ctx.from.id, `/mytmapi/v2/my/point-system/claim-list?msisdn=${sess.msisdn}&userid=${sess.userId}&v=4.16.0&_t=${Date.now()}`);
  
  if (listRes?._authFailed) {
      await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
      return ctx.reply("❌ အကောင့် Token သက်တမ်းကုန်သွားပါပြီ။ ကျေးဇူးပြု၍ '🔄 အကောင့်ထွက်ရန်' ကိုနှိပ်ပြီး အကောင့်ပြန်ဝင်ပေးပါ။", getMainKeyboard(false));
  }

  // Fallback to v1 if v2 list doesn't have items
  if (!listRes || listRes.status !== 'success' || !listRes.data?.attribute?.items) {
      listRes = await authApiGet(ctx.from.id, `/mytmapi/v1/my/point-system/claim-list?msisdn=${sess.msisdn}&userid=${sess.userId}&v=4.16.0&_t=${Date.now()}`);
  }

  let claimId = null;
  let pointsToClaim: string | null = null;
  
  if (listRes && listRes.status === 'success' && listRes.data?.attribute?.items) {
    const items = listRes.data.attribute.items;
    
    // STRICT FILTER: Only match the exact item that is claimable TODAY
    const claimableItem = items.find((item: any) => 
      item.enable === 1 || 
      item.enable === true || 
      (typeof item.status === 'string' && ['CLAIMABLE', 'AVAILABLE', 'READY'].includes(item.status.toUpperCase())) ||
      item.status === 1 ||
      item.isClaimable === true
    );
    
    if (claimableItem) {
        claimId = claimableItem.id;
        
        // Extract precise point amount
        const pts = claimableItem.point ?? claimableItem.points ?? claimableItem.pointAmount ?? claimableItem.amount ?? claimableItem.reward ?? claimableItem.value;
        if (pts !== undefined && pts !== null) {
            const numMatch = String(pts).match(/\d+/);
            if (numMatch) pointsToClaim = numMatch[0];
            else pointsToClaim = String(pts);
        } else if (claimableItem.label) {
            const numMatch = String(claimableItem.label).match(/\d+/);
            if (numMatch) pointsToClaim = numMatch[0];
        }
    }
  }
  
  if (!claimId) {
    await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
    return ctx.reply("✅ ဒီနေ့အတွက် နေ့စဉ် Point ယူပြီးသွားပါပြီ (သို့) ယူရန်မရှိသေးပါ။ မနက်ဖြန်မှ ထပ်ယူပေးပါဗျ။");
  }
  
  await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
  
  const pointText = pointsToClaim ? `${pointsToClaim} မှတ်` : "Daily Point";
  await ctx.reply(`ရယူနိုင်သော Daily Point ပမာဏ - ${pointText}`, Markup.inlineKeyboard([
      [Markup.button.callback('ရယူမည်', `claim_point_${claimId}`)]
  ]));
});

bot.action(/claim_point_(.+)/, async (ctx) => {
  const claimId = ctx.match[1];
  const sess = await getSession(ctx.from?.id);
  if (!sess) {
    await ctx.answerCbQuery("❌ အကောင့်ဝင်ရန်လိုအပ်ပါတယ်။", { show_alert: true });
    return;
  }
  
  await ctx.answerCbQuery();
  await ctx.editMessageText("⏳ နေ့စဉ် Point ယူနေပါတယ်...");

  // Parse ID to number if it's purely digits, some APIs are strict about type
  let parsedId: string | number = claimId;
  if (/^\d+$/.test(claimId)) parsedId = Number(claimId);
  const bodyObj = { id: parsedId };
  
  // Try v1 first as it is more common for ATOM daily point claims
  let claimRes = await authApiPost(ctx.from.id, `/mytmapi/v1/my/point-system/claim?msisdn=${sess.msisdn}&userid=${sess.userId}&v=4.16.0&_t=${Date.now()}`, bodyObj);
  
  if (claimRes?._authFailed) {
      return ctx.editMessageText("❌ အကောင့် Token သက်တမ်းကုန်သွားပါပြီ။ ကျေးဇူးပြု၍ '🔄 အကောင့်ထွက်ရန်' ကိုနှိပ်ပြီး အကောင့်ပြန်ဝင်ပေးပါ။").catch(() => {});
  }

  // Fallback to v2 if v1 claim fails or not found
  if (!claimRes || claimRes.status !== 'success') {
      const v2Res = await authApiPost(ctx.from.id, `/mytmapi/v2/my/point-system/claim?msisdn=${sess.msisdn}&userid=${sess.userId}&v=4.16.0&_t=${Date.now()}`, bodyObj);
      if (v2Res && (v2Res.status === 'success' || !claimRes)) {
         claimRes = v2Res;
      }
  }

  if (claimRes && claimRes.status === 'success') {
    const msg = claimRes.data?.attribute?.message || claimRes.message || "အောင်မြင်ပါတယ်ဗျ။";
    await ctx.editMessageText(`🎉 နေ့စဉ် Point ရယူခြင်း အောင်မြင်ပါတယ်ဗျ။ ${msg}`);
  } else {
    let errMsg = claimRes?.errors?.message?.message || claimRes?.message || claimRes?.errors?.title;
    
    if (!errMsg) {
        const rawErr = claimRes ? JSON.stringify(claimRes).substring(0, 150) : "null";
        errMsg = `အခုချိန် အချက်အလက်ယူလို့ မရသေးပါဘူး။ (Dev Info: ${rawErr})`;
    }

    if (claimRes?.errors?.message?.title && typeof claimRes.errors.message.title === 'string' && !claimRes.errors.message.title.includes("Failed") && !claimRes.errors.message.title.includes("မအောင်မြင်ပါ")) {
        errMsg = claimRes.errors.message.title + " - " + errMsg;
    }
    
    // Sometimes the API returns success but with an error message in the message body
    if (errMsg.toLowerCase().includes('already claimed') || errMsg.includes('ယူပြီး')) {
         errMsg = "ဒီနေ့အတွက် နေ့စဉ် Point ယူပြီးသွားပါပြီ။";
    }
    await ctx.editMessageText(`❌ ${errMsg}`);
  }
});

bot.command('users', async (ctx) => {
  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId || ctx.from.id.toString() !== adminId.toString()) {
    return;
  }
  
  const db = await getDb();
  const userCount = Object.keys(db.sessions || {}).length;
  await ctx.reply(`📊 လက်ရှိ Bot ကို အသုံးပြုနေသော User အရေအတွက်: ${userCount} ယောက်`);
});

export function startBot() {
  bot.launch({ dropPendingUpdates: true }).then(() => {
    console.log("Telegram Bot started successfully!");
  }).catch(e => {
    console.error("Bot launch failed (Possible conflict with old chat instance):", e.message);
    if (e.response && e.response.error_code === 409) {
      console.log("Retrying bot launch in 5 seconds...");
      setTimeout(startBot, 5000);
    }
  });
}

// Automatically start the bot when executed directly
startBot();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
