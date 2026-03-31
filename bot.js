const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const QRCode = require('qrcode');

// ================= CONFIG
const API_KEY = process.env.API_KEY;

// ================= CLIENT
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-security',
            '--no-first-run',
            '--no-zygote'
        ]
    }
});

// ================= MEMORY
const groupMemory = {};
const groupActivity = {};

// ================= ANTI SPAM
const COOLDOWN = 8000;
let lastReplyTime = 0;

// ================= MODE
const modes = ["normal", "sarkas", "roasting"];
function randomMode() { return modes[Math.floor(Math.random() * modes.length)]; }
function allowRoasting(text) {
    const t = text.toLowerCase();
    return t.includes("wkwk") || t.includes("anjir") || t.includes("ngaco");
}

// ================= STIKER
const stickerList = [
    './stickers/ketawa.png',
    './stickers/ngakak.png',
    './stickers/roasting.png',
    './stickers/komik.png'
];
async function sendSticker(msg) {
    try {
        const randomSticker = stickerList[Math.floor(Math.random() * stickerList.length)];
        const sticker = new Sticker(randomSticker, {
            pack: 'Bot Tongkrongan',
            author: 'Elit++',
            type: StickerTypes.FULL,
            quality: 50
        });
        const buffer = await sticker.toBuffer();
        await msg.reply(buffer, undefined, { sendMediaAsSticker: true });
    } catch (err) {
        console.log('Sticker error:', err.message);
    }
}

// ================= PROMPT
function getSystemPrompt(mode) {
    return `
Lu adalah member grup WhatsApp.

Gaya:
- Bahasa tongkrongan (lu, gw, anjir, wkwk)
- Santai, kayak anak TikTok
- 1-2 kalimat aja

Mode: ${mode}

Aturan:
- normal → santai
- sarkas → nyindir halus
- roasting → ngeledek lucu (jangan jahat)

Hindari:
- bahas fisik / agama / keluarga
- terlalu panjang

Contoh:
- "anjir serius lu?"
- "lah kok bisa gitu sih"
- "lu kalo jadi wifi sinyal E terus dah"
`;
}

// ================= AI REQUEST
async function askAI(messages) {
    const res = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        { model: "gpt-4o-mini", messages, max_tokens: 60 },
        { headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' } }
    );
    return res.data.choices[0].message.content;
}

// ================= QR LOGIN
client.on('qr', async (qr) => {
    const qrImage = await QRCode.toDataURL(qr);
    console.log(qrImage);
});

// ================= READY
client.on('ready', () => { console.log('🔥 Bot ELIT++ SUPER AKTIF'); });

// ================= DISCONNECT
client.on('disconnected', () => { client.initialize(); });

// ================= MAIN
client.on('message', async (msg) => {
    try {
        if (!msg.from.endsWith('@g.us')) return;
        groupActivity[msg.from] = Date.now();

        const now = Date.now();
        if (now - lastReplyTime < COOLDOWN) return;

        const chat = await msg.getChat();

        // ================= HANDLE MEDIA
        if (msg.hasMedia) {
            const media = await msg.downloadMedia();

            if (media.mimetype.startsWith('image') && Math.random() > 0.4) {
                const mode = randomMode();
                const reply = await askAI([
                    { role: "system", content: getSystemPrompt(mode) + " Komenin foto ini spontan." },
                    { role: "user", content: [
                        { type: "text", text: "Komentarin gambar ini" },
                        { type: "image_url", image_url: { url: `data:${media.mimetype};base64,${media.data}` } }
                    ]}
                ]);
                msg.reply(reply);
                return;
            }

            if (media.mimetype.startsWith('video') && Math.random() > 0.4) {
                const reply = await askAI([
                    { role: "system", content: "Lu anak tongkrongan. React ke video santai & lucu." },
                    { role: "user", content: msg.body || "Ada video di grup" }
                ]);
                msg.reply(reply);
                return;
            }
        }

        // ================= HANDLE TEXT
        const text = msg.body.trim();
        if (!text || text.length > 150) return;

        const isReply = msg.hasQuotedMsg;
        const isMention = msg.mentionedIds.length > 0;
        if (!isReply && !isMention && Math.random() > 0.5) return;

        let mode = randomMode();
        if (mode === "roasting" && !allowRoasting(text)) mode = "normal";

        if (!groupMemory[msg.from]) groupMemory[msg.from] = [];
        groupMemory[msg.from].push({ role: "user", content: text });
        groupMemory[msg.from] = groupMemory[msg.from].slice(-10);

        const reply = await askAI([
            { role: "system", content: getSystemPrompt(mode) },
            ...groupMemory[msg.from]
        ]);

        lastReplyTime = now;

        // ================= RESPON + STICKER RANDOM
        setTimeout(() => {
            msg.reply(reply);

            // kirim stiker kadang-kadang setelah chat
            if (Math.random() < 0.25) {
                setTimeout(() => sendSticker(msg), Math.random() * 2000 + 1000);
            }
        }, Math.random() * 3000 + 1000);

    } catch (err) { console.log('❌ Error:', err.message); }
});

// ================= AUTO NIMBRUNG (GRUP SEPI)
setInterval(async () => {
    const chats = await client.getChats();

    for (let chat of chats) {
        if (!chat.isGroup) continue;

        const last = groupActivity[chat.id._serialized] || 0;
        const diff = (Date.now() - last) / (1000 * 60 * 60);

        if (diff >= 4 && diff <= 7 && Math.random() < 0.5) {
            const text = await askAI([
                { role: "system", content: "Lu di grup sepi. Mulai obrolan random gaya tongkrongan." },
                { role: "user", content: "Mulai chat" }
            ]);
            chat.sendMessage(text);
            groupActivity[chat.id._serialized] = Date.now();
        }
    }
}, 30 * 60 * 1000);

// ================= START
client.initialize();

// ================= ANTI SLEEP
setInterval(() => {}, 1000);
