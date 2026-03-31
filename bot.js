// ================= FIX CRYPTO (WAJIB)
import crypto from 'crypto'
global.crypto = crypto.webcrypto
globalThis.crypto = crypto.webcrypto

// ================= IMPORT
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
let lastReplyTime = 0
const COOLDOWN = 10000

// ================= STICKER
const stickerFolder = './stickers'

// ================= START BOT
const startBot = async () => {
    const { state, saveCreds } = await useMultiFileAuthState('./session')

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000
    })

    console.log("🚀 Bot starting...")

    // ================= FORCE PAIRING (PALING AMAN)
    setTimeout(async () => {
        if (!sock.authState.creds.registered) {
            try {
                const code = await sock.requestPairingCode(OWNER_NUMBER)
                console.log("\n======================")
                console.log("PAIRING CODE:", code)
                console.log("======================\n")
            } catch (err) {
                console.log("❌ Pairing error:", err.message)
            }
        } else {
            console.log("✔ Sudah login, skip pairing")
        }
    }, 8000)

    // ================= CONNECTION
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update

        if (connection === 'connecting') {
            console.log('⏳ Connecting...')
        }

        if (connection === 'open') {
            console.log('✅ Connected ke WhatsApp')
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode

            console.log('❌ Disconnect:', reason)

            if (reason !== DisconnectReason.loggedOut) {
                console.log('🔄 Reconnecting...')
                setTimeout(startBot, 5000)
            } else {
                console.log('⚠️ Logout! Hapus folder session')
            }
        }
    })

    sock.ev.on('creds.update', saveCreds)

    // ================= MESSAGE HANDLER
    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages[0]
            if (!msg.message) return

            const from = msg.key.remoteJid
            if (!from.endsWith('@g.us')) return

            const now = Date.now()

            // anti spam
            if (now - lastReplyTime < COOLDOWN) return
            if (Math.random() > 0.7) return

            lastReplyTime = now

            // ================= STICKER RANDOM
            if (Math.random() < 0.25) {
                try {
                    const files = fs.readdirSync(stickerFolder)
                    if (files.length > 0) {
                        const random = files[Math.floor(Math.random() * files.length)]
                        const buffer = fs.readFileSync(path.join(stickerFolder, random))

                        await sock.sendMessage(from, { sticker: buffer })
                        return
                    }
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

            // ================= MEMORY CHAT
            if (!groupMemory[from]) groupMemory[from] = []

            groupMemory[from].push({
                role: "user",
                content: text
            })

            groupMemory[from] = groupMemory[from].slice(-10)

            const lower = text.toLowerCase()

            let mode = "Santai tongkrongan."

            if (lower.includes('?')) mode = "Jawab santai & jelas."
            if (lower.includes('sedih')) mode = "Balas kayak temen support."
            if (lower.includes('jelek')) mode = "Roasting santai lucu."

            // ================= AI RESPONSE
            const res = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: "Lu anak tongkrongan WA, lucu, 1 kalimat." },
                        ...groupMemory[from],
                        { role: "user", content: mode + "\n\nPesan: " + text }
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

            const reply = res.data.choices[0].message.content

            await sock.sendMessage(from, { text: reply })

        } catch (err) {
            console.log("ERROR:", err.message)
        }
    })
}

startBot()

// ================= ANTI EXIT
setInterval(() => {}, 1000)
