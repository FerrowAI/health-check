const { HealthCheckRegistry } = require('../dist/index.js');

(async () => {
  const health = new HealthCheckRegistry();

  // Pass
  health.register('db', async () => {}, { critical: true });
  // Fail (non-critical)
  health.register('cache', async () => { throw new Error('Connection refused'); });
  // Timeout
  health.register('slow_api', async () => {
    await new Promise(r => setTimeout(r, 3000));
  }, { timeoutMs: 500 });

  const report = await health.status();
  console.log('Status:', report.status); // degraded
  console.log('DB:', report.checks.db);
  console.log('Cache:', report.checks.cache);
  console.log('Slow API:', report.checks.slow_api);

  const handler = await health.handler();
  console.log('Handler statusCode:', handler.statusCode); // 503 (degraded)

  console.log('\n✓ Demo passed');
})();
