# Local Development Setup

Quick guide to run the Sales Pitch Practice Platform locally.

## Prerequisites

- Node.js 18+ installed
- npm installed
- Cloudflare account (for Workers AI - free tier works)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
cd code
npm install
```

### 2. Build Frontend

```bash
npm run build:frontend
```

This creates the `dist` folder with your React app.

### 3. Run Database Migrations (Local)

```bash
npx wrangler d1 migrations apply ming-db --local
```

This creates all necessary tables in your local SQLite database.

### 4. Start Development Server

**Option A: Local mode (no AI features)**
```bash
npm run dev
```
- Uses local D1 database
- Uses local KV store
- **AI features won't work** (Workers AI requires remote mode)

**Option B: Remote mode (with AI features)**
```bash
npm run dev:remote
```
- Uses local D1 database
- Uses local KV store  
- **AI features work** (connects to Cloudflare Workers AI)

### 5. Access the App

- **Frontend**: http://localhost:8787
- **API**: http://localhost:8787/api/health

## Troubleshooting

### "dist folder does not exist" error
```bash
npm run build:frontend
```

### "no such table" errors
```bash
npx wrangler d1 migrations apply ming-db --local
```

### AI features not working
Use `npm run dev:remote` instead of `npm run dev`

### Port already in use
Kill the process using port 8787:
```bash
lsof -ti:8787 | xargs kill -9
```

## Development Workflow

1. Make code changes
2. Frontend changes: Rebuild with `npm run build:frontend` (or use `npm run dev:frontend` in a separate terminal for hot reload)
3. Backend changes: Wrangler auto-reloads on save
4. Test at http://localhost:8787

## Separate Frontend Dev Server (Optional)

For faster frontend development with hot reload:

**Terminal 1** (Backend):
```bash
npm run dev:remote
```

**Terminal 2** (Frontend):
```bash
npm run dev:frontend
```

Then access frontend at http://localhost:5173 (it proxies API requests to backend on 8787)

