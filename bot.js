const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.API_KEY;
let botId;

// ===== CLIENT =====
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: [
            '--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
            '--disable-gpu','--disable-web-security','--no-first-run','--no-zygote'
        ]
    }
});

// ===== MEMORY & ACTIVITY =====
const groupMemory = {};
const groupActivity = {};
const COOLDOWN = 3000; 
let lastReplyTime = 0;

// ===== STICKERS =====
const stickersFolder = path.join(__dirname,'stickers');
let stickerList = fs.existsSync(stickersFolder)
    ? fs.readdirSync(stickersFolder).filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file))
      .map(file => path.join(stickersFolder,file))
    : [];
function pickRandomSticker(){ 
    if(stickerList.length===0) return null; 
    return stickerList[Math.floor(Math.random()*stickerList.length)]; 
}
async function sendSticker(msg){ 
    try{ 
        const stickerPath = pickRandomSticker(); 
        if(!stickerPath) return; 
        const sticker = new Sticker(stickerPath,{
            pack:'Bot Tongkrongan',
            author:'Elit++',
            type: StickerTypes.FULL,
            quality:50
        }); 
        const buffer = await sticker.toBuffer(); 
        await msg.reply(buffer, undefined, {sendMediaAsSticker:true}); 
    }catch(err){ console.log('Sticker error:',err.message); } 
}

// ===== PROMPT =====
function getSystemPrompt(){
    return `Lu anak tongkrongan WA. Balas singkat, padat, logis, casual (yg, gitu, wkwk). Santai, kadang sarkas/roasting. Jawaban max 1-2 kalimat. Jawab sesuai topik dan relevan.`;
}

// ===== AI REQUEST =====
async function askAI(messages){
    const res = await axios.post('https://api.openai.com/v1/chat/completions',{
        model:"gpt-4o-mini",
        messages,max_tokens:40
    },{
        headers:{'Authorization':`Bearer ${API_KEY}`,'Content-Type':'application/json'}
    });
    return res.data.choices[0].message.content;
}

// ===== QR LOGIN =====
client.on('qr', async qr => {
    const qrImage = await QRCode.toDataURL(qr);
    console.log(qrImage);
});

// ===== READY =====
client.on('ready', async () => {
    const me = await client.info;
    botId = me.wid._serialized;
    console.log('🔥 Bot ELIT++ SELEKTIF AKTIF');
});

// ===== DISCONNECT =====
client.on('disconnected', ()=>{ client.initialize(); });

// ===== MAIN MESSAGE HANDLER =====
client.on('message', async msg => {
    try{
        if(!botId) return; // tunggu botId siap
        if(!msg.from.endsWith('@g.us')) return; // group only
        groupActivity[msg.from] = Date.now();

        const now = Date.now();
        if(now - lastReplyTime < COOLDOWN) return;

        const text = msg.body?.trim();
        const lower = text?.toLowerCase()||"";

        // ===== CEK REPLY / MENTION =====
        let isReplyToBot = false;
        if(msg.hasQuotedMsg){
            const quotedMsg = await msg.getQuotedMessage().catch(()=>null);
            if(quotedMsg && quotedMsg.author === botId) isReplyToBot = true;
        }
        const isMention = msg.mentionedIds?.includes(botId);
        const isSticker = msg.type==='sticker';

        // ===== KEYWORDS =====
        const keywordPatterns = [
            "\\?","gimana","kenapa","menurut",
            "bagus","bagusan","bagusnya","bingung",
            "pilih","saran","pendapat"
        ];
        const isQuestion = keywordPatterns.some(k => new RegExp(k,"i").test(lower));
        const isJokes = lower.includes("haha")||lower.includes("wkwk")||lower.includes("jokes");

        const shouldReply = isReplyToBot || isMention || isSticker || isQuestion || isJokes;
        if(!shouldReply) return;

        lastReplyTime = now;

        // ===== HANDLE STICKER =====
        if(isSticker){
            setTimeout(()=>sendSticker(msg), Math.random()*2000+1000);
            return;
        }

        // ===== HANDLE MEDIA =====
        if(msg.hasMedia){
            const media = await msg.downloadMedia().catch(()=>null);
            if(media && (media.mimetype.startsWith('image') || media.mimetype.startsWith('video'))){
                if(isReplyToBot || isMention || isQuestion || isJokes){
                    const reply = await askAI([
                        {role:"system", content:getSystemPrompt()},
                        {role:"user", content:text||"Ada media"}
                    ]);
                    msg.reply(reply);
                    return;
                }
            }
        }

        // ===== HANDLE TEXT =====
        if(text && (isReplyToBot || isMention || isQuestion || isJokes)){
            if(!groupMemory[msg.from]) groupMemory[msg.from]=[];
            groupMemory[msg.from].push({role:"user",content:text});
            groupMemory[msg.from]=groupMemory[msg.from].slice(-10);

            const reply = await askAI([{role:"system",content:getSystemPrompt()}, ...groupMemory[msg.from]]);
            setTimeout(()=>{
                msg.reply(reply);
                if(Math.random()<0.25) setTimeout(()=>sendSticker(msg), Math.random()*2000+1000);
            }, Math.random()*2000+1000);
        }

    }catch(err){ console.log('❌ Error:',err.message); }
});

// ===== AUTO NIMBRUNG =====
setInterval(async()=>{
    const chats = await client.getChats();
    for(let chat of chats){
        if(!chat.isGroup) continue;
        const last = groupActivity[chat.id._serialized]||0;
        const diff = (Date.now()-last)/(1000*60*60);
        if(diff >=4 && diff <=7 && Math.random()<0.5){
            const text = await askAI([
                {role:"system",content:"Lu di grup sepi. Mulai obrolan random relevan topik tongkrongan."},
                {role:"user",content:"Mulai chat"}
            ]);
            chat.sendMessage(text);
            groupActivity[chat.id._serialized] = Date.now();
        }
    }
}, 30*60*1000);

client.initialize();
setInterval(()=>{},1000);
