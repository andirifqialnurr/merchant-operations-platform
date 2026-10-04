/**
 * What the owners of limited data need from metering, without importing it:
 * a gate to ask before adding something, and a place to report how many
 * things exist. `core/metering` provides both for the whole application.
 */

/** Asked before something that counts against a hard limit is created (prd.md 7.1). */
export interface LimitGate {
  /**
   * Throws `LIMIT_REACHED` when adding would go over the limit of the
   * workspace's package. What already exists keeps working.
   */
  assertCanAdd(tenantId: string, dimensionKey: string, adding?: bigint): Promise<void>;
}

export const LIMIT_GATE = Symbol("LIMIT_GATE");

/** For code that runs without the application, such as unit tests of a single service. */
export const NO_LIMITS: LimitGate = { assertCanAdd: async () => undefined };

/** Counts how many of something a workspace has right now, e.g. active products. */
export type UsageGauge = (tenantId: string) => Promise<bigint>;

/**
 * Hard-count dimensions are not added up from events: the owner of the data
 * counts what exists. Each owner registers its gauge when the application starts.
 */
export class UsageGaugeRegistry {
  private readonly gauges = new Map<string, UsageGauge>();

  register(dimensionKey: string, gauge: UsageGauge) {
    if (this.gauges.has(dimensionKey)) {
      throw new Error(`A gauge for ${dimensionKey} is registered twice.`);
    }
    this.gauges.set(dimensionKey, gauge);
  }

  get(dimensionKey: string) {
    return this.gauges.get(dimensionKey);
  }

  keys() {
    return [...this.gauges.keys()];
  }
}

export const USAGE_GAUGE_REGISTRY = Symbol("USAGE_GAUGE_REGISTRY");
