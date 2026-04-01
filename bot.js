const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const axios = require('axios');
const QRCode = require('qrcode');

const API_KEY = process.env.API_KEY;
let botId;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true }
});

// ===== CHATGPT PROMPT =====
function getSystemPrompt(){
    return `Kamu ChatGPT untuk programmer, logis, detail, jelas, membantu menjawab pertanyaan coding dan programming. Gunakan multi-line code dengan format WA, balas rapi.`;
}

// ===== AI REQUEST =====
async function askAI(question){
    try{
        const res = await axios.post('https://api.openai.com/v1/chat/completions',{
            model: "gpt-4o-mini",
            messages:[
                {role:"system", content:getSystemPrompt()},
                {role:"user", content:question}
            ],
            max_tokens:700
        },{
            headers:{'Authorization': `Bearer ${API_KEY}`, 'Content-Type':'application/json'},
            timeout:15000
        });
        return res.data.choices[0].message.content;
    }catch(err){
        console.log('❌ AI ERROR:',err.message);
        return 'Maaf, ada kesalahan saat memproses AI.';
    }
}

// ===== CREATE STICKER =====
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

// ===== GENERATE IMAGE =====
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

// ===== GENERATE VIDEO (placeholder, jika ada API) =====
async function generateVideoFromText(prompt){
    try{
        // Jika OpenAI menyediakan video API, panggil di sini
        // Untuk contoh, return null
        return null;
    }catch(err){
        console.log('❌ Video generation error:', err.message);
        return null;
    }
}

// ===== QR LOGIN =====
client.on('qr', async qr=>{
    const qrImage = await QRCode.toDataURL(qr);
    console.log('Scan QR ini:', qrImage);
});

client.on('ready',()=>{
    botId = client.info.wid._serialized;
    console.log('🔥 Bot ChatGPT siap!');
});

client.on('disconnected',()=>{
    console.log('⚠️ Bot disconnected, mencoba reconnect...');
    setTimeout(()=>client.initialize(),5000);
});

// ===== MESSAGE HANDLER =====
client.on('message', async msg=>{
    try{
        if(!msg.body && !msg.hasMedia) return;
        const text = msg.body?.trim();

        // ===== CASE 1: .stiker (media) =====
        if(text?.startsWith('.stiker')){
            const success = await createStickerFromMedia(msg);
            if(!success) msg.reply('Kirim foto/gambar dulu agar bisa dibuat stiker.');
            return;
        }

        // ===== CASE 2: .stikeranim (media animasi / WEBP) =====
        if(text?.startsWith('.stikeranim')){
            const success = await createStickerFromMedia(msg,true);
            if(!success) msg.reply('Kirim video/gif dulu agar bisa dibuat stiker animasi.');
            return;
        }

        // ===== CASE 3: .generatefoto =====
        if(text?.startsWith('.generatefoto')){
            const prompt = text.slice(13).trim();
            if(!prompt) return msg.reply('Tulis prompt setelah .generatefoto');
            const imageUrl = await generateImageFromText(prompt);
            if(imageUrl){
                const media = await MessageMedia.fromUrl(imageUrl);
                await msg.reply(media);
            }else{
                msg.reply('Gagal generate image.');
            }
            return;
        }

        // ===== CASE 4: .generatevidio =====
        if(text?.startsWith('.generatevidio')){
            const prompt = text.slice(13).trim();
            if(!prompt) return msg.reply('Tulis prompt setelah .generatevidio');
            const videoUrl = await generateVideoFromText(prompt);
            if(videoUrl){
                const media = await MessageMedia.fromUrl(videoUrl);
                await msg.reply(media);
            }else{
                msg.reply('Fitur generate video belum tersedia.');
            }
            return;
        }

        // ===== CASE 5: Semua chat diawali "." → ChatGPT =====
        if(text?.startsWith('.') && !text.startsWith('.stiker') && !text.startsWith('.stikeranim') && !text.startsWith('.generatefoto') && !text.startsWith('.generatevidio')){
            const question = text.slice(1).trim();
            if(!question) return;
            const reply = await askAI(question);
            await msg.reply(reply);
            return;
        }

    }catch(err){
        console.log('❌ Error handler:', err.message);
    }
});

client.initialize();
