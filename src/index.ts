export class HealthCheck {
  private checks = new Map<string, () => Promise<boolean>>();
  
  register(name: string, check: () => Promise<boolean>): void {
    this.checks.set(name, check);
  }
  
  async status(): Promise<{ healthy: boolean; checks: Record<string, boolean> }> {
    const results: Record<string, boolean> = {};
    for (const [name, check] of this.checks) {
      try { results[name] = await check(); } catch { results[name] = false; }
    }
    return { healthy: Object.values(results).every(v => v), checks: results };
  }
}
