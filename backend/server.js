require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5050;

// ───────────────────────────────────────────
// CORS Whitelist
// ───────────────────────────────────────────
app.use(cors({
    origin: [
        'https://yourdomain.com', // change to your domain
        'http://localhost:3000'
    ]
}));

app.use(express.json({ limit: '10mb' }));

// ───────────────────────────────────────────
// Helpers: Key Hashing
// ───────────────────────────────────────────
function hashKey(rawKey) {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
}

function generateRawKey() {
    return crypto.randomBytes(32).toString('hex'); // 64 chars
}

// ───────────────────────────────────────────
// Middleware: Admin Authentication
// ───────────────────────────────────────────
function requireAdmin(req, res, next) {
    const incomingSecret = req.headers['x-admin-secret'];
    if (incomingSecret !== process.env.ADMIN_SECRET) {
        return res.status(401).json({ message: 'Unauthorized admin access' });
    }
    next();
}

// ───────────────────────────────────────────
// Middleware: API Key Authentication
// Attaches apiKey object to req for downstream use
// ───────────────────────────────────────────
async function requireApiKey(req, res, next) {
    const apiKeyHeader = req.headers['x-api-key'];
    if (!apiKeyHeader) {
        return res.status(401).json({ message: 'API Key is required' });
    }

    const keyHash = hashKey(apiKeyHeader);
    const apiKey = await prisma.apiKey.findUnique({
        where: { keyHash }
    });

    if (!apiKey) {
        return res.status(401).json({ message: 'Invalid API Key' });
    }

    if (!apiKey.isActive) {
        return res.status(403).json({ message: 'API Key has been revoked' });
    }

    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
        return res.status(403).json({ message: 'API Key has expired' });
    }

    // Update last used timestamp (fire-and-forget)
    prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() }
    }).catch(() => { });

    req.apiKey = apiKey;
    next();
}

// ───────────────────────────────────────────
// Rate Limiters
// ───────────────────────────────────────────

// Public API: 50 req/sec per IP
const publicRateLimiter = rateLimit({
    windowMs: 1000, // 1 second
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.apiKey?.skipRateLimit === true,
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many requests. Slow down.' });
    }
});

// Admin API: 10 req/sec per IP
const adminRateLimiter = rateLimit({
    windowMs: 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many admin requests. Slow down.' });
    }
});

// ───────────────────────────────────────────
// Webhook: Receive Email (Cloudflare Worker)
// ───────────────────────────────────────────
app.post('/webhook/email', async (req, res) => {
    const incomingSecret = req.headers['x-webhook-secret'];
    if (incomingSecret !== process.env.WEBHOOK_SECRET) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const { from, subject, text, html, to, timestamp } = req.body;

    try {
        const savedEmail = await prisma.email.create({
            data: {
                fromAddress: from || "Unknown",
                subject: subject || "(No Subject)",
                bodyHtml: html || "",
                bodyText: text || "",
                recipient: to || "Unknown",
                receivedAt: timestamp ? new Date(timestamp) : new Date()
            }
        });
        console.log(`✅ Email Disimpan: ${savedEmail.subject}`);
        res.status(200).json({ message: 'Saved', id: savedEmail.id });
    } catch (error) {
        console.error('❌ Database Error:', error);
        res.status(500).json({ message: 'Error saving to database' });
    }
});

// ───────────────────────────────────────────
// Public API: Read Emails (Protected by API Key + Rate Limit)
// ───────────────────────────────────────────
app.get('/api/emails', requireApiKey, publicRateLimiter, async (req, res) => {
    const { recipient } = req.query;
    try {
        const where = recipient ? { recipient } : {};
        const emails = await prisma.email.findMany({
            where,
            orderBy: { receivedAt: 'desc' },
            take: 50
        });
        res.json(emails);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching emails' });
    }
});

