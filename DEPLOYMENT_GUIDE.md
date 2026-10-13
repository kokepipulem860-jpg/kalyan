# 🚀 Kalyan 777 - Render Deployment Guide

This folder (`render-deployment`) contains the production-ready standalone build of **Kalyan 777**. It is structured to deploy to [Render](https://render.com) as a Node.js Web Service with WebSockets, PWA capabilities, and an admin panel.

---

## 📁 Package Contents

```text
render-deployment/
├── data/
│   └── database.json          # Seeded persistent database (users, markets, rates, admins)
├── public/
│   ├── admin/                 # Executive Admin Control Center (/admin/)
│   ├── agent/                 # Agent & Khaiwal Portal (/agent/)
│   └── app/                   # Mobile Player Web App (/)
├── server/
│   ├── db/                    # Atomic file-backed database engine
│   ├── routes/                # REST API endpoints (auth, bids, wallet, markets, etc.)
│   ├── services/              # WebSockets, IST scheduler, cutting/lay-off engine
│   └── index.js               # Central Express & WebSocket application server
├── .env.example               # Example environment variable reference
├── .gitignore                 # Excludes node_modules, logs, and OS files
├── package.json               # Dependencies (express, ws, cors) and npm start script
├── package-lock.json          # Dependency lockfile
├── render.yaml                # Render Blueprint infrastructure-as-code spec
├── server.js                  # Root server entrypoint
└── DEPLOYMENT_GUIDE.md        # This step-by-step deployment guide
```

---

## 🛠️ Step-by-Step Deployment on Render

### Step 1: Push to a GitHub Repository

1. Open your terminal in this `render-deployment` folder (or copy its contents into your target git directory):
   ```bash
   cd render-deployment
   git init
   git add .
   git commit -m "Initial production release of Kalyan 777"
   ```

2. Create a new repository on [GitHub](https://github.com/new) (e.g. `kalyan-777-web`).

3. Link and push your code:
   ```bash
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/kalyan-777-web.git
   git push -u origin main
   ```

---

### Step 2: Create a Web Service on Render

1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click the blue **New +** button in the top navigation bar and select **Web Service**.
3. Under **Connect a repository**, find your `kalyan-777-web` repo and click **Connect**.

---

### Step 3: Configure Service Settings

Fill in the configuration fields on Render:

| Setting | Value / Recommended | Notes |
| :--- | :--- | :--- |
| **Name** | `kalyan-777` | Becomes your subdomain: `https://kalyan-777.onrender.com` |
| **Region** | `Singapore (Southeast Asia)` or `Frankfurt` | Pick the region geographically closest to your users |
| **Branch** | `main` | Default deployment branch |
| **Root Directory** | *(leave blank)* | Leave empty if repository root contains `package.json` |
| **Runtime** | `Node` | Render automatically uses Node.js 18+ |
| **Build Command** | `npm install` | Installs `express`, `cors`, and `ws` |
| **Start Command** | `npm start` | Executes `node server/index.js` |
| **Instance Type** | `Free` (or `Starter`) | Free tier is great for testing; Starter ($7/mo) stays online 24/7 without idle sleep |

---

### Step 4: Configure Advanced Settings

Click on **Advanced** at the bottom of the form:

1. **Health Check Path**:
   - Set to: `/api/health`
   - *Why*: Render queries this endpoint every few seconds to ensure zero downtime and verify deployment health.

2. **Environment Variables**:
   Click **Add Environment Variable**:
   - `NODE_ENV` = `production`
   - *(Note: Render automatically injects `PORT=10000`. The server code already reads `process.env.PORT` automatically).*

3. **Auto-Deploy**:
   - Keep set to **Yes** so any future code changes pushed to `main` automatically deploy.

---

### Step 5: Deploy the Service

1. Click **Create Web Service**.
2. Render will spin up a build container and execute:
   ```text
   ==> Running build command 'npm install'...
   ==> Uploading build...
   ==> Starting service with 'npm start'...
   ==> ⚡ KALYAN 777 FULL-STACK SERVER WITH WEBSOCKETS RUNNING
   ==> 📱 Player Mobile App:  http://localhost:10000/
   ==> 💻 Admin Control Panel: http://localhost:10000/admin/
   ==> 🚀 REST API Service:    http://localhost:10000/api/
   ==> Your service is live 🎉
   ```

---

## 🌐 Live Portal Endpoints

Once deployed, your service URL will be `https://<YOUR_APP_NAME>.onrender.com`:

| Portal | URL Path | Description |
| :--- | :--- | :--- |
| 📱 **Player Mobile App** | `https://<YOUR_APP_NAME>.onrender.com/` | Full luxury ivory/gold PWA with real-time timers, betting slips, and profile |
| 💻 **Executive Admin Panel** | `https://<YOUR_APP_NAME>.onrender.com/admin/` | Result declaration, live bazaar controls, user ledger, UTR verification |
| 🤝 **Agent / Khaiwal Portal** | `https://<YOUR_APP_NAME>.onrender.com/agent/` | Sub-agent commission and client bid entry |
| 🩺 **System Health Check** | `https://<YOUR_APP_NAME>.onrender.com/api/health` | Live JSON health check and WebSocket ping status |

---

## 🔑 Default Credentials for Testing

### 1. Super Admin (Full Control)
- **URL**: `/admin/`
- **Username**: `superadmin`
- **Password**: `admin123`

### 2. Sub-Admin (Operator)
- **URL**: `/admin/`
- **Username**: `admin`
- **Password**: `admin123`

### 3. Agent / Khaiwal
- **URL**: `/agent/`
- **Phone**: `9876543210`
- **MPIN**: `5566`

### 4. Player Account
- **URL**: `/`
- **Phone**: `9820145890` (Ramesh Patel)
- **MPIN**: `1234` (or any OTP)

---

## 💡 Pro-Tips for Render Hosting

1. **Free Tier Inactivity Sleep**:
   - On Render's Free tier, services spin down after 15 minutes of inactivity and take ~30 seconds to wake up on the next request.
   - To keep it active 24/7 for live bazaars, either upgrade to the **Starter** plan ($7/month) or use a free uptime monitoring service like [UptimeRobot](https://uptimerobot.com) to ping `https://<YOUR_APP_NAME>.onrender.com/api/health` every 5 minutes.

2. **Database Persistence on Free Tier**:
   - The application stores data in `data/database.json`.
   - On Render Free tier, the filesystem is ephemeral (resets to initial seed if the server restarts).
   - If you want edits to persist across arbitrary restarts, you can attach a Render **Disk** (available on paid plans) mounted at `/data`, or connect MongoDB/PostgreSQL in a future iteration.

3. **Custom Domain with Free SSL**:
   - In Render Dashboard under **Settings** -> **Custom Domains**, add your domain (e.g. `play.kalyan777.com`).
   - Add the CNAME record indicated by Render in your DNS manager (Cloudflare, GoDaddy, Namecheap). Render automatically provisions and renews a free Let's Encrypt SSL certificate.
