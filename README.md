# Jocasta - AI-Powered Scheduling Assistant

Jocasta is an iOS-first + Web mobile-first scheduling assistant that uses AI to help you manage your calendar efficiently. It syncs bi-directionally with Google Calendar, considers travel time and weather conditions, and sends intelligent notifications via Telegram.

## Features

- **Natural Language Input**: Add events by typing "Pick up groceries at Costco tomorrow" and get smart scheduling proposals
- **Travel-Aware Scheduling**: Automatically calculates travel time between events, considering traffic and weather
- **Google Calendar Sync**: Bi-directional sync without duplicates - your calendar stays in sync
- **Smart Notifications**: Telegram notifications with inline action buttons (Accept, Snooze, Reschedule)
- **Weather Impact**: Calgary-specific weather rules for motorcycle/transit travel adjustments
- **Multi-Mode Transport**: Support for sedan, motorcycle, taxi, and transit
- **Conflict Detection**: Smart conflict resolution with priority-based reordering

## Tech Stack

- **Frontend**: Expo (React Native) + Expo Router + Tamagui
- **Backend**: NestJS + Prisma + PostgreSQL
- **Integrations**: Google Calendar API, Google Maps/Directions API, Telegram Bot API, Open-Meteo Weather
- **AI**: OpenAI GPT-4o-mini for natural language extraction (server-side only)

## Project Structure

```
jocasta/
├── apps/
│   ├── client/          # Expo mobile + web app
│   │   ├── app/         # Expo Router screens
│   │   └── src/         # Components, hooks, services, stores
│   └── server/          # NestJS backend
│       ├── prisma/      # Database schema and migrations
│       └── src/         # API modules
├── packages/
│   └── shared/          # Shared types, schemas, utilities
├── docker-compose.yml   # Local development database
└── scripts/             # Helper scripts
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose
- iOS Simulator (macOS) or Expo Go app
- Google Cloud Console project with OAuth and Calendar API enabled
- Telegram Bot (optional, for notifications)

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/jocasta.git
cd jocasta
pnpm install
```

### 2. Start Database

```bash
docker compose up -d
```

### 3. Configure Environment

```bash
# Server
cp apps/server/.env.example apps/server/.env
# Edit apps/server/.env with your credentials
```

**Required environment variables:**

```env
# Database
DATABASE_URL="postgresql://jocasta:jocasta_dev_password@localhost:5432/jocasta"

# JWT (generate with: openssl rand -base64 32)
JWT_SECRET=your-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here
ENCRYPTION_KEY=your-32-byte-encryption-key

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/v1/auth/google/callback

# Optional: Google Maps for accurate directions
GOOGLE_MAPS_API_KEY=your-maps-api-key

# Optional: Telegram Bot
TELEGRAM_BOT_TOKEN=your-bot-token

# Optional: OpenAI for AI extraction (falls back to deterministic parser)
OPENAI_API_KEY=your-openai-api-key
```

### 4. Setup Database

```bash
# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Seed with Calgary defaults
pnpm db:seed
```

### 5. Start Development

```bash
# Terminal 1: Start backend
cd apps/server
pnpm dev

# Terminal 2: Start client
cd apps/client
pnpm dev
```

### 6. Open the App

- **iOS**: Scan QR code with Camera app, opens in Expo Go
- **Web**: Open http://localhost:8081
- **API Docs**: http://localhost:3001/api/docs

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable **Google Calendar API**
4. Go to **APIs & Services > Credentials**
5. Create **OAuth 2.0 Client ID**:
   - Application type: Web application
   - Authorized redirect URIs:
     - `http://localhost:3001/api/v1/auth/google/callback` (development)
6. Copy Client ID and Client Secret to your `.env` file