app.get('/api/emails/:id', requireApiKey, publicRateLimiter, async (req, res) => {
    const emailId = parseInt(req.params.id);
    if (isNaN(emailId)) return res.status(400).json({ message: 'Invalid ID' });

    try {
        const email = await prisma.email.findUnique({ where: { id: emailId } });
        if (!email) return res.status(404).json({ message: 'Not found' });
        res.json(email);
    } catch (error) {
        res.status(500).json({ message: 'Error' });
    }
});

// ───────────────────────────────────────────
// Admin API: Manage API Keys (Protected by Admin Secret + Rate Limit)
// ───────────────────────────────────────────

// List all API keys
app.get('/api/admin/keys', requireAdmin, adminRateLimiter, async (req, res) => {
    try {
        const keys = await prisma.apiKey.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(keys);
    } catch (error) {
        console.error('❌ Admin Error:', error);
        res.status(500).json({ message: 'Error fetching API keys' });
    }
});

// Generate new API key
app.post('/api/admin/keys', requireAdmin, adminRateLimiter, async (req, res) => {
    const { name, description, expiresAt, skipRateLimit } = req.body;

    const rawKey = generateRawKey();
    const keyHash = hashKey(rawKey);

    try {
        const newKey = await prisma.apiKey.create({
            data: {
                keyHash,
                name: name || null,
                description: description || null,
                skipRateLimit: skipRateLimit === true,
                expiresAt: expiresAt ? new Date(expiresAt) : null
            }
        });

        res.status(201).json({
            message: 'API Key created successfully',
            apiKey: newKey,
            // Return raw key only once at creation
            rawKey: rawKey
        });
    } catch (error) {
        console.error('❌ Admin Error:', error);
        res.status(500).json({ message: 'Error creating API key' });
    }
});

// Update API key (revoke, rename, change expiry, rate limit bypass)
app.put('/api/admin/keys/:id', requireAdmin, adminRateLimiter, async (req, res) => {
    const keyId = parseInt(req.params.id);
    if (isNaN(keyId)) return res.status(400).json({ message: 'Invalid ID' });

    const { name, description, isActive, expiresAt, skipRateLimit } = req.body;

    try {
        const updated = await prisma.apiKey.update({
            where: { id: keyId },
            data: {
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(isActive !== undefined && { isActive }),
                ...(skipRateLimit !== undefined && { skipRateLimit: skipRateLimit === true }),
                ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null })
            }
        });
        res.json({ message: 'API Key updated', apiKey: updated });
    } catch (error) {
        console.error('❌ Admin Error:', error);
        res.status(500).json({ message: 'Error updating API key' });
    }
});

// Delete API key permanently
app.delete('/api/admin/keys/:id', requireAdmin, adminRateLimiter, async (req, res) => {
    const keyId = parseInt(req.params.id);
    if (isNaN(keyId)) return res.status(400).json({ message: 'Invalid ID' });

    try {
        await prisma.apiKey.delete({ where: { id: keyId } });
        res.json({ message: 'API Key deleted' });
    } catch (error) {
        console.error('❌ Admin Error:', error);
        res.status(500).json({ message: 'Error deleting API key' });
    }
});

// ───────────────────────────────────────────
// Cleanup: Auto-delete old emails (Internal cron)
// ───────────────────────────────────────────
app.delete('/api/emails/cleanup', async (req, res) => {
    const incomingSecret = req.headers['x-webhook-secret'];
    if (incomingSecret !== process.env.WEBHOOK_SECRET) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 jam
    try {
        const deleted = await prisma.email.deleteMany({
            where: { receivedAt: { lt: cutoff } }
        });
        console.log(`🗑️ Cleanup: ${deleted.count} emails deleted`);
        res.json({ deleted: deleted.count });
    } catch (error) {
        console.error('❌ Cleanup Error:', error);
        res.status(500).json({ message: 'Cleanup failed' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Backend Email siap di port ${PORT}`);
});
