# TempMail - Disposable Email Platform

<p align="center">
  <b>TempMail</b> is a self-hosted disposable <i>Read-Only</i> email platform built with <b>Cloudflare Workers</b>, <b>Node.js</b>, and <b>Next.js</b>.
  <br/>
  Receive emails in real-time, manage access via API keys, and deploy anywhere.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Cloudflare-F38020?style=for-the-badge&logo=Cloudflare&logoColor=white" alt="Cloudflare" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
</p>

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup Guide](#setup-guide)
  - [1. Cloudflare Workers (Email Receiver)](#1-cloudflare-workers-email-receiver)
  - [2. Backend VPS (aaPanel)](#2-backend-vps-aapanel)
  - [3. Frontend](#3-frontend)
  - [4. API Manager Bot (Optional)](#4-api-manager-bot-optional)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
  - [Authentication](#authentication)
  - [Public Endpoints](#public-endpoints)
  - [Admin Endpoints](#admin-endpoints)
  - [Webhook Endpoints](#webhook-endpoints)
- [Database Schema](#database-schema)
- [Security](#security)
- [License](#license)

---

## Overview

TempMail rcaptures incoming emails via **Cloudflare Email Routing**, parses them using `postal-mime`, and forwards structured data to a backend VPS. The backend stores emails in **PostgreSQL** and serves them through a protected REST API. The **Next.js** frontend consumes this API to display a real-time disposable inbox.

---

## Architecture

```
┌─────────────────┐      Email Stream       ┌──────────────────┐
│  Cloudflare     │ ───────────────────────>│  Cloudflare      │
│  Email Routing  │   (Raw MIME)            │  Worker          │
└─────────────────┘                         └────────┬─────────┘
                                                     │ Parse (postal-mime)
                                                     │ JSON Payload
                                                     ▼
                                            ┌──────────────────┐
                                            │  Backend VPS     │
                                            │  (Node.js/Express│
                                            │   + Prisma/PSQL) │
                                            └────────┬─────────┘
                                                     │ REST API
                                                     ▼
                                            ┌──────────────────┐
                                            │  Next.js Frontend│
                                            │  (User Inbox UI) │
                                            └──────────────────┘
                                                     ▲
                                                     │ Manage Keys
                                            ┌────────┴─────────┐
                                            │ Telegram Bot     │
                                            │ (API Manager)    │
                                            └──────────────────┘
```

---

## Features

### Core
- **Disposable Inbox** — Generate random or custom email addresses on the fly.
- **Real-time Email Reception** — Cloudflare Workers process emails instantly.
- **HTML & Text Support** — View both plain text and rich HTML email bodies.
- **Auto-cleanup** — Emails older than 24 hours are automatically purged.

### Security
- **API Key Authentication** — SHA-256 hashed keys with expiration and revocation.
- **Admin Secret Protection** — Admin endpoints require a separate secret.
- **Webhook Secret** — Cloudflare → Backend communication is signed.
- **Rate Limiting** — Public API limited to 50 req/sec; Admin API to 10 req/sec.
- **CORS Whitelist** — Restricts frontend access to approved origins.

### Management
- **Telegram Bot** — Create, revoke, and monitor API keys entirely from Telegram.
- **Key Metadata** — Assign names, descriptions, and rate-limit bypass flags per key.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Email Gateway** | Cloudflare Workers + `postal-mime` |
| **Backend** | Node.js, Express, Prisma ORM |
| **Database** | PostgreSQL |
| **Frontend** | Next.js 15, React 19, Tailwind CSS 4, SWR |
| **API Manager** | Telegram Bot (`node-telegram-bot-api`) |

---

## Project Structure

```
TempMail/
├── cloudflare-workers/      # Cloudflare Worker (Email receiver)
│   ├── index.js
│   └── wrangler.toml
├── backend/                   # VPS Backend (API + Webhook)
│   ├── server.js
│   ├── prisma/
│   │   └── schema.prisma
│   ├── prisma.config.ts
│   ├── package.json
│   └── .env.example
├── frontend/                  # Next.js Frontend
│   ├── app/
│   ├── lib/
│   ├── next.config.ts
│   ├── package.json
│   └── .env.example
├── api-manager-bot/           # Telegram Bot (Admin only)
│   ├── telegram-bot.js
│   ├── package.json
│   └── .env
└── README.md
```

---

## Prerequisites

Before you begin, ensure you have the following:

- [Cloudflare Account](https://dash.cloudflare.com/) with a domain configured for **Email Routing**
- [aaPanel](https://www.aapanel.com/) installed on your VPS (or any Node.js hosting)
- [PostgreSQL](https://www.postgresql.org/) database (can be created via aaPanel)
- [Node.js](https://nodejs.org/) >= 18
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm install -g wrangler`)
- [Telegram Bot Token](https://t.me/BotFather) (optional, for API Manager Bot)

---

## Setup Guide

### 1. Cloudflare Workers (Email Receiver)

The Cloudflare Worker intercepts incoming emails, parses them, and forwards structured JSON to your backend.

#### a. Configure `wrangler.toml`

```toml
name = "tempmail-worker"
main = "index.js"
compatibility_date = "2024-05-01"

[vars]
VPS_URL = "https://your-vps.com/webhook/email"
```

#### b. Set Secrets

```bash
cd cloudflare-workers
wrangler secret put WEBHOOK_SECRET
# Enter a strong random string (e.g., openssl rand -hex 32)
```

#### c. Deploy

```bash
wrangler deploy
```

#### d. Configure Email Routing (Cloudflare Dashboard)

1. Go to **Email > Email Routing > Routes**.
2. Create a catch-all route `*@yourdomain.com`.
3. Set the action to **Send to a Worker** and select your deployed worker.

> **Note:** Update `env.VPS_URL` in `index.js` or `wrangler.toml` to point to your backend webhook URL.

---

### 2. Backend VPS (aaPanel)

The backend handles webhook ingestion, persists emails, and exposes the REST API.

#### a. Create Node.js Website in aaPanel

1. Open aaPanel → **Website** → **Add Site**.
2. Choose **Node.js Project**.
3. Set:
   - **Domain:** `your-api-domain.com` (or use IP + port with reverse proxy)
   - **Project Path:** `/www/wwwroot/tempmail-backend`
   - **Startup File:** `server.js`
   - **Port:** `5050`
4. Upload or clone the `backend/` folder into the project path.

#### b. Install Dependencies

```bash
cd /www/wwwroot/tempmail-backend
npm install
```

#### c. Configure Environment

```bash
cp .env.example .env
nano .env
```

Fill in:

```env
WEBHOOK_SECRET=your_webhook_secret      # Must match Cloudflare Worker secret
ADMIN_SECRET=your_admin_secret          # For admin endpoints
DATABASE_URL=postgresql://user:pass@localhost:5432/tempmail
```

#### d. Run Prisma Migrations

```bash
npx prisma migrate dev --name init
npx prisma generate
```

#### e. Start the Server

In aaPanel, click **Start** on your Node.js project. The server runs on the configured port.

> **Tip:** Enable **SSL** in aaPanel and configure a reverse proxy (Nginx) for production.

#### f. (Optional) Setup Auto-cleanup Cron

Create a cron job in aaPanel to call the cleanup endpoint daily:

```bash
curl -X DELETE https://your-api-domain.com/api/emails/cleanup \
  -H "X-Webhook-Secret: your_webhook_secret"
```

---

### 3. Frontend

The Next.js frontend provides the user-facing disposable inbox UI.

#### a. Configure Environment

```bash
cd frontend
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-api-domain.com
NEXT_PUBLIC_API_KEY=your_public_api_key
```

#### b. Install & Build

```bash
npm install
npm run build
```

> **CORS:** Ensure your backend `CORS` origin whitelist includes your frontend domain.

---

### 4. API Manager Bot (Optional)

A Telegram bot for the owner to manage API keys without touching the backend directly.

#### a. Configure `.env`

```bash
cd api-manager-bot
cp .env.example .env  # Create from example if available
```

```env
BOT_TOKEN=your_telegram_bot_token
OWNER_USER_ID=your_telegram_user_id
ADMIN_SECRET=your_admin_secret        # Same as backend
BACKEND_URL=https://your-api-domain.com
```

#### b. Run the Bot

```bash
npm install
node telegram-bot.js
```

> **Note:** Only the `OWNER_USER_ID` can interact with this bot. Use `@userinfobot` on Telegram to find your user ID.

---

## Environment Variables

### Cloudflare Worker

| Variable | Description |
|----------|-------------|
| `VPS_URL` | Full URL to backend webhook endpoint (`/webhook/email`) |
| `WEBHOOK_SECRET` | Shared secret to authenticate webhook requests |

### Backend

| Variable | Description |
|----------|-------------|
| `WEBHOOK_SECRET` | Must match the Cloudflare Worker secret |
| `ADMIN_SECRET` | Secret token for admin API endpoints |
| `DATABASE_URL` | PostgreSQL connection string |

### Frontend

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | Base URL of the backend API |
| `NEXT_PUBLIC_API_KEY` | Valid API key for public endpoints |

### API Manager Bot

| Variable | Description |
|----------|-------------|
| `BOT_TOKEN` | Telegram Bot token from @BotFather |
| `OWNER_USER_ID` | Telegram numeric ID of the bot owner |
| `ADMIN_SECRET` | Same secret used in backend |
| `BACKEND_URL` | Backend base URL |

---

## API Documentation

### Authentication

| Header | Context | Description |
|--------|---------|-------------|
| `X-Api-Key` | Public API | Required for all public endpoints |
| `X-Admin-Secret` | Admin API | Required for all admin endpoints |
| `X-Webhook-Secret` | Webhook | Required for Cloudflare and cleanup endpoints |

### Public Endpoints

#### List Emails
```http
GET /api/emails?recipient=user@example.com
```

Returns the latest 50 emails. Optionally filter by `recipient`.

#### Get Single Email
```http
GET /api/emails/:id
```

Returns a specific email by ID.

### Admin Endpoints

#### List API Keys
```http
GET /api/admin/keys
```

Returns all API keys with metadata.

#### Create API Key
```http
POST /api/admin/keys
Content-Type: application/json

{
  "name": "Production Key",
  "description": "Main frontend key",
  "expiresAt": "2025-12-31T23:59:59Z",
  "skipRateLimit": false
}
```

**Response:** Returns the `rawKey` **only once** at creation. Store it securely.

#### Update API Key
```http
PUT /api/admin/keys/:id
Content-Type: application/json

{
  "isActive": false,
  "name": "Revoked Key"
}
```

#### Delete API Key
```http
DELETE /api/admin/keys/:id
```

### Webhook Endpoints

#### Receive Email (Cloudflare Worker)
```http
POST /webhook/email
Content-Type: application/json
X-Webhook-Secret: <secret>

{
  "from": "sender@example.com",
  "from_name": "Sender Name",
  "to": "recipient@yourdomain.com",
  "subject": "Hello",
  "text": "Plain text body",
  "html": "<h1>HTML body</h1>",
  "date": "2024-05-01T12:00:00Z",
  "timestamp": "2024-05-01T12:00:05Z"
}
```

#### Cleanup Old Emails
```http
DELETE /api/emails/cleanup
X-Webhook-Secret: <secret>
```

Deletes emails older than 24 hours. Returns `{ "deleted": <count> }`.

---

## Database Schema

### `Email`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `Int` (PK) | Auto-increment ID |
| `fromAddress` | `String` | Sender email address |
| `subject` | `String?` | Email subject |
| `bodyHtml` | `String?` | HTML body content |
| `bodyText` | `String?` | Plain text body |
| `recipient` | `String` | Recipient address |
| `receivedAt` | `DateTime` | Timestamp of receipt |

### `ApiKey`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `Int` (PK) | Auto-increment ID |
| `keyHash` | `String` (Unique) | SHA-256 hash of the raw key |
| `name` | `String?` | Display name |
| `description` | `String?` | Optional description |
| `isActive` | `Boolean` | Active or revoked |
| `skipRateLimit` | `Boolean` | Bypass rate limits |
| `expiresAt` | `DateTime?` | Expiration date |
| `createdAt` | `DateTime` | Creation timestamp |
| `lastUsedAt` | `DateTime?` | Last usage timestamp |

---

<p align="center">
  This project is for learning purpose and personal use only.</b>
</p>
