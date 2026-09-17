export const COMPANY_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
} as const;

export const COMPANY_TYPES = {
  PRIVATE: 'private',
  PUBLIC: 'public',
  NON_PROFIT: 'non_profit',
  GOVERNMENT: 'government',
} as const;

export const COMPANY_DEFAULTS = {
  MAX_NAME_LENGTH: 255,
  MIN_NAME_LENGTH: 2,
  DEFAULT_TIMEZONE: 'UTC',
  DEFAULT_LOCALE: 'en-US',
} as const;

export type CompanyStatus = typeof COMPANY_STATUSES[keyof typeof COMPANY_STATUSES];
export type CompanyType = typeof COMPANY_TYPES[keyof typeof COMPANY_TYPES];
