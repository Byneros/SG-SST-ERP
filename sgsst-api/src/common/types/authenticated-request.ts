import type { Request } from 'express';

export type AuthenticatedUser = {
  sub: string;
  email: string;
  role: string;
  companyId: string | null;

  // Empresa seleccionada por el SUPER_ADMIN
  activeCompanyId?: string | null;

  type?: string;
};

export type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};
