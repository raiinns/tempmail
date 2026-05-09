require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_USER_ID = Number(process.env.OWNER_USER_ID);
const ADMIN_SECRET = process.env.ADMIN_SECRET;
const BACKEND_URL = process.env.BACKEND_URL || '';

if (!BOT_TOKEN || !OWNER_USER_ID || !ADMIN_SECRET) {
    console.error('❌ Missing BOT_TOKEN, OWNER_USER_ID, or ADMIN_SECRET in .env');
    process.exit(1);
}

// ───────────────────────────────────────────
// Bot Setup
// ───────────────────────────────────────────
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Reply Keyboard (permanen)
const mainKeyboard = {
    keyboard: [
        ['📋 List Keys', '➕ Create Key'],
        ['📊 Stats', '❌ Cancel']
    ],
    resize_keyboard: true,
    persistent: true
};

// ───────────────────────────────────────────
// State Management (for wizard flows)
// ───────────────────────────────────────────
const userStates = new Map(); // chatId -> { action, data, timeout }

function clearState(chatId) {
    const s = userStates.get(chatId);
    if (s && s.timeout) clearTimeout(s.timeout);
    userStates.delete(chatId);
}

function setState(chatId, action, data = {}) {
    clearState(chatId);
    const timeout = setTimeout(() => {
        userStates.delete(chatId);
        bot.sendMessage(chatId, '⏳ Waktu habis. Operasi dibatalkan.', {
            reply_markup: mainKeyboard
        }).catch(() => { });
    }, 300000); // 5 menit timeout
    userStates.set(chatId, { action, data, timeout });
}

// ───────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────
function isOwner(userId) {
    return userId === OWNER_USER_ID;
}

