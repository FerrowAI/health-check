# Health Check

Monitor service health. Critical for Ferrow fleet reliability.

```javascript
const health = new HealthCheck();
health.register('db', checkDB);
health.register('cache', checkCache);
```

## Features
- ✓ Dependency health tracking
- ✓ Cascading failure detection
- ✓ Status endpoints
- ✓ Ferrow agent diagnostics

## License: MIT
