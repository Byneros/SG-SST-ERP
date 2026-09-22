import { BadRequestException } from '@nestjs/common';
import type { Role } from '@prisma/client';

/**
 * Overrides de rol por grupo del IdP (Fase 9.4). El admin mapea nombres de
 * grupo del IdP (memberOf en SAML, `groups` en OIDC) a roles del ERP:
 * `{ "SG-SST-Admins": "ADMIN", "Contratistas": "EMPLOYEE" }`.
 * El primer grupo del usuario presente en el mapa define el rol; sin match
 * aplica el rol por defecto del proveedor.
 */

/** Roles asignables via SSO: nunca SUPER_ADMIN (provision automatica). */
const ASSIGNABLE_ROLES: Role[] = ['EMPLOYEE', 'SST', 'AUDITOR', 'ADMIN'];

export type RoleGroupMap = Record<string, Role>;

/** Valida la forma { grupo: ROL }; lanza 400 con detalle si es invalida. */
export function parseRoleGroups(value: unknown): RoleGroupMap {
  if (value === null || value === undefined) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(
      'roleGroups must be an object mapping IdP group names to roles',
    );
  }
  const entries = Object.entries(value as Record<string, unknown>);
  const map: RoleGroupMap = {};
  for (const [group, role] of entries) {
    const name = group.trim();
    if (!name) {
      throw new BadRequestException('roleGroups contains an empty group name');
    }
    if (typeof role !== 'string' || !ASSIGNABLE_ROLES.includes(role as Role)) {
      throw new BadRequestException(
        `roleGroups: "${name}" maps to an invalid role (allowed: ${ASSIGNABLE_ROLES.join(', ')})`,
      );
    }
    map[name] = role as Role;
  }
  return map;
}

/** Normaliza la entrada cruda del DTO (JSON string u objeto) para persistir. */
export function normalizeRoleGroupsInput(value: unknown): RoleGroupMap | null {
  if (value === null || value === undefined || value === '') return null;
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new BadRequestException('roleGroups must be valid JSON');
    }
  }
  const map = parseRoleGroups(parsed);
  return Object.keys(map).length > 0 ? map : null;
}

/**
 * Rol efectivo para los grupos del usuario: el primer grupo (en el orden en
 * que el IdP los envia) con entrada en el mapa gana; si no hay match, el rol
 * por defecto del proveedor. `fromGroupMatch` indica si el rol salio del mapa
 * (solo entonces se sincroniza el rol de usuarios existentes).
 */
export function resolveRoleFromGroups(
  groups: string[] | undefined,
  roleGroups: RoleGroupMap | null | undefined,
  defaultRole: Role,
): { role: Role; fromGroupMatch: boolean } {
  if (!roleGroups || !groups?.length) {
    return { role: defaultRole, fromGroupMatch: false };
  }
  for (const group of groups) {
    const role = roleGroups[group];
    if (role) return { role, fromGroupMatch: true };
  }
  return { role: defaultRole, fromGroupMatch: false };
}

/** Extrae la lista de grupos de un claim OIDC (string "a,b" o array). */
export function groupsFromClaim(value: unknown): string[] | undefined {
  if (typeof value === 'string') {
    const groups = value
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);
    return groups.length > 0 ? groups : undefined;
  }
  if (
    Array.isArray(value) &&
    value.every((g) => typeof g === 'string' && g.length > 0)
  ) {
    const groups = value as string[];
    return groups.length > 0 ? groups : undefined;
  }
  return undefined;
}

/** Extrae grupos de un assertion SAML: memberOf, groups o URIs OID estandar. */
export function groupsFromSamlProfile(
  profile: Record<string, unknown>,
): string[] {
  const candidates = [
    profile.memberOf,
    profile.groups,
    profile['urn:oid:1.3.6.1.4.1.5923.1.5.1.1'],
    profile['http://schemas.xmlsoap.org/claims/Group'],
  ];
  for (const candidate of candidates) {
    const groups = groupsFromClaim(candidate);
    if (groups) return groups;
  }
  return [];
}
