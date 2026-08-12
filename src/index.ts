export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export type CheckResult = 'ok' | 'failed' | 'timed_out';

export interface CheckConfig {
  /**
   * Timeout in milliseconds. Default: 5000
   */
  timeoutMs?: number;
  /**
   * If true, this check failure causes unhealthy status. Default: false
   */
  critical?: boolean;
}

export type HealthCheckFn = () => Promise<void>;

export interface CheckStatus {
  result: CheckResult;
  latencyMs: number;
  error?: string;
}

export interface HealthReport {
  status: HealthStatus;
  timestamp: string;
  checks: Record<string, CheckStatus>;
}

export interface ExpressHandler {
  statusCode: number;
  body: string;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeoutMs)
    ),
  ]);
}

export class HealthCheckRegistry {
  private registry: Map<
    string,
    { fn: HealthCheckFn; config: Required<CheckConfig> }
  > = new Map();

  /**
   * Register a health check function.
   */
  register(
    name: string,
    checkFn: HealthCheckFn,
    config: CheckConfig = {}
  ): void {
    this.registry.set(name, {
      fn: checkFn,
      config: {
        timeoutMs: config.timeoutMs || 5000,
        critical: config.critical || false,
      },
    });
  }

  /**
   * Run all registered checks in parallel (Promise.allSettled).
   * Returns overall status, per-check results, and latencies.
   */
  async status(): Promise<HealthReport> {
    const checks: Record<string, CheckStatus> = {};
    let hasCriticalFailure = false;
    let hasNonCriticalFailure = false;

    const checkPromises = Array.from(this.registry.entries()).map(
      async ([name, { fn, config }]) => {
        const startTime = Date.now();
        let result: CheckResult = 'ok';
        let error: string | undefined;

        try {
          await withTimeout(fn(), config.timeoutMs);
        } catch (err) {
          if (err instanceof Error && err.message === 'timeout') {
            result = 'timed_out';
            error = `timeout after ${config.timeoutMs}ms`;
          } else {
            result = 'failed';
            error = err instanceof Error ? err.message : String(err);
          }

          if (config.critical) {
            hasCriticalFailure = true;
          } else {
            hasNonCriticalFailure = true;
          }
        }

        const latencyMs = Date.now() - startTime;
        checks[name] = {
          result,
          latencyMs,
          ...(error && { error }),
        };
      }
    );

    // Run all checks concurrently
    await Promise.allSettled(checkPromises);

    // Determine overall status
    const status: HealthStatus = hasCriticalFailure
      ? 'unhealthy'
      : hasNonCriticalFailure
        ? 'degraded'
        : 'healthy';

    return {
      status,
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  /**
   * Express-style handler. Returns {statusCode, body}.
   */
  async handler(): Promise<ExpressHandler> {
    const report = await this.status();

    const statusCode =
      report.status === 'healthy'
        ? 200
        : report.status === 'degraded'
          ? 503
          : 503;

    return {
      statusCode,
      body: JSON.stringify(report),
    };
  }
}
