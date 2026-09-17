import { Injectable } from '@nestjs/common';

type HttpMetric = {
  count: number;
  durationMsSum: number;
};

@Injectable()
export class MetricsService {
  private readonly startedAt = Date.now();
  private readonly httpMetrics = new Map<string, HttpMetric>();

  recordHttpRequest(method: string, statusCode: number, durationMs: number) {
    const key = `${method}:${statusCode}`;
    const metric = this.httpMetrics.get(key) ?? { count: 0, durationMsSum: 0 };

    metric.count += 1;
    metric.durationMsSum += durationMs;
    this.httpMetrics.set(key, metric);
  }

  toPrometheus(): string {
    const lines = [
      '# HELP sgsst_process_uptime_seconds Process uptime in seconds.',
      '# TYPE sgsst_process_uptime_seconds gauge',
      `sgsst_process_uptime_seconds ${this.secondsSince(this.startedAt)}`,
      '# HELP sgsst_http_requests_total Total HTTP requests by method and status.',
      '# TYPE sgsst_http_requests_total counter',
      '# HELP sgsst_http_request_duration_seconds HTTP request duration by method and status.',
      '# TYPE sgsst_http_request_duration_seconds summary',
    ];

    for (const [key, metric] of this.httpMetrics) {
      const [method, status] = key.split(':', 2);
      const labels = `method="${this.escapeLabel(method)}",status="${this.escapeLabel(status)}"`;
      lines.push(`sgsst_http_requests_total{${labels}} ${metric.count}`);
      lines.push(
        `sgsst_http_request_duration_seconds_sum{${labels}} ${(metric.durationMsSum / 1_000).toFixed(6)}`,
      );
      lines.push(
        `sgsst_http_request_duration_seconds_count{${labels}} ${metric.count}`,
      );
    }

    return `${lines.join('\n')}\n`;
  }

  private secondsSince(timestamp: number) {
    return ((Date.now() - timestamp) / 1_000).toFixed(3);
  }

  private escapeLabel(value: string) {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n');
  }
}
