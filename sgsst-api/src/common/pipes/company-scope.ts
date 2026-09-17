import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../types/authenticated-request';

/**
 * Única fuente de verdad del contexto de empresa.
 *
 * SUPER_ADMIN: usa `activeCompanyId` seleccionado mediante POST /auth/active-company.
 * Usuario normal: SIEMPRE su `companyId` de cuenta; cualquier `companyId` del cliente
 * fuera de su empresa es rechazado (403).
 *
 * El frontend nunca decide el alcance: esta función es la autoridad en backend.
 */
export function resolveCompanyScope(
  currentUser: AuthenticatedUser,
  requestedCompanyId?: string | null,
): string {
  const activeCompanyId =
    currentUser.role === 'SUPER_ADMIN'
      ? (currentUser.activeCompanyId ?? currentUser.companyId)
      : currentUser.companyId;

  if (!activeCompanyId) {
    throw new ForbiddenException(
      'A company must be selected before accessing tenant data',
    );
  }

  if (requestedCompanyId && requestedCompanyId !== activeCompanyId) {
    throw new ForbiddenException(
      'Requested company is outside the current company scope',
    );
  }

  return activeCompanyId;
}

export function assertCompanyScope(
  currentUser: AuthenticatedUser,
  companyId?: string | null,
) {
  const activeCompanyId = resolveCompanyScope(currentUser);
  if (activeCompanyId !== companyId) {
    throw new ForbiddenException(
      'Resource is outside the current company scope',
    );
  }
}
