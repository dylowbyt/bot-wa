const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

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

// ================= STICKERS RANDOM (.webp support)
const stickersFolder = path.join(__dirname, 'stickers');
let stickerList = fs.existsSync(stickersFolder) ? 
    fs.readdirSync(stickersFolder)
        .filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file))
        .map(file => path.join(stickersFolder, file))
    : [];

function pickRandomSticker() {
    if (stickerList.length === 0) return null;
    return stickerList[Math.floor(Math.random() * stickerList.length)];
}

async function sendSticker(msg) {
    try {
        const stickerPath = pickRandomSticker();
        if (!stickerPath) return;

        const sticker = new Sticker(stickerPath, {
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

// ================= SYSTEM PROMPT (SINGKAT)
function getSystemPrompt(mode) {
    return `
Lu anak tongkrongan WA. Balas chat singkat, kata-kata casual, kayak yg, gitu, wkwk.
Mode: ${mode}. Santai, kadang sarkas/roasting. 1-2 kata atau kalimat pendek. 
Jangan panjang, jangan bahas fisik/agama/keluarga.
`;
}

// ================= AI REQUEST
async function askAI(messages) {
    const res = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        { model: "gpt-4o-mini", messages, max_tokens: 30 },
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
client.on('ready', () => { console.log('🔥 Bot ELIT++ SINGKAT AKTIF'); });

// ================= DISCONNECT
client.on('disconnected', () => { client.initialize(); });

// ================= MAIN
client.on('message', async (msg) => {
    try {
        if (!msg.from.endsWith('@g.us')) return;
        groupActivity[msg.from] = Date.now();

        const now = Date.now();
        if (now - lastReplyTime < COOLDOWN) return;

        const lower = msg.body?.toLowerCase() || "";

        // ================= SELEKTIF RESPON
        const isReply = msg.hasQuotedMsg;
        const isMention = msg.mentionedIds.length > 0;
        const isSticker = msg.type === "sticker";
        const isQuestion = lower.includes("?") || lower.includes("gimana") || lower.includes("kenapa") || lower.includes("menurut");
        const isSaran = lower.includes("saran") || lower.includes("pendapat");
        const isJokes = lower.includes("haha") || lower.includes("wkwk") || lower.includes("jokes");

        const shouldReply = isReply || isMention || isQuestion || isSaran || isJokes || isSticker;
        if (!shouldReply) return;

        lastReplyTime = now;

        // ================= HANDLE MEDIA (foto/video)
        if (msg.hasMedia) {
            const media = await msg.downloadMedia();
            if (!media) return;

            if (media.mimetype.startsWith('image') || media.mimetype.startsWith('video')) {
                if (!shouldReply) return;
                const mode = randomMode();
                const reply = await askAI([
                    { role: "system", content: getSystemPrompt(mode) + " Komenin media ini." },
                    { role: "user", content: msg.body || "Ada media di grup" }
                ]);
                msg.reply(reply);
                return;
            }
        }

        // ================= HANDLE STICKER
        if (isSticker) {
            setTimeout(() => sendSticker(msg), Math.random() * 2000 + 1000);
            return;
        }

        // ================= HANDLE TEXT
        if (!groupMemory[msg.from]) groupMemory[msg.from] = [];
        groupMemory[msg.from].push({ role: "user", content: msg.body });
        groupMemory[msg.from] = groupMemory[msg.from].slice(-10);

        let mode = randomMode();
        if (mode === "roasting" && !allowRoasting(msg.body)) mode = "normal";

        const reply = await askAI([
            { role: "system", content: getSystemPrompt(mode) },
            ...groupMemory[msg.from]
        ]);

        setTimeout(() => {
            msg.reply(reply);

            // Kadang kirim stiker random
            if (Math.random() < 0.25) {
                setTimeout(() => sendSticker(msg), Math.random() * 2000 + 1000);
            }
        }, Math.random() * 3000 + 1000);

    } catch (err) { console.log('❌ Error:', err.message); }
});

// ================= AUTO NIMBRUNG (jika grup sepi)
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
