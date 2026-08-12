# health-check

Health check registry with per-check timeout, critical vs. non-critical failures, and express-style handler. Runs checks concurrently, produces detailed report with latencies, and calculates overall status (healthy/degraded/unhealthy).

## Installation

```bash
npm install health-check
```

## Quick Start

```javascript
import { HealthCheckRegistry } from 'health-check';

const health = new HealthCheckRegistry();

// Register checks
health.register('database', async () => {
  await db.query('SELECT 1');
}, { timeoutMs: 3000, critical: true });

health.register('cache', async () => {
  await redis.ping();
}, { timeoutMs: 2000, critical: false });

// Get status
const report = await health.status();
console.log(report.status); // 'healthy', 'degraded', or 'unhealthy'

// Express-style handler
const handler = await health.handler();
console.log(handler.statusCode); // 200 or 503
```

## API

### `new HealthCheckRegistry(): HealthCheckRegistry`

Create a health check registry.

### `register(name, checkFn, config?): void`

Register a health check function.

```typescript
health.register('mysql', checkFn, {
  timeoutMs: 5000,  // Default
  critical: false   // Default
});
```

**Parameters:**
- `name` (string): Unique check identifier
- `checkFn` (() => Promise<void>): Async function that throws or completes normally
- `config` (CheckConfig, optional):
  - `timeoutMs` (number, default: 5000): Max time before check times out
  - `critical` (boolean, default: false): If true, this failure triggers unhealthy status

### `status(): Promise<HealthReport>`

Run all checks concurrently and return results.

```typescript
interface HealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string; // ISO string
  checks: Record<string, {
    result: 'ok' | 'failed' | 'timed_out';
    latencyMs: number;
    error?: string;
  }>;
}
```

**Status Logic:**
- `healthy`: All checks passed
- `degraded`: One or more non-critical checks failed
- `unhealthy`: Any critical check failed or timed out

### `handler(): Promise<{ statusCode: number; body: string }>`

Express-style handler for GET /health. Returns JSON response.

```typescript
const { statusCode, body } = await health.handler();
// statusCode: 200 if healthy, 503 if degraded or unhealthy
// body: JSON string of HealthReport
```

## Check Results

Each check result can be:
- `'ok'`: Check passed
- `'failed'`: Check threw an error
- `'timed_out'`: Check exceeded timeoutMs

## Examples

### Critical vs. Non-Critical

```javascript
const health = new HealthCheckRegistry();

// Database failure → unhealthy
health.register('database', checkDB, { critical: true });

// Cache miss → degraded (not unhealthy)
health.register('cache', checkCache, { critical: false });

const report = await health.status();
// If DB fails: status = 'unhealthy'
// If cache fails (DB ok): status = 'degraded'
// If both fail: status = 'unhealthy'
```

### Timeouts

```javascript
health.register('slow_api', async () => {
  await fetch('https://slow-service.example.com/health');
}, { timeoutMs: 1000 }); // Times out after 1 second

const report = await health.status();
// If slow, result: 'timed_out', error: 'timeout after 1000ms'
```

### Express Integration

```javascript
import express from 'express';
import { HealthCheckRegistry } from 'health-check';

const app = express();
const health = new HealthCheckRegistry();

health.register('database', async () => {
  await db.query('SELECT 1');
}, { critical: true });

app.get('/health', async (req, res) => {
  const { statusCode, body } = await health.handler();
  res.status(statusCode).type('application/json').send(body);
});

app.listen(3000);
```

### Concurrent Checks with Latency Tracking

```javascript
const health = new HealthCheckRegistry();

health.register('api_1', async () => {
  await fetch('https://api-1.example.com/health');
});

health.register('api_2', async () => {
  await fetch('https://api-2.example.com/health');
});

const report = await health.status();
console.log(report.checks);
// {
//   api_1: { result: 'ok', latencyMs: 42 },
//   api_2: { result: 'failed', latencyMs: 105, error: 'HTTP 500' }
// }
```

## Limits

- Checks must throw to signal failure; returning normally means success.
- No exponential backoff or retry per check; implement in the check function if needed.
- Handler always returns 200 or 503; no support for 503 with retry-after.
- No built-in metrics collection; latencies are reported but not aggregated.
- Checks run concurrently with `Promise.allSettled`; they do not block each other.

## License: MIT

Sponsored by [Ferrow](https://ferrow.ai)
