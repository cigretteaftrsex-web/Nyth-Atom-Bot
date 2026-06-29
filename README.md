# ATOM Myanmar Telegram Bot - Deployment Guide
=============================================

This clean directory contains ONLY the necessary code, dependencies, and settings for running your **ATOM Telegram Bot** autonomously. You can easily deploy this directly to **Railway** or any other hosting provider (VPS, Heroku, Render, etc.).

မြန်မာဘာသာဖြင့် အသေးစိတ် ရှင်းလင်းချက်ကို အောက်တွင် ဖတ်ရှုနိုင်ပါသည်။

---

## 🚀 Deployment Instructions (English)

### Option 1: One-Click Deploy to Railway via GitHub (Recommended)

1. **Create a Private GitHub Repository**:
   - Create a new project repository on Github (e.g. `atom-telegram-bot`).
   - Download the `bot-deployment.zip` file, extract it, and commit all these files (including `bot.ts`, `package.json`, `tsconfig.json`) to your repository.

2. **Deploy on Railway**:
   - Go to [Railway.app](https://railway.app), log in, and click **New Project** > **Deploy from GitHub repo**.
   - Select your newly created repository.

3. **Configure Environment Variables**:
   - Go to your Railway project's **Variables** tab and click **Add Variable**:
     - `TELEGRAM_BOT_TOKEN` = `your_bot_token_here` (e.g. `8976003318:AAHZQ0sSiw4IlkRRGRsfFNe7asqs5ZGIbpk`)
   
4. **Deploy**:
   - Railway will automatically detect that this is a Node.js project, install the necessary dependencies, and start your bot using the command `npm start` (defined in `package.json`).
   - Done! Your bot is now active and runs 24/7.

---

## 🚀 Railway ပေါ်တွင် တင်နည်း လမ်းညွှန် (Burmese)

### အဆင့် ၁ - GitHub တွင် Repository အဆင်သင့်လုပ်ခြင်း (အထူးအကြံပြုချက်)

1. GitHub.com တွင် **Private Repository** အသစ်တစ်ခု ဆောက်ပေးပါ။ (ဥပမာ - `atom-telegram-bot`)
2. `bot-deployment.zip` ကို ဒေါင်းလုဒ်လုပ်ပြီး ဖြေချလိုက်ပါ။
3. ထွက်လာသော ဖိုင်အားလုံး ( `bot.ts`, `package.json`, `tsconfig.json`, `.env.example` ) တို့ကို GitHub repository ဆီသို့ Commit / Push တင်လိုက်ပါ။

### အဆင့် ၂ - Railway တွင် ချိတ်ဆက်တင်ခြင်း

1. [Railway.app](https://railway.app) သို့သွားပြီး အကောင့်ဖွင့်ကာ လော့ဂ်အင်ဝင်ပါ။
2. **New Project** ကိုနှိပ်ပြီး **Deploy from GitHub repo** ကို ရွေးချယ်ပါ။
3. သင့် GitHub ထဲက စောစောက Bot တင်ထားတဲ့ Repository ကို ရွေးချယ်ပေးလိုက်ပါ။

### အဆင့် ၃ - Bot Token (Environment Variable) သတ်မှတ်ခြင်း

1. Railway ရှိ သင့် Bot Project ၏ **Variables** Tab သို့ သွားပါ။
2. **Add Variable** ကိုနှိပ်ပြီး အောက်ပါအတိုင်း ဖြည့်ပေးပါ:
   - **Variable Name:** `TELEGRAM_BOT_TOKEN`
   - **Value:** သင့် @BotFather က ရယူထားတဲ့ Token (e.g. `8976003318:AAHZQ0sSiw4IlkRRGRsfFNe7asqs5ZGIbpk`)
3. **Save** ကို နှိပ်ပါ။

### အဆင့် ၄ - Deploy အောင်မြင်ခြင်း

- Railway မှ သင့် Bot ပရောဂျက်ကို Auto Detect လုပ်ကာ လိုအပ်သော Packages များကို Install ပြုလုပ်ပြီး `npm start` နဲ့ Bot ကို ချက်ချင်း စတင်လည်ပတ်ပေးမှာ ဖြစ်ပါတယ်။
- အခုဆိုရင် ကွန်ပြူတာပိတ်ထားလည်း Bot က ၂၄ နာရီလုံး အမြဲတမ်း အလုပ်လုပ်နေမှာ ဖြစ်ပါတယ်။ 👍

---

## 🛠️ Files inside this Package:
- `bot.ts`: သင့် Bot ၏ Functions၊ Error correction စနစ်များနှင့် Telegram Markup စာသားများအားလုံး ပါဝင်သော ပင်မကုဒ်။
- `package.json`: Bot အတွက် လိုအပ်သော dependencies ဖြစ်သည့် `telegraf`, `axios`, `dotenv` တို့ကို အရိုးရှင်းဆုံးဖြစ်အောင် စုစည်းပေးထားမှု။
- `tsconfig.json`: TypeScript စနစ်ဖြင့် အလုပ်လုပ်စေရန် လိုအပ်သော settings။
- `bot_db.json`: User sessions များကို သိမ်းဆည်းရန် Runtime တွင် အလိုအလျောက် ထွက်လာမည့် ဖိုင်။
- `.env.example`: Token များ ထည့်သွင်းသတ်မှတ်ပေးရန် နမူနာဖိုင်။
