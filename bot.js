const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

// ================= CONFIG
const API_KEY = process.env.API_KEY;

// ================= CLIENT (FIX RAILWAY TANPA PATH)
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    }
});

// ================= MEMORY
const groupMemory = {};

// ================= ANTI SPAM
const COOLDOWN = 8000;
let lastReplyTime = 0;

// ================= STIKER LIST
const stickerList = [
    './stickers/ketawa.png',
    './stickers/ngakak.png',
    './stickers/roasting.png',
    './stickers/komik.png'
];

// ================= FUNCTION STIKER
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

// ================= QR LOGIN
client.on('qr', (qr) => {
    console.log('SCAN QR INI:');
    console.log(qr);
});

// ================= READY
client.on('ready', () => {
    console.log('🔥 Bot ELIT++ aktif');
});

// ================= MAIN LOGIC
client.on('message', async (msg) => {
    try {
        if (!msg.from.endsWith('@g.us')) return;

        const now = Date.now();
        if (now - lastReplyTime < COOLDOWN) return;

        if (Math.random() > 0.6) return;

        lastReplyTime = now;

        // ================= STIKER RANDOM
        if (Math.random() < 0.25) {
            return sendSticker(msg);
        }

        // ================= HANDLE MEDIA (VISION)
        if (msg.hasMedia) {
            const media = await msg.downloadMedia();

            if (!media || !media.mimetype.startsWith('image')) return;

            if (Math.random() > 0.5) return;

            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "system",
                            content: "Lu anak tongkrongan WA. Komentarin gambar dengan santai, lucu, roasting dikit."
                        },
                        {
                            role: "user",
                            content: [
                                { type: "text", text: "Komentarin gambar ini." },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: `data:${media.mimetype};base64,${media.data}`
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens: 60
                },
                {
                    headers: {
                        'Authorization': `Bearer ${API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const reply = response.data.choices[0].message.content;
            return msg.reply(reply);
        }

        // ================= HANDLE TEXT
        let text = msg.body.trim();
        if (!text || text.length > 150) return;

        if (!groupMemory[msg.from]) {
            groupMemory[msg.from] = [];
        }

        groupMemory[msg.from].push({
            role: "user",
            content: text
        });

        groupMemory[msg.from] = groupMemory[msg.from].slice(-10);

        const lower = text.toLowerCase();

        let contextPrompt = "";

        if (
            lower.includes('?') ||
            lower.includes('gimana') ||
            lower.includes('kenapa') ||
            lower.includes('menurut')
        ) {
            contextPrompt = "Ini pertanyaan. Jawab santai, jelas.";
        } else if (
            lower.includes('capek') ||
            lower.includes('sedih') ||
            lower.includes('stress')
        ) {
            contextPrompt = "Ini curhat. Balas kayak temen.";
        } else if (
            lower.includes('jelek') ||
            lower.includes('alay') ||
            lower.includes('norak')
        ) {
            contextPrompt = "Roasting lucu, santai.";
        } else {
            contextPrompt = "Balas santai kayak tongkrongan.";
        }

        const messages = [
            {
                role: "system",
                content: "Lu anak tongkrongan WA. Santai, lucu, kadang savage. Jawaban max 1 kalimat."
            },
            ...groupMemory[msg.from],
            {
                role: "user",
                content: contextPrompt + "\n\nPesan terbaru: " + text
            }
        ];

        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: "gpt-4o-mini",
                messages: messages,
                max_tokens: 60
            },
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const reply = response.data.choices[0].message.content;

        msg.reply(reply);

    } catch (err) {
        console.log(err.message);
    }
});

// ================= START
client.initialize();

// ================= ANTI EXIT
setInterval(() => {}, 1000);
