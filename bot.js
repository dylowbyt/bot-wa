const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const axios = require('axios');
const QRCode = require('qrcode');

// ==================== CONFIG ====================
const API_KEY = process.env.API_KEY;
let botId;

// ==================== PUPPETEER OPTIONS ====================
const puppeteerOptions = {
    headless: true,
    args: [
        '--no-sandbox',               // wajib untuk root/admin safe
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--no-first-run',
        '--no-zygote'
    ]
    // executablePath dihapus → Puppeteer akan auto-download Chromium
};

// ==================== CLIENT ====================
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: puppeteerOptions
});

// ==================== CHATGPT ====================
function getSystemPrompt(){
    return `Kamu ChatGPT serba bisa untuk programmer dan pertanyaan umum, logis, jelas, rapi, bisa buat coding HTML/JS/game, atau menjawab pertanyaan biasa. Gunakan multi-line code untuk kode, jawaban singkat & jelas untuk pertanyaan umum.`;
}

async function askAI(question){
    try{
        const res = await axios.post('https://api.openai.com/v1/chat/completions',{
            model: "gpt-4o-mini",
            messages:[
                {role:"system", content:getSystemPrompt()},
                {role:"user", content:question}
            ],
            max_tokens:1000
        },{
            headers:{'Authorization': `Bearer ${API_KEY}`, 'Content-Type':'application/json'},
            timeout:30000
        });
        return res.data.choices[0].message.content;
    }catch(err){
        console.log('❌ AI ERROR:', err.message);
        return 'Maaf, ada kesalahan saat memproses AI.';
    }
}

// ==================== STICKER ====================
async function createStickerFromMedia(msg, animated=false){
    if(!msg.hasMedia) return false;
    const media = await msg.downloadMedia().catch(()=>null);
    if(!media) return false;
    try{
        const sticker = new Sticker(media.data,{
            type: animated ? StickerTypes.ANIMATED : StickerTypes.FULL,
            pack: 'Bot Tongkrongan',
            author: 'ChatGPT'
        });
        const buffer = await sticker.toBuffer();
        await msg.reply(buffer, undefined, {sendMediaAsSticker:true});
        return true;
    }catch(err){
        console.log('❌ Stiker error:', err.message);
        return false;
    }
}

// ==================== IMAGE / VIDEO ====================
async function generateImageFromText(prompt){
    try{
        const res = await axios.post('https://api.openai.com/v1/images/generations',{
            model:"gpt-image-1",
            prompt,
            size:"1024x1024",
            n:1
        },{
            headers:{'Authorization': `Bearer ${API_KEY}`, 'Content-Type':'application/json'},
            timeout:30000
        });
        return res.data.data[0].url;
    }catch(err){
        console.log('❌ Image generation error:', err.message);
        return null;
    }
}

async function generateVideoFromText(prompt){
    try{
        return null; // Placeholder
    }catch(err){
        console.log('❌ Video generation error:', err.message);
        return null;
    }
}

// ==================== QR LOGIN ====================
client.on('qr', async qr=>{
    const qrImage = await QRCode.toDataURL(qr);
    console.log('Scan QR ini:', qrImage);
});

client.on('ready',()=>{
    botId = client.info.wid._serialized;
    console.log('🔥 Bot ChatGPT siap (#bot trigger)!');
});

client.on('disconnected', ()=>{
    console.log('⚠️ Bot disconnected, mencoba reconnect...');
    setTimeout(()=>client.initialize(),5000);
});

// ==================== MESSAGE HANDLER ====================
client.on('message', async msg=>{
    try{
        if(!msg.body && !msg.hasMedia) return;
        const text = msg.body?.trim() || '';

        const lowerText = text.toLowerCase();
        const isTagged = lowerText.includes('#bot') || (Array.isArray(msg._data?.mentionedJid) && msg._data.mentionedJid.includes(botId));
        if(!isTagged) return;

        const cleanText = lowerText.replace('#bot','').trim();

        // ----- STICKER -----
        if(cleanText.startsWith('stiker')){
            const success = await createStickerFromMedia(msg);
            if(!success) msg.reply('Kirim foto/gambar dulu agar bisa dibuat stiker.');
            return;
        }

        if(cleanText.startsWith('stikeranim')){
            const success = await createStickerFromMedia(msg,true);
            if(!success) msg.reply('Kirim video/gif dulu agar bisa dibuat stiker animasi.');
            return;
        }

        // ----- GENERATE FOTO -----
        if(cleanText.startsWith('generatefoto')){
            const prompt = cleanText.slice(12).trim();
            if(!prompt) return msg.reply('Tulis prompt setelah generatefoto');
            const imageUrl = await generateImageFromText(prompt);
            if(imageUrl){
                const media = await MessageMedia.fromUrl(imageUrl);
                await msg.reply(media);
            }else{
                msg.reply('Gagal generate image.');
            }
            return;
        }

        // ----- GENERATE VIDEO -----
        if(cleanText.startsWith('generatevidio')){
            const prompt = cleanText.slice(13).trim();
            if(!prompt) return msg.reply('Tulis prompt setelah generatevidio');
            const videoUrl = await generateVideoFromText(prompt);
            if(videoUrl){
                const media = await MessageMedia.fromUrl(videoUrl);
                await msg.reply(media);
            }else{
                msg.reply('Fitur generate video belum tersedia.');
            }
            return;
        }

        // ----- SEMUA LAINNYA → ChatGPT -----
        if(cleanText){
            const reply = await askAI(cleanText);
            await msg.reply(reply);
            return;
        }

    }catch(err){
        console.log('❌ Error handler:', err.message);
    }
});

// ==================== INITIALIZE ====================
(async ()=>{
    try{
        await client.initialize();
    }catch(err){
        console.log('❌ Failed to initialize client:', err.message);
    }
})();