## Telegram Bot Setup

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow prompts
3. Copy the bot token to `TELEGRAM_BOT_TOKEN` in `.env`
4. Set webhook (production):
   ```bash
   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain.com/api/v1/integrations/telegram/webhook"
   ```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/google/start` | GET | Start Google OAuth |
| `/me` | GET/PUT | User profile |
| `/events` | GET/POST | List/create events |
| `/events/:id` | GET/PUT/DELETE | Event CRUD |
| `/tasks` | GET/POST | List/create tasks |
| `/planner/propose` | POST | Get scheduling proposals |
| `/planner/commit` | POST | Accept a proposal |
| `/integrations/google/sync` | POST | Trigger calendar sync |
| `/integrations/telegram/connect` | GET | Get Telegram connection info |
| `/settings` | GET/PUT | User settings |
| `/health` | GET | Health check |

## Architecture

### Domain Entities

- **User**: Account with Google OAuth tokens
- **Event**: Calendar entry (managed or external from Google)
- **Task**: To-be-scheduled item with deadline and window
- **Location**: Geocoded place with coordinates
- **Constraint**: Scheduling rules (sleep, work, quiet hours)
- **TravelSegment**: Calculated travel between events
- **NotificationJob**: Queued notification for delivery

### Planner Core

The scheduler is deterministic (no AI) and considers:

1. Existing events and their buffers
2. User constraints (sleep, work, quiet hours)
3. Travel time between locations
4. Event priority (1=high, 3=low)
5. Weather impact on travel time

AI is used **only** for extracting structured data from natural language input.

### Caching Strategy

- **In-memory LRU**: Fast local cache for frequently accessed data
- **PostgreSQL tables**: Persistent cache for directions, weather, geocoding
- **TTLs**: Directions 1hr, Weather 1hr, Geocoding 7 days

### Fallback Logic

| Service | Fallback |
|---------|----------|
| Directions API | Heuristic ETA based on distance bands |
| Weather API | Continue without weather adjustments |
| Telegram | Queue and retry with exponential backoff |
| Google Sync | Queue for retry, show warning badge |

## Testing

```bash
# Run all tests
pnpm test

# Run server tests
cd apps/server && pnpm test

# Run with coverage
cd apps/server && pnpm test:cov
```

## Troubleshooting

### "OAuth redirect_uri_mismatch"

Ensure your `GOOGLE_REDIRECT_URI` exactly matches what's configured in Google Cloud Console.

### "Cannot connect to database"

Check Docker is running:
```bash
docker compose ps
docker compose logs postgres
```

### "Telegram webhook not receiving"

For local development, use ngrok:
```bash
ngrok http 3001
# Update webhook URL with ngrok URL
```

### "Events not syncing"

Check Google Calendar API is enabled and OAuth scopes include calendar access:
```bash
curl http://localhost:3001/api/v1/integrations/google/status \
  -H "Authorization: Bearer <token>"
```

## Production Deployment

### Option 1: Railway (Recommended)

Railway provides easy deployment with managed PostgreSQL.

1. **Create Railway Project**
   - Go to [railway.app](https://railway.app)
   - Create new project from GitHub repo
   - Add PostgreSQL database

2. **Configure Environment Variables**
   Add all variables from `.env.example` in Railway dashboard.

3. **Deploy**
   ```bash
   # Railway will auto-detect Dockerfile
   # Or use railway.json configuration
   railway up
   ```

### Option 2: Fly.io

1. **Install Fly CLI**
   ```bash
   brew install flyctl
   flyctl auth login
   ```

2. **Launch App**
   ```bash
   cd apps/server
   flyctl launch --config fly.toml
   ```

3. **Set Secrets**
   ```bash
   flyctl secrets set DATABASE_URL="..." JWT_SECRET="..." --app jocasta-api
   ```

4. **Add PostgreSQL**
   ```bash
   flyctl postgres create --name jocasta-db
   flyctl postgres attach jocasta-db --app jocasta-api
   ```

### Option 3: Docker Compose (Self-hosted)

```bash
# Copy environment file
cp .env.example .env.prod
# Edit .env.prod with production values

# Build and run
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

### Database Migrations

Migrations run automatically on container start. For manual control:

```bash
# Run migrations
cd apps/server && npx prisma migrate deploy

# Generate client
cd apps/server && npx prisma generate
```

### Environment Variables

Set all `.env` variables as environment variables/secrets in your deployment platform:

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Random 32-byte secret
- `JWT_REFRESH_SECRET` - Another random 32-byte secret
- `ENCRYPTION_KEY` - 32-byte key for token encryption

**Optional (graceful degradation if missing):**
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Google OAuth
- `GOOGLE_MAPS_API_KEY` - Directions (falls back to heuristics)
- `TELEGRAM_BOT_TOKEN` - Notifications
- `OPENAI_API_KEY` - AI extraction (falls back to deterministic parser)

### CI/CD

GitHub Actions workflow at `.github/workflows/ci.yml`:
- Runs lint and tests on PR
- Builds on merge to main
- Auto-deploys to Railway/Fly.io (configure secrets in GitHub)

**Required GitHub Secrets:**
- `RAILWAY_TOKEN` - For Railway deployment
- `FLY_API_TOKEN` - For Fly.io deployment

### Build

```bash
# Build all packages
pnpm build

# Build server only
pnpm build --filter=@jocasta/server

# Build web client
cd apps/client && pnpm build:web
```

### Upgrade Path: BullMQ

The current MVP uses PostgreSQL-backed job queue. For production scale:

1. Add Redis
2. Install `@nestjs/bullmq` and `bullmq`
3. Migrate job processors to BullMQ workers
4. Update job creation to use BullMQ queues

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
