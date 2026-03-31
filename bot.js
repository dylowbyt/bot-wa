import baileys from '@whiskeysockets/baileys'
import axios from 'axios'
import fs from 'fs'
import path from 'path'

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = baileys

// ================= CONFIG
const API_KEY = process.env.API_KEY
const OWNER_NUMBER = "6285285636317"

// ================= MEMORY
const groupMemory = {}
const COOLDOWN = 10000
let lastReplyTime = 0

// ================= STICKER LIST
const stickerFolder = './stickers'

// ================= START BOT
const startBot = async () => {
    const { state, saveCreds } = await useMultiFileAuthState('./session')

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['Ubuntu', 'Chrome', '20.0.04']
    })

    // ================= PAIRING CODE
    if (!sock.authState.creds.registered) {
        const code = await sock.requestPairingCode(OWNER_NUMBER)
        console.log("PAIRING CODE:", code)
    }

    sock.ev.on('creds.update', saveCreds)

    console.log("🚀 Bot ELIT++ START")

    // ================= AUTO RECONNECT
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update

        if (connection === 'close') {
            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut

            console.log('❌ Disconnect, reconnecting...', shouldReconnect)

            if (shouldReconnect) {
                startBot()
            }
        } else if (connection === 'open') {
            console.log('✅ Connected ke WhatsApp')
        }
    })

    // ================= MESSAGE HANDLER
    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages[0]
            if (!msg.message) return

            const from = msg.key.remoteJid

            // hanya grup
            if (!from.endsWith('@g.us')) return

            const now = Date.now()

            // anti spam / anti banned
            if (now - lastReplyTime < COOLDOWN) return
            if (Math.random() > 0.65) return

            lastReplyTime = now

            // ================= STICKER RANDOM
            if (Math.random() < 0.25) {
                try {
                    const files = fs.readdirSync(stickerFolder)
                    const random = files[Math.floor(Math.random() * files.length)]
                    const buffer = fs.readFileSync(path.join(stickerFolder, random))

                    await sock.sendMessage(from, {
                        sticker: buffer
                    })

                    return
                } catch (e) {
                    console.log("Sticker error:", e.message)
                }
            }

            let text =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text

            if (!text) return

            text = text.trim()
            if (text.length > 150) return

            // ================= MEMORY
            if (!groupMemory[from]) groupMemory[from] = []

            groupMemory[from].push({
                role: "user",
                content: text
            })

            groupMemory[from] = groupMemory[from].slice(-10)

            const lower = text.toLowerCase()

            let contextPrompt = ""

            if (lower.includes('?')) {
                contextPrompt = "Jawab santai, jelas."
            } else if (lower.includes('capek') || lower.includes('sedih')) {
                contextPrompt = "Balas kayak temen."
            } else if (lower.includes('jelek') || lower.includes('norak')) {
                contextPrompt = "Roasting santai."
            } else {
                contextPrompt = "Balas santai tongkrongan."
            }

            // ================= AI RESPONSE
            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "system",
                            content: "Lu anak tongkrongan WA. Lucu, santai, kadang savage. 1 kalimat."
                        },
                        ...groupMemory[from],
                        {
                            role: "user",
                            content: contextPrompt + "\n\nPesan: " + text
                        }
                    ],
                    max_tokens: 60
                },
                {
                    headers: {
                        Authorization: `Bearer ${API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            )

            const reply = response.data.choices[0].message.content

            await sock.sendMessage(from, { text: reply })

        } catch (err) {
            console.log("ERROR:", err.message)
        }
    })
}

startBot()

// ================= ANTI EXIT
setInterval(() => {}, 1000)
