import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys'
import axios from 'axios'
import fs from 'fs'

// ================= CONFIG
const API_KEY = process.env.API_KEY
const OWNER_NUMBER = "6285285636317"

// ================= MEMORY
const groupMemory = {}
const COOLDOWN = 8000
let lastReplyTime = 0

// ================= START
const startBot = async () => {
    const { state, saveCreds } = await useMultiFileAuthState('./session')

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    })

    // ================= PAIRING CODE
    if (!sock.authState.creds.registered) {
        const code = await sock.requestPairingCode(OWNER_NUMBER)
        console.log("PAIRING CODE:", code)
    }

    sock.ev.on('creds.update', saveCreds)

    console.log("🚀 Bot starting...")

    // ================= MESSAGE
    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages[0]
            if (!msg.message) return

            const from = msg.key.remoteJid

            // hanya group
            if (!from.endsWith('@g.us')) return

            const now = Date.now()
            if (now - lastReplyTime < COOLDOWN) return
            if (Math.random() > 0.6) return

            lastReplyTime = now

            let text = msg.message.conversation || msg.message.extendedTextMessage?.text
            if (!text) return

            text = text.trim()
            if (text.length > 150) return

            // memory
            if (!groupMemory[from]) groupMemory[from] = []

            groupMemory[from].push({
                role: "user",
                content: text
            })

            groupMemory[from] = groupMemory[from].slice(-10)

            // context
            const lower = text.toLowerCase()
            let contextPrompt = ""

            if (lower.includes('?')) {
                contextPrompt = "Jawab santai, jelas."
            } else if (lower.includes('capek') || lower.includes('sedih')) {
                contextPrompt = "Balas kayak temen."
            } else {
                contextPrompt = "Balas santai kayak tongkrongan."
            }

            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "system",
                            content: "Lu anak tongkrongan WA. Santai, lucu, 1 kalimat."
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
                        'Authorization': `Bearer ${API_KEY}`,
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
