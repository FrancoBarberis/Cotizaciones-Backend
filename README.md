## About this project

Core API for a real-time currency exchange system built with Node.js, Express, and Socket.IO. Demonstrates backend development proficiency including API design, WebSocket communication, caching strategies, and TypeScript best practices.

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build & Production

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── server.ts              # HTTP server & Socket.IO bootstrap
├── rates.service.ts       # Exchange rate logic & caching
├── routes/
│   └── rates.routes.ts    # API endpoints
└── helpers/
    ├── config.ts          # Environment configuration
    └── types/
        └── exchange-rate.types.ts  # TypeScript interfaces
```

## Technologies

- **Node.js** with Express.js for HTTP server
- **Socket.IO** for real-time WebSocket communication
- **TypeScript** for type safety
- **Cors** for cross-origin requests
- **dotenv** for environment variables

## API Endpoints

### `GET /api/rates`
Returns all available exchange rates.

### `GET /api/rates/convert?from=USD&to=EUR&amount=10`
Converts an amount from one currency to another.

**Query Parameters:**
- `from` (string): Source currency code (ISO 4217)
- `to` (string): Target currency code (ISO 4217)
- `amount` (number): Amount to convert (default: 1)

### `GET /healthz`
Health check endpoint.

## Environment Variables

Create a `.env` file:

```env
PORT=3000
NODE_ENV=development
EXR_API_KEY=your_api_key_here
BASE_CURRENCY=USD
POLL_INTERVAL_MS=60000
CORS_ORIGIN=*
```

## WebSocket Events

- **`rates:get`** - Client requests latest rates
- **`rates:data`** - Server emits exchange rates
- **`rates:error`** - Server emits error message
- **`rates:init`** - Server emits initial rates on startup

## License

ISC