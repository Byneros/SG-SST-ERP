import { describe, expect, it } from '@jest/globals';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('exports aggregated Prometheus metrics without request paths', () => {
    const service = new MetricsService();
    service.recordHttpRequest('GET', 200, 125);
    service.recordHttpRequest('GET', 200, 75);
    service.recordHttpRequest('POST', 403, 50);

    const output = service.toPrometheus();

    expect(output).toContain(
      'sgsst_http_requests_total{method="GET",status="200"} 2',
    );
    expect(output).toContain(
      'sgsst_http_request_duration_seconds_sum{method="GET",status="200"} 0.200000',
    );
    expect(output).toContain(
      'sgsst_http_requests_total{method="POST",status="403"} 1',
    );
    expect(output).not.toContain('/api/');
  });
});