async function apiAdmin(method, path, body = null) {
    const opts = {
        method,
        headers: {
            'x-admin-secret': ADMIN_SECRET,
            'Content-Type': 'application/json'
        }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${BACKEND_URL}${path}`, opts);
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`HTTP ${res.status}: ${err}`);
    }
    return res.json();
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>');
}

function formatDate(dateStr) {
    if (!dateStr) return 'None';
    const d = new Date(dateStr);
    return d.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
}

function keyStatusIcon(key) {
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) return '📛 Expired';
    return key.isActive ? '✅ Active' : '❌ Revoked';
}

// ───────────────────────────────────────────
// Owner Guard Middleware
// ───────────────────────────────────────────
bot.on('message', (msg) => {
    if (!isOwner(msg.from.id)) {
        bot.sendMessage(msg.chat.id, '🚫 Kamu tidak punya izin untuk menggunakan bot ini.');
    }
});

bot.on('callback_query', (query) => {
    if (!isOwner(query.from.id)) {
        bot.answerCallbackQuery(query.id, { text: '🚫 Unauthorized' });
    }
});

// ───────────────────────────────────────────
// /start Command
// ───────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
    if (!isOwner(msg.from.id)) return;
    const chatId = msg.chat.id;
    clearState(chatId);
    await bot.sendMessage(chatId,
        '<b>👋 TempMail API Key Manager</b>\n\n' +
        'Website: <i>https://yourdomain.com</i>\n\n' +
        'Gunakan tombol di bawah untuk mengelola API Key.',
        {
            parse_mode: 'HTML',
            reply_markup: mainKeyboard,
        }
    );
});

// ───────────────────────────────────────────
// 📋 List Keys
// ───────────────────────────────────────────
bot.onText(/📋 List Keys/, async (msg) => {
    if (!isOwner(msg.from.id)) return;
    const chatId = msg.chat.id;
    clearState(chatId);

    try {
        const keys = await apiAdmin('GET', '/api/admin/keys');
        if (!keys || keys.length === 0) {
            return bot.sendMessage(chatId, '📭 Tidak ada API key.', {
                reply_markup: mainKeyboard
            });
        }

        await bot.sendMessage(chatId, `<b>🔑 Total Keys: ${keys.length}</b>`, {
            parse_mode: 'HTML',
            reply_markup: mainKeyboard
        });

        // Kirim maks 10 key (agar tidak spam)
        const displayKeys = keys.slice(0, 10);
        for (const key of displayKeys) {
            const text =
                `<b>ID:</b> <code>${key.id}</code>\n` +
                `<b>Name:</b> ${escapeHtml(key.name || '-')}\n` +
                `<b>Desc:</b> ${escapeHtml(key.description || '-')}\n` +
                `<b>Status:</b> ${escapeHtml(keyStatusIcon(key))}\n` +
                `<b>Rate Limit Bypass:</b> ${key.skipRateLimit ? '✅ Yes' : '❌ No'}\n` +
                `<b>Created:</b> ${escapeHtml(formatDate(key.createdAt))}\n` +
                `<b>Last Used:</b> ${escapeHtml(formatDate(key.lastUsedAt))}\n` +
                `<b>Expires:</b> ${escapeHtml(formatDate(key.expiresAt))}`;

            const inline = {
                inline_keyboard: [
                    [
                        { text: key.isActive ? '❌ Revoke' : '✅ Activate', callback_data: `toggle_${key.id}` },
                        { text: '🗑️ Delete', callback_data: `delete_${key.id}` }
                    ]
                ]
            };

            await bot.sendMessage(chatId, text, {
                parse_mode: 'HTML',
                reply_markup: inline
            });
        }

        if (keys.length > 10) {
            await bot.sendMessage(chatId, `...dan ${keys.length - 10} key lainnya.`, {
                reply_markup: mainKeyboard
            });
        }
    } catch (err) {
        console.error('❌ List Keys Error:', err);
        bot.sendMessage(chatId, `❌ Gagal mengambil daftar key:\n<code>${escapeHtml(err.message)}</code>`, {
            parse_mode: 'HTML',
            reply_markup: mainKeyboard
        });
    }
});

// ───────────────────────────────────────────
// ➕ Create Key (Wizard)
// ───────────────────────────────────────────
bot.onText(/➕ Create Key/, async (msg) => {
    if (!isOwner(msg.from.id)) return;
    const chatId = msg.chat.id;
    setState(chatId, 'create_name');
    await bot.sendMessage(chatId,
        '<b>✏️ Buat API Key Baru</b>\n\nLangkah 1/3\nMasukkan <b>nama</b> key (contoh: Raja Dairot):',
        {
            parse_mode: 'HTML',
            reply_markup: { remove_keyboard: true } // Hide main keyboard saat wizard
        }
    );
});

// ───────────────────────────────────────────
// 📊 Stats
// ───────────────────────────────────────────
bot.onText(/📊 Stats/, async (msg) => {
    if (!isOwner(msg.from.id)) return;
    const chatId = msg.chat.id;
    clearState(chatId);

    try {
        const keys = await apiAdmin('GET', '/api/admin/keys');
        const total = keys.length;
        const active = keys.filter(k => k.isActive && (!k.expiresAt || new Date(k.expiresAt) > new Date())).length;
        const revoked = keys.filter(k => !k.isActive).length;
        const expired = keys.filter(k => k.expiresAt && new Date(k.expiresAt) <= new Date()).length;
        const bypass = keys.filter(k => k.skipRateLimit).length;

        const text =
            `<b>📊 API Key Statistics</b>\n\n` +
            `• Total Keys: <b>${total}</b>\n` +
            `• Active: <b>${active}</b>\n` +
            `• Revoked: <b>${revoked}</b>\n` +
            `• Expired: <b>${expired}</b>\n` +
            `• Rate Limit Bypass: <b>${bypass}</b>`;

        await bot.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            reply_markup: mainKeyboard
        });
    } catch (err) {
        console.error('❌ Stats Error:', err);
        bot.sendMessage(chatId, `❌ Gagal mengambil statistik:\n<code>${escapeHtml(err.message)}</code>`, {
            parse_mode: 'HTML',
            reply_markup: mainKeyboard
        });
    }
});

// ───────────────────────────────────────────
// ❌ Cancel
// ───────────────────────────────────────────
bot.onText(/❌ Cancel/, async (msg) => {
    if (!isOwner(msg.from.id)) return;
    const chatId = msg.chat.id;
    clearState(chatId);
    await bot.sendMessage(chatId, '❌ Operasi dibatalkan.', {
        reply_markup: mainKeyboard
    });
});

// ───────────────────────────────────────────
// Wizard Message Handler (Create Key flow)
// ───────────────────────────────────────────
bot.on('message', async (msg) => {
    if (!isOwner(msg.from.id)) return;
    const chatId = msg.chat.id;
    const state = userStates.get(chatId);
    if (!state) return;

    const text = msg.text;
    if (!text || text.startsWith('/')) return;

    try {
        if (state.action === 'create_name') {
            state.data.name = text.trim();
            state.action = 'create_desc';
            await bot.sendMessage(chatId,
                `✅ Nama: <b>${escapeHtml(state.data.name)}</b>\n\n` +
                'Langkah 2/3\nMasukkan <b>deskripsi</b> (atau ketik <code>-</code> untuk skip):',
                { parse_mode: 'HTML' }
            );
        }
        else if (state.action === 'create_desc') {
            state.data.description = text.trim() === '-' ? '' : text.trim();
            state.action = 'create_bypass';
            await bot.sendMessage(chatId,
                `✅ Nama: <b>${escapeHtml(state.data.name)}</b>\n\n` +
                `✅ Deskripsi: <b>${escapeHtml(state.data.description || '-')}</b>\n\n` +
                'Langkah 3/3\n<b>Bypass rate limit?</b>',
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '✅ Ya, bypass', callback_data: 'bypass_yes' },
                                { text: '❌ Tidak', callback_data: 'bypass_no' }
                            ]
                        ]
                    }
                }
            );
        }
    } catch (err) {
        console.error('❌ Wizard Error:', err);
        bot.sendMessage(chatId, `❌ Error: <code>${escapeHtml(err.message)}</code>`, {
            parse_mode: 'HTML'
        });
        clearState(chatId);
    }
});

// ───────────────────────────────────────────
// Callback Queries (Inline Buttons)
// ───────────────────────────────────────────
bot.on('callback_query', async (query) => {
    if (!isOwner(query.from.id)) return;
    const chatId = query.message.chat.id;
    const data = query.data;

    try {
        // Bypass selection (create key wizard)
        if (data === 'bypass_yes' || data === 'bypass_no') {
            const state = userStates.get(chatId);
            if (!state || state.action !== 'create_bypass') {
                await bot.answerCallbackQuery(query.id, { text: '⏳ Session expired' });
                return;
            }

            await bot.answerCallbackQuery(query.id, { text: '⏳ Creating key...' });

            const body = {
                name: state.data.name,
                description: state.data.description || undefined,
                skipRateLimit: data === 'bypass_yes'
            };

            const result = await apiAdmin('POST', '/api/admin/keys', body);
            clearState(chatId);

            const rawKey = result.rawKey;
            const keyInfo = result.apiKey;

            const msgText =
                `<b>✅ API Key berhasil dibuat!</b>\n\n` +
                `<b>ID:</b> <code>${keyInfo.id}</code>\n` +
                `<b>Name:</b> ${escapeHtml(keyInfo.name || '-')}\n` +
                `<b>Rate Limit Bypass:</b> ${keyInfo.skipRateLimit ? '✅' : '❌'}\n\n` +
                `<b>Your API Key:</b>\n` +
                `<code>${rawKey}</code>`;

            await bot.sendMessage(chatId, msgText, {
                parse_mode: 'HTML',
                reply_markup: mainKeyboard
            });
            return;
        }

        // Toggle active/revoke
        if (data.startsWith('toggle_')) {
            const keyId = parseInt(data.split('_')[1]);
            await bot.answerCallbackQuery(query.id, { text: '⏳ Updating...' });

            // Fetch current status first
            const keys = await apiAdmin('GET', '/api/admin/keys');
            const key = keys.find(k => k.id === keyId);
            if (!key) {
                await bot.sendMessage(chatId, '❌ Key tidak ditemukan.', {
                    reply_markup: mainKeyboard
                });
                return;
            }

            const updated = await apiAdmin('PUT', `/api/admin/keys/${keyId}`, {
                isActive: !key.isActive
            });

            const status = updated.apiKey.isActive ? '✅ Activated' : '❌ Revoked';
            await bot.sendMessage(chatId,
                `🔑 Key <b>ID ${keyId}</b> → <b>${status}</b>`,
                { parse_mode: 'HTML', reply_markup: mainKeyboard }
            );
            return;
        }

        // Delete confirmation
        if (data.startsWith('delete_')) {
            const keyId = parseInt(data.split('_')[1]);
            await bot.answerCallbackQuery(query.id, { text: '⚠️ Konfirmasi diperlukan' });

            await bot.sendMessage(chatId,
                `⚠️ <b>Yakin hapus Key ID ${keyId}?</b>\n\nAksi ini tidak bisa dibatalkan!`,
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '🗑️ Ya, Hapus', callback_data: `confirm_delete_${keyId}` },
                                { text: '❌ Batal', callback_data: 'cancel_delete' }
                            ]
                        ]
                    }
                }
            );
            return;
        }

        // Confirm delete
        if (data.startsWith('confirm_delete_')) {
            const keyId = parseInt(data.split('_')[2]);
            await bot.answerCallbackQuery(query.id, { text: '⏳ Menghapus...' });

            await apiAdmin('DELETE', `/api/admin/keys/${keyId}`);
            await bot.sendMessage(chatId, `🗑️ Key <b>ID ${keyId}</b> telah dihapus.`, {
                parse_mode: 'HTML',
                reply_markup: mainKeyboard
            });
            return;
        }

        // Cancel delete
        if (data === 'cancel_delete') {
            await bot.answerCallbackQuery(query.id, { text: 'Dibatalkan' });
            await bot.sendMessage(chatId, '❌ Penghapusan dibatalkan.', {
                reply_markup: mainKeyboard
            });
            return;
        }
    } catch (err) {
        console.error('❌ Callback Error:', err);
        await bot.answerCallbackQuery(query.id, { text: '❌ Error!' });
        await bot.sendMessage(chatId, `❌ Error:\n<code>${escapeHtml(err.message)}</code>`, {
            parse_mode: 'HTML',
            reply_markup: mainKeyboard
        });
    }
});

// ───────────────────────────────────────────
// Bot Started
// ───────────────────────────────────────────
console.log(`🤖 Telegram Bot started for Owner ID: ${OWNER_USER_ID}`);
