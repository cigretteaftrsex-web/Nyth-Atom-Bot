import axios from 'axios';
import https from 'https';
import { URL } from 'url';

export interface CityRunSession {
    userId: string;
    userType: string;
    authToken: string;
    cookies: string[];
}

export interface CityRunProfile {
    userId: string;
    userType: string;
    diamonds: number;
    runs: number;
    milestoneCount: number;
    milestones: any[];
    redemptionOptions: any[];
    dailyLoginReward: any[];
    showUnsubscribeBtn: string;
    lastUpdated: number;
}

const agent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
});

export class CityRunHttpClient {
    constructor(private session: CityRunSession) {}

    private getHeaders() {
        const headers: any = {
            'Content-Type': 'application/json',
            'Accept': '*/*',
            'Origin': 'https://cityrun.pro',
            'Referer': `https://cityrun.pro/final_games/toh-toh-v78/?user_id=${this.session.userId}&user_type=${this.session.userType}`,
            'X-Requested-With': 'mm.com.atom.store',
        };
        if (this.session.authToken) {
            headers['AUTH-TOKEN'] = this.session.authToken;
        }
        if (this.session.cookies && this.session.cookies.length > 0) {
            headers['Cookie'] = this.session.cookies.join('; ');
        }
        return headers;
    }

    async post(endpoint: string, data: any) {
        const url = `https://cityrun.pro${endpoint}`;
        const startTime = Date.now();
        console.log(`[CityRun] POST ${endpoint} for User: ${this.session.userId.substring(0,4)}****`);
        
        try {
            const res = await axios.post(url, data, {
                headers: this.getHeaders(),
                httpsAgent: agent,
                timeout: 15000,
                validateStatus: () => true
            });
            const duration = Date.now() - startTime;
            console.log(`[CityRun] POST ${endpoint} -> HTTP ${res.status} (Duration: ${duration}ms)`);
            return res;
        } catch (e: any) {
            const duration = Date.now() - startTime;
            console.error(`[CityRun] POST ${endpoint} -> Error: ${e.message} (Duration: ${duration}ms)`);
            throw e;
        }
    }
}

export class CityRunService {
    static async initializeSession(msisdn: string): Promise<CityRunSession> {
        console.log(`[CityRun] Initializing session for MSISDN: ${msisdn.substring(0,4)}****`);
        let currentUrl = `https://cityrun.pro/ws/redirect/?AdNetwork=atom_app&ClickID=&Publisher=&msisdn=${msisdn}`;
        let cookies: string[] = [];
        let authToken = '';
        let userId = '';
        let userType = '';

        for (let i = 0; i < 5; i++) {
            try {
                const res = await axios.get(currentUrl, {
                    headers: { 'Cookie': cookies.join('; ') },
                    maxRedirects: 0,
                    validateStatus: () => true,
                    httpsAgent: agent
                });

                if (res.headers['set-cookie']) {
                    res.headers['set-cookie'].forEach((c: string) => {
                        const cookiePart = c.split(';')[0];
                        if (!cookies.includes(cookiePart)) {
                            cookies.push(cookiePart);
                        }
                    });
                }

                if (res.status >= 300 && res.status < 400 && res.headers.location) {
                    currentUrl = new URL(res.headers.location, currentUrl).href;
                } else {
                    if (res.data && typeof res.data === 'string') {
                        const tokenMatch = res.data.match(/['"]?AUTH-TOKEN['"]?\s*:\s*['"]([^'"]+)['"]/i) || 
                                        res.data.match(/auth_token\s*=\s*['"]([^'"]+)['"]/i) ||
                                        res.data.match(/token\s*=\s*['"]([^'"]+)['"]/i);
                        if (tokenMatch) authToken = tokenMatch[1];
                    }
                    break;
                }
            } catch (e) {
                break;
            }
        }

        const finalUrl = new URL(currentUrl);
        userId = finalUrl.searchParams.get('user_id') || userId;
        userType = finalUrl.searchParams.get('user_type') || userType;
        if (!authToken) {
            authToken = finalUrl.searchParams.get('token') || finalUrl.searchParams.get('auth_token') || authToken;
        }

        if (!userId) {
            throw new Error("Failed to initialize City Run session: Could not extract user_id from redirect flow.");
        }

        console.log(`[CityRun] Session initialized successfully. UserID: ${userId.substring(0,4)}****, Token extracted: ${!!authToken}`);
        return { userId, userType, authToken, cookies };
    }

    static async getUserData(session: CityRunSession): Promise<CityRunProfile> {
        const client = new CityRunHttpClient(session);
        const res = await client.post('/getUserData', { user_id: session.userId });

        if (res.status !== 200 || !res.data || res.data.status !== 'success') {
            throw new Error(`Failed to get user data: ${res.data?.description || res.status}`);
        }

        const data = res.data.data;
        
        let completedMilestones = 0;
        if (Array.isArray(data.milestones)) {
            completedMilestones = data.milestones.filter((m: any) => m.milestone_claimed === "1").length;
        }

        return {
            userId: data.user_id,
            userType: data.user_type,
            diamonds: parseInt(data.user_coins) || 0,
            runs: parseInt(data.user_runs) || 0,
            milestoneCount: completedMilestones,
            milestones: data.milestones || [],
            redemptionOptions: data.coins_redemption || [],
            dailyLoginReward: data.daily_login_reward || [],
            showUnsubscribeBtn: data.show_unsubscribe_btn,
            lastUpdated: Date.now()
        };
    }

    static async claimMysteryBox(session: CityRunSession, score: number): Promise<any> {
        const client = new CityRunHttpClient(session);
        const res = await client.post('/claimMysteryBox', {
            user_id: session.userId,
            score: score
        });

        if (res.status !== 200 || !res.data || res.data.status !== 'success') {
            throw new Error(`Failed to claim milestone: ${res.data?.description || res.status}`);
        }

        return res.data;
    }

    static async processCoinsRedemption(session: CityRunSession, optionId: string): Promise<any> {
        const client = new CityRunHttpClient(session);
        const res = await client.post('/processCoinsRedemption', {
            user_id: session.userId,
            option_id: optionId
        });

        if (res.status !== 200 || !res.data || res.data.status !== 'success') {
            throw new Error(`Failed to redeem diamonds: ${res.data?.description || res.status}`);
        }

        return res.data;
    }
}
