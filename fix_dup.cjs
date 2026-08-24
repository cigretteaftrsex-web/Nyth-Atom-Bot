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
        "User-Agent": "Mozilla/5.0 (Linux; Android 12; Redmi K30 5G Build/SKQ1.211006.001; wv) Appl
