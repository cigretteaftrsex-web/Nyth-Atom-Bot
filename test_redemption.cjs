const axios = require('axios');
async function test() {
    const res = await axios.post("https://cityrun.pro/getUserData", { user_id: "MzYzNzY4OQ==" }, {
        headers: {
            "User-Agent": "Mozilla/5.0",
            "AUTH-TOKEN": "YXRvbUdhbWVzQVBJX1NaMDAwMTpBIzlLIVF4UjckUDlAMg=="
        }
    });
    console.log(JSON.stringify(res.data.data.coins_redemption));
}
test();
