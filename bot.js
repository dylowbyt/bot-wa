// ================= FIX CRYPTO
import crypto from 'crypto'
global.crypto = crypto.webcrypto
globalThis.crypto = crypto.webcrypto

// ================= IMPORT
import baileys from '@whiskeysockets/baileys'
import fs from 'fs'
import axios from 'axios'
import path from 'path'

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = baileys

// ================= CONFIG
const OWNER_NUMBER = "6285934251573"
const API_KEY = process.env.API_KEY

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
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        browser: ['Ubuntu', 'Chrome', '20.0.04']
    })

    console.log("🚀 Bot starting...")

    let pairingDone = false

    // ================= CONNECTION
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update

        if (connection === 'connecting') {
            console.log('⏳ Connecting...')
        }

        if (connection === 'open') {
            console.log('✅ Connected ke WhatsApp')

            // 🔑 PAIRING SUPER AMAN (ANTI 405)
            if (!sock.authState.creds.registered && !pairingDone) {
                pairingDone = true

                console.log("⏳ Tunggu 15 detik sebelum pairing...")

                setTimeout(async () => {
                    try {
                        const code = await sock.requestPairingCode(OWNER_NUMBER)

                        console.log("\n==============================")
                        console.log("PAIRING CODE:", code)
                        console.log("==============================\n")

                    } catch (err) {
                        console.log("❌ Pairing error:", err.message)
                    }
                }, 15000) // 15 DETIK (WAJIB BIAR GAK 405)
            }
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode

            console.log('❌ Disconnect:', reason)

            // ⛔ kasih jeda biar gak ke-block
            if (reason !== DisconnectReason.loggedOut) {
                console.log('⏳ Reconnect 15 detik...')
                setTimeout(startBot, 15000)
            } else {
                console.log('⚠️ Logout! hapus session')
            }
        }
    })

    sock.ev.on('creds.update', saveCreds)

    // ================= MESSAGE HANDLER (AKTIF SETELAH LOGIN)
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

            // ================= MEMORY
            if (!groupMemory[from]) groupMemory[from] = []

            groupMemory[from].push({
                role: "user",
                content: text
            })

            groupMemory[from] = groupMemory[from].slice(-10)

            // ================= AI
            const res = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: "Lu anak tongkrongan WA, santai, lucu, 1 kalimat." },
                        ...groupMemory[from],
                        { role: "user", content: text }
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
