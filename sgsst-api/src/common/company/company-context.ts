export interface CompanyContext {
  companyId: string;
  companyName: string;
  timezone?: string;
  locale?: string;
  metadata?: Record<string, unknown>;
}

export function createCompanyContext(data: Partial<CompanyContext>): CompanyContext {
  return {
    companyId: data.companyId ?? '',
    companyName: data.companyName ?? '',
    timezone: data.timezone,
    locale: data.locale,
    metadata: data.metadata ?? {},
  };
}
