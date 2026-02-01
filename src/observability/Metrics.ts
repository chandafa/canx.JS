/**
 * CanxJS Metrics - Prometheus-compatible metrics system
 * @description Application metrics collection and exposition
 */

export interface MetricLabels {
  [key: string]: string | number;
}

export interface MetricConfig {
  name: string;
  help: string;
  labelNames?: string[];
  buckets?: number[]; // For histograms
}

export interface MetricsDriver {
  registerCounter(config: MetricConfig): void;
  registerGauge(config: MetricConfig): void;
  registerHistogram(config: MetricConfig): void;
  registerSummary(config: MetricConfig): void;

  incrementCounter(name: string, value?: number, labels?: MetricLabels): void;
  setGauge(name: string, value: number, labels?: MetricLabels): void;
  observeHistogram(name: string, value: number, labels?: MetricLabels): void;
  observeSummary(name: string, value: number, labels?: MetricLabels): void;

  getMetrics(): Promise<string>;
  getContentType(): string;
}

/**
 * In-memory Metrics Driver (simple implementation without external deps)
 * Note: For production, we recommend using 'prom-client' driver
 */
export class MemoryMetricsDriver implements MetricsDriver {
  private metrics = new Map<string, { 
    config: MetricConfig; 
    type: 'counter' | 'gauge' | 'histogram' | 'summary';
    values: Map<string, any>; 
  }>();

  // Helper to generate key from labels
  private getKey(labels: MetricLabels = {}): string {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }

  registerCounter(config: MetricConfig): void {
    this.metrics.set(config.name, { config, type: 'counter', values: new Map() });
  }

  registerGauge(config: MetricConfig): void {
    this.metrics.set(config.name, { config, type: 'gauge', values: new Map() });
  }

  registerHistogram(config: MetricConfig): void {
    this.metrics.set(config.name, { config, type: 'histogram', values: new Map() });
  }

  registerSummary(config: MetricConfig): void {
    this.metrics.set(config.name, { config, type: 'summary', values: new Map() });
  }

  incrementCounter(name: string, value: number = 1, labels?: MetricLabels): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'counter') return;

    const key = this.getKey(labels);
    const current = metric.values.get(key) || 0;
    metric.values.set(key, current + value);
  }

  setGauge(name: string, value: number, labels?: MetricLabels): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'gauge') return;

    const key = this.getKey(labels);
    metric.values.set(key, value);
  }

  observeHistogram(name: string, value: number, labels?: MetricLabels): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'histogram') return;

    const key = this.getKey(labels);
    const data = metric.values.get(key) || { sum: 0, count: 0, buckets: {} };
    
    data.sum += value;
    data.count++;
    
    const buckets = metric.config.buckets || [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
    for (const bucket of buckets) {
      if (value <= bucket) {
        data.buckets[bucket] = (data.buckets[bucket] || 0) + 1;
      }
    }

    metric.values.set(key, data);
  }

  observeSummary(name: string, value: number, labels?: MetricLabels): void {
    // Simplified summary for memory driver
    this.observeHistogram(name, value, labels);
  }

  async getMetrics(): Promise<string> {
    let output = '';

    for (const [name, metric] of this.metrics) {
      output += `# HELP ${name} ${metric.config.help}\n`;
      output += `# TYPE ${name} ${metric.type}\n`;

      for (const [key, value] of metric.values) {
        const labelStr = key ? `{${key}}` : '';
        
        if (metric.type === 'counter' || metric.type === 'gauge') {
          output += `${name}${labelStr} ${value}\n`;
        } else if (metric.type === 'histogram') {
          for (const [bucket, count] of Object.entries(value.buckets)) {
            const bucketLabels = key ? `${key},le="${bucket}"` : `le="${bucket}"`;
            output += `${name}_bucket{${bucketLabels}} ${count}\n`;
          }
          const infLabels = key ? `${key},le="+Inf"` : `le="+Inf"`;
          output += `${name}_bucket{${infLabels}} ${value.count}\n`;
          output += `${name}_sum${labelStr} ${value.sum}\n`;
          output += `${name}_count${labelStr} ${value.count}\n`;
        }
      }
      output += '\n';
    }

    return output;
  }

  getContentType(): string {
    return 'text/plain; version=0.0.4; charset=utf-8';
  }
}

/**
 * Metrics Manager
 */
export class Metrics {
  private driver: MetricsDriver;

  constructor(driver: MetricsDriver) {
    this.driver = driver;
  }

  // Counter
  createCounter(config: MetricConfig): (value?: number, labels?: MetricLabels) => void {
    this.driver.registerCounter(config);
    return (value = 1, labels) => this.driver.incrementCounter(config.name, value, labels);
  }

  // Gauge
  createGauge(config: MetricConfig): (value: number, labels?: MetricLabels) => void {
    this.driver.registerGauge(config);
    return (value, labels) => this.driver.setGauge(config.name, value, labels);
  }

  // Histogram
  createHistogram(config: MetricConfig): (value: number, labels?: MetricLabels) => void {
    this.driver.registerHistogram(config);
    return (value, labels) => this.driver.observeHistogram(config.name, value, labels);
  }

  // Summary
  createSummary(config: MetricConfig): (value: number, labels?: MetricLabels) => void {
    this.driver.registerSummary(config);
    return (value, labels) => this.driver.observeSummary(config.name, value, labels);
  }

  /**
   * Get metrics for exposition
   */
  async getMetrics(): Promise<{ contentType: string; metrics: string }> {
    return {
      contentType: this.driver.getContentType(),
      metrics: await this.driver.getMetrics(),
    };
  }

  /**
   * Middleware to expose metrics endpoint
   */
  endpoint() {
    return async () => {
      const { contentType, metrics } = await this.getMetrics();
      return new Response(metrics, {
        headers: {
          'Content-Type': contentType,
        },
      });
    };
  }

  /**
   * Middleware to measure HTTP request duration
   */
  requestDurationMiddleware(histogram?: (value: number, labels?: MetricLabels) => void) {
    if (!histogram) {
      histogram = this.createHistogram({
        name: 'http_request_duration_seconds',
        help: 'Duration of HTTP requests in seconds',
        labelNames: ['method', 'route', 'status_code'],
        buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      });
    }

    return async (req: any, res: any, next: () => Promise<Response | void>): Promise<Response | void> => {
      const start = performance.now();
      
      try {
        const response = await next();
        const duration = (performance.now() - start) / 1000;
        
        const labels = {
          method: req.method,
          route: req.route?.path || 'unknown',
          status_code: response?.status || 200,
        };
        
        histogram!(duration, labels);
        return response;
      } catch (error) {
        const duration = (performance.now() - start) / 1000;
        const labels = {
          method: req.method,
          route: req.route?.path || 'unknown',
          status_code: 500,
        };
        histogram!(duration, labels);
        throw error;
      }
    };
  }
}

// ============================================
// Factory Functions
// ============================================

let defaultMetrics: Metrics | null = null;

export function initMetrics(driver?: MetricsDriver): Metrics {
  defaultMetrics = new Metrics(driver ?? new MemoryMetricsDriver());
  return defaultMetrics;
}

export function metrics(): Metrics {
  if (!defaultMetrics) {
    defaultMetrics = new Metrics(new MemoryMetricsDriver());
  }
  return defaultMetrics;
}

export function createMetrics(driver: MetricsDriver): Metrics {
  return new Metrics(driver);
}

export default Metrics;
