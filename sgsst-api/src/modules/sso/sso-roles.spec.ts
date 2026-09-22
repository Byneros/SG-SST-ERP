import { BadRequestException } from '@nestjs/common';
import type { Role } from '@prisma/client';
import {
  groupsFromClaim,
  groupsFromSamlProfile,
  normalizeRoleGroupsInput,
  parseRoleGroups,
  resolveRoleFromGroups,
} from './sso-roles';

describe('sso-roles', () => {
  describe('parseRoleGroups', () => {
    it('accepts a valid map', () => {
      expect(
        parseRoleGroups({ 'SG-SST-Admins': 'ADMIN', Contractors: 'EMPLOYEE' }),
      ).toEqual({ 'SG-SST-Admins': 'ADMIN', Contractors: 'EMPLOYEE' });
    });

    it('returns empty map for null/undefined', () => {
      expect(parseRoleGroups(null)).toEqual({});
      expect(parseRoleGroups(undefined)).toEqual({});
    });

    it('rejects non-object values', () => {
      expect(() => parseRoleGroups(['ADMIN'])).toThrow(BadRequestException);
      expect(() => parseRoleGroups('x')).toThrow(BadRequestException);
    });

    it('rejects empty group names', () => {
      expect(() => parseRoleGroups({ '': 'ADMIN' })).toThrow(
        BadRequestException,
      );
    });

    it('rejects invalid or protected roles', () => {
      expect(() => parseRoleGroups({ Devs: 'MANAGER' })).toThrow(
        BadRequestException,
      );
      expect(() => parseRoleGroups({ Devs: 'SUPER_ADMIN' })).toThrow(
        BadRequestException,
      );
    });
  });

  describe('normalizeRoleGroupsInput', () => {
    it('accepts JSON strings and objects', () => {
      expect(normalizeRoleGroupsInput('{"Devs":"SST"}')).toEqual({
        Devs: 'SST',
      });
      expect(normalizeRoleGroupsInput({ Devs: 'SST' })).toEqual({
        Devs: 'SST',
      });
    });

    it('returns null for empty input or empty map', () => {
      expect(normalizeRoleGroupsInput(null)).toBeNull();
      expect(normalizeRoleGroupsInput('')).toBeNull();
      expect(normalizeRoleGroupsInput({})).toBeNull();
    });

    it('rejects malformed JSON strings', () => {
      expect(() => normalizeRoleGroupsInput('{Devs:SST}')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('resolveRoleFromGroups', () => {
    const map: Record<string, Role> = {
      'SG-SST-Admins': 'ADMIN',
      Contractors: 'EMPLOYEE',
    };

    it('resolves the first group present in the map (IdP order)', () => {
      const { role, fromGroupMatch } = resolveRoleFromGroups(
        ['Unknown', 'Contractors', 'SG-SST-Admins'],
        map,
        'SST',
      );
      expect(role).toBe('EMPLOYEE');
      expect(fromGroupMatch).toBe(true);
    });

    it('falls back to the default role without a match', () => {
      const { role, fromGroupMatch } = resolveRoleFromGroups(
        ['Unknown'],
        map,
        'SST',
      );
      expect(role).toBe('SST');
      expect(fromGroupMatch).toBe(false);
    });

    it('falls back without groups or map', () => {
      expect(resolveRoleFromGroups(undefined, map, 'AUDITOR')).toEqual({
        role: 'AUDITOR',
        fromGroupMatch: false,
      });
      expect(resolveRoleFromGroups(['Devs'], null, 'AUDITOR')).toEqual({
        role: 'AUDITOR',
        fromGroupMatch: false,
      });
    });
  });

  describe('groupsFromClaim', () => {
    it('accepts arrays and comma-separated strings', () => {
      expect(groupsFromClaim(['a', 'b'])).toEqual(['a', 'b']);
      expect(groupsFromClaim('a, b ,c')).toEqual(['a', 'b', 'c']);
      expect(groupsFromClaim('')).toBeUndefined();
      expect(groupsFromClaim(42)).toBeUndefined();
    });
  });

  describe('groupsFromSamlProfile', () => {
    it('reads memberOf, groups and standard URIs', () => {
      expect(groupsFromSamlProfile({ memberOf: ['g1', 'g2'] })).toEqual([
        'g1',
        'g2',
      ]);
      expect(groupsFromSamlProfile({ groups: 'g1,g2' })).toEqual(['g1', 'g2']);
      expect(
        groupsFromSamlProfile({
          'urn:oid:1.3.6.1.4.1.5923.1.5.1.1': ['eduG'],
        }),
      ).toEqual(['eduG']);
      expect(
        groupsFromSamlProfile({
          'http://schemas.xmlsoap.org/claims/Group': 'AD-Group',
        }),
      ).toEqual(['AD-Group']);
    });

    it('returns empty array without group attributes', () => {
      expect(groupsFromSamlProfile({ nameID: 'u@x' })).toEqual([]);
    });
  });
});
