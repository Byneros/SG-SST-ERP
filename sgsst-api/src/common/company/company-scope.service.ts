import { ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { resolveCompanyScope } from '../pipes/company-scope';
import { AuthenticatedUser } from '../types/authenticated-request';

export interface CompanyScope {
  companyId: string;
  branchId?: string;
  departmentId?: string;
}

@Injectable()
export class CompanyScopeService {
  resolveCompanyId(user: AuthenticatedUser, companyId?: string): string {
    return resolveCompanyScope(user, companyId);
  }

  validate(user: AuthenticatedUser, companyId: string) {
    if (resolveCompanyScope(user) !== companyId) {
      throw new ForbiddenException('Resource is outside the current company scope');
    }
  }

  getCompanyScopeFromRequest(
    req: Request & { user?: AuthenticatedUser },
  ): CompanyScope {
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('Usuario no autenticado.');
    }

    const requestedCompanyId =
      this.getHeaderValue(req, 'x-company-id') ??
      this.getQueryValue(req, 'companyId');

    return {
      companyId: resolveCompanyScope(user, requestedCompanyId),
      branchId:
        this.getHeaderValue(req, 'x-branch-id') ??
        this.getQueryValue(req, 'branchId'),
      departmentId:
        this.getHeaderValue(req, 'x-department-id') ??
        this.getQueryValue(req, 'departmentId'),
    };
  }

  applyScopeToQuery<T extends Record<string, unknown>>(
    query: T,
    scope: CompanyScope,
  ): T {
    return {
      ...query,
      companyId: scope.companyId,
      ...(scope.branchId ? { branchId: scope.branchId } : {}),
      ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
    };
  }

  private getHeaderValue(req: Request, header: string): string | undefined {
    const value = req.headers[header.toLowerCase()];
    if (!value) return undefined;
    return Array.isArray(value) ? value[0] : value.toString();
  }

  private getQueryValue(req: Request, key: string): string | undefined {
    const value = req.query[key];
    if (value === undefined) return undefined;
    if (Array.isArray(value)) {
      return typeof value[0] === 'string' ? value[0] : undefined;
    }
    return typeof value === 'string' ? value : undefined;
  }
}
