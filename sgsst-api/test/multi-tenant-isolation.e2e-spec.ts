import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { CompanyScopeService } from '../src/common/company/company-scope.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { PrismaService } from '../src/database/prisma.service';
import { AuthController } from '../src/modules/auth/auth.controller';
import { ReportsController } from '../src/modules/reports/reports.controller';
import { ReportsQueueService } from '../src/modules/reports/reports-queue.service';
import { ReportsService } from '../src/modules/reports/reports.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { TotpService } from '../src/modules/auth/totp.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { CompaniesController } from '../src/modules/companies/companies.controller';
import { CompaniesRepository } from '../src/modules/companies/companies.repository';
import { CompaniesService } from '../src/modules/companies/companies.service';
import { DocumentsController } from '../src/modules/documents/documents.controller';
import { DocumentsRepository } from '../src/modules/documents/documents.repository';
import { DocumentsService } from '../src/modules/documents/documents.service';
import { DocumentsStorageService } from '../src/modules/documents/documents-storage.service';
import { EmployeesController } from '../src/modules/employees/employees.controller';
import { EmployeesRepository } from '../src/modules/employees/employees.repository';
import { EmployeesService } from '../src/modules/employees/employees.service';
import { IncidentsController } from '../src/modules/incidents/incidents.controller';
import { IncidentsRepository } from '../src/modules/incidents/incidents.repository';
import { IncidentsService } from '../src/modules/incidents/incidents.service';
import { RisksController } from '../src/modules/risks/risks.controller';
import { RisksRepository } from '../src/modules/risks/risks.repository';
import { RisksService } from '../src/modules/risks/risks.service';
import { SitesController } from '../src/modules/sites/sites.controller';
import { SitesRepository } from '../src/modules/sites/sites.repository';
import { SitesService } from '../src/modules/sites/sites.service';
import { SgsstAuditsController } from '../src/modules/sgsst-audits/sgsst-audits.controller';
import { SgsstAuditsRepository } from '../src/modules/sgsst-audits/sgsst-audits.repository';
import { SgsstAuditsService } from '../src/modules/sgsst-audits/SgsstAuditsService';
import { TrainingsController } from '../src/modules/trainings/trainings.controller';
import { TrainingsRepository } from '../src/modules/trainings/trainings.repository';
import { TrainingsService } from '../src/modules/trainings/trainings.service';
import { UsersController } from '../src/modules/users/users.controller';
import { UsersRepository } from '../src/modules/users/users.repository';
import { UsersService } from '../src/modules/users/users.service';

/**
 * Suite e2e de aislamiento multi-tenant.
 *
 * Escenario: dos empresas (A y B), un ADMIN por empresa.
 * Verifica: USER A -> recursos A = permitido; USER A -> recursos B = denegado (404);
 *           USER B -> recursos B = permitido; USER B -> recursos A = denegado (404).
 * Cubre GET, PATCH, DELETE, companyId manipulado, auditorías con hallazgos/acciones,
 * documentos y reportes.
 */

const jwtSecret = 'test-secret';

/** Body de una respuesta supertest, tipado para evitar `any` inseguro. */
function body<T>(response: { body: unknown }): T {
  return response.body as T;
}

type Tenant = {
  companyId: string;
  companyName: string;
  nit: string;
  adminId: string;
  adminEmail: string;
  token: string;
  /** Token de un usuario EMPLOYEE de la empresa (solo companyA lo usa). */
  employeeToken?: string;
  employeeId: string;
  documentId: string;
  riskId: string;
  siteId: string;
  incidentId: string;
  trainingId: string;
  auditId: string;
  findingId: string;
  actionId: string;
};

// ---------------------------------------------------------------------------
// Store en memoria con tablas tipadas (evita `any`)
// ---------------------------------------------------------------------------

class MemoryStore {
  companies: Array<{
    id: string;
    name: string;
    nit: string;
    arl: string | null;
    riskClass: string;
    isActive: boolean;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  users: Array<{
    id: string;
    name: string;
    email: string;
    password: string;
    role: string;
    companyId: string | null;
    refreshTokenHash: string | null;
    isActive: boolean;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  employees: Array<{
    id: string;
    firstName: string;
    lastName: string;
    documentType: string;
    document: string;
    position: string;
    email: string | null;
    phone: string | null;
    hireDate: Date | null;
    contractType: string;
    employmentStatus: string;
    workCenter: string | null;
    companyId: string;
    siteId: string | null;
    isActive: boolean;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  documents: Array<{
    id: string;
    name: string;
    fileUrl: string;
    fileName: string | null;
    mimeType: string | null;
    description: string | null;
    category: string;
    status: string;
    version: number;
    expiresAt: Date | null;
    companyId: string;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  risks: Array<{
    id: string;
    title: string;
    description: string | null;
    level: string;
    companyId: string;
    siteId: string | null;
    createdAt: Date;
  }> = [];

  sites: Array<{
    id: string;
    name: string;
    code: string | null;
    address: string | null;
    city: string | null;
    department: string | null;
    isMain: boolean;
    companyId: string;
    isActive: boolean;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  incidents: Array<{
    id: string;
    title: string;
    description: string;
    date: Date;
    status: string;
    companyId: string;
    siteId: string | null;
    createdAt: Date;
  }> = [];

  trainings: Array<{
    id: string;
    title: string;
    description: string | null;
    date: Date;
    companyId: string;
    siteId: string | null;
    createdAt: Date;
  }> = [];

  audits: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    scope: string | null;
    auditorName: string | null;
    scheduledAt: Date;
    result: string | null;
    closedAt: Date | null;
    companyId: string;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  findings: Array<{
    id: string;
    title: string;
    description: string | null;
    severity: string;
    status: string;
    auditId: string;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  actions: Array<{
    id: string;
    title: string;
    description: string | null;
    responsible: string;
    dueDate: Date;
    status: string;
    closedAt: Date | null;
    findingId: string;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  auditLogs: Array<{
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    before: unknown;
    after: unknown;
    actorId: string | null;
    createdAt: Date;
  }> = [];
}

// ---------------------------------------------------------------------------
// Repositorios en memoria (cumplen la misma superficie que los reales)
// ---------------------------------------------------------------------------

function paginate<T>(
  rows: T[],
  query: { page?: number; pageSize?: number; search?: string },
) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;
  return {
    data: rows.slice((page - 1) * pageSize, page * pageSize),
    meta: {
      page,
      pageSize,
      total: rows.length,
      totalPages: Math.ceil(rows.length / pageSize),
    },
  };
}

class MemoryUsersRepository {
  constructor(private readonly store: MemoryStore) {}

  findAll(
    companyId?: string,
    query: { page?: number; pageSize?: number; search?: string } = {},
  ) {
    const search = query.search?.toLowerCase();
    const rows = this.store.users
      .filter((u) => u.companyId === companyId)
      .filter((u) =>
        search ? `${u.name} ${u.email}`.toLowerCase().includes(search) : true,
      )
      .map((u) => this.safeUser(u));
    return Promise.resolve(paginate(rows, query));
  }

  count() {
    return Promise.resolve(this.store.users.length);
  }

  findById(id: string) {
    const user = this.store.users.find((u) => u.id === id);
    return Promise.resolve(user ? this.safeUser(user) : null);
  }

  findByIdScoped(id: string, companyId: string) {
    const user = this.store.users.find(
      (u) => u.id === id && u.companyId === companyId,
    );
    return Promise.resolve(user ? this.safeUser(user) : null);
  }

  findAuthById(id: string) {
    return Promise.resolve(this.store.users.find((u) => u.id === id) ?? null);
  }

  findByEmail(email: string) {
    return Promise.resolve(
      this.store.users.find((u) => u.email === email) ?? null,
    );
  }

  create(
    dto: { name: string; email: string; role: string; companyId?: string },
    passwordHash: string,
  ) {
    const now = new Date();
    const user = {
      id: randomUUID(),
      name: dto.name,
      email: dto.email,
      password: passwordHash,
      role: dto.role,
      companyId: dto.companyId ?? null,
      refreshTokenHash: null,
      isActive: true,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.store.users.unshift(user);
    return Promise.resolve(this.safeUser(user));
  }

  update(
    id: string,
    dto: {
      name?: string;
      email?: string;
      role?: string;
      companyId?: string | null;
      isActive?: boolean;
    },
  ) {
    const user = this.store.users.find((u) => u.id === id);
    if (!user) throw new Error('User not found');
    Object.assign(user, {
      name: dto.name ?? user.name,
      email: dto.email ?? user.email,
      role: dto.role ?? user.role,
      companyId: dto.companyId ?? user.companyId,
      isActive: dto.isActive ?? user.isActive,
      deletedAt:
        dto.isActive === undefined
          ? user.deletedAt
          : dto.isActive
            ? null
            : new Date(),
      updatedAt: new Date(),
    });
    return Promise.resolve(this.safeUser(user));
  }

  updateScoped(
    id: string,
    companyId: string,
    dto: {
      name?: string;
      email?: string;
      role?: string;
      companyId?: string | null;
      isActive?: boolean;
    },
  ) {
    const user = this.store.users.find(
      (u) => u.id === id && u.companyId === companyId,
    );
    if (!user) return { count: 0 };
    void this.update(id, dto);
    return { count: 1 };
  }

  remove(id: string) {
    return this.update(id, { isActive: false });
  }

  async removeScoped(id: string, companyId: string) {
    const user = this.store.users.find(
      (u) => u.id === id && u.companyId === companyId,
    );
    if (!user) return { count: 0 };
    await this.update(id, { isActive: false });
    return { count: 1 };
  }

  updateRefreshTokenHash(id: string, refreshTokenHash: string | null) {
    const user = this.store.users.find((u) => u.id === id);
    if (!user) throw new Error('User not found');
    user.refreshTokenHash = refreshTokenHash;
    return Promise.resolve(this.safeUser(user));
  }

  updatePassword(id: string, passwordHash: string) {
    const user = this.store.users.find((u) => u.id === id);
    if (!user) throw new Error('User not found');
    user.password = passwordHash;
    user.refreshTokenHash = null;
    return Promise.resolve(this.safeUser(user));
  }

  updatePasswordResetToken() {
    return Promise.resolve(null);
  }

  private safeUser(user: (typeof this.store.users)[number]) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      isActive: user.isActive,
      deletedAt: user.deletedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

class MemoryCompaniesRepository {
  constructor(private readonly store: MemoryStore) {}

  findAll(query: { page?: number; pageSize?: number; search?: string } = {}) {
    const search = query.search?.toLowerCase();
    const rows = this.store.companies
      .filter((c) => c.isActive)
      .filter((c) =>
        search ? `${c.name} ${c.nit}`.toLowerCase().includes(search) : true,
      );
    return Promise.resolve(paginate(rows, query));
  }

  findById(id: string) {
    return Promise.resolve(
      this.store.companies.find((c) => c.id === id) ?? null,
    );
  }

  findByNit(nit: string) {
    return Promise.resolve(
      this.store.companies.find((c) => c.nit === nit) ?? null,
    );
  }

  create(dto: { name: string; nit: string; arl?: string; riskClass?: string }) {
    const now = new Date();
    const company = {
      id: randomUUID(),
      name: dto.name,
      nit: dto.nit,
      arl: dto.arl ?? null,
      riskClass: dto.riskClass ?? 'CLASS_I',
      isActive: true,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.store.companies.unshift(company);
    return Promise.resolve(company);
  }

  update(id: string, dto: { name?: string; nit?: string; isActive?: boolean }) {
    const company = this.store.companies.find((c) => c.id === id);
    if (!company) throw new Error('Company not found');
    Object.assign(company, {
      ...dto,
      deletedAt:
        dto.isActive === undefined
          ? company.deletedAt
          : dto.isActive
            ? null
            : new Date(),
      updatedAt: new Date(),
    });
    return Promise.resolve(company);
  }

  remove(id: string) {
    return this.update(id, { isActive: false });
  }
}

class MemoryEmployeesRepository {
  constructor(private readonly store: MemoryStore) {}

  findAll(
    companyId?: string,
    query: { page?: number; pageSize?: number; search?: string } = {},
    siteId?: string,
  ) {
    const search = query.search?.toLowerCase();
    const rows = this.store.employees
      .filter((e) => e.companyId === companyId)
      .filter((e) =>
        siteId
          ? siteId === 'none'
            ? e.siteId === null
            : e.siteId === siteId
          : true,
      )
      .filter((e) =>
        search
          ? `${e.firstName} ${e.lastName} ${e.document}`
              .toLowerCase()
              .includes(search)
          : true,
      )
      .map((e) => this.withCompany(e));
    return Promise.resolve(paginate(rows, query));
  }

  findById(id: string) {
    const employee = this.store.employees.find((e) => e.id === id);
    return Promise.resolve(employee ? this.withCompany(employee) : null);
  }

  findByIdScoped(id: string, companyId: string) {
    const employee = this.store.employees.find(
      (e) => e.id === id && e.companyId === companyId,
    );
    return Promise.resolve(employee ? this.withCompany(employee) : null);
  }

  findByDocument(document: string) {
    return Promise.resolve(
      this.store.employees.find((e) => e.document === document) ?? null,
    );
  }

  create(dto: {
    firstName: string;
    lastName: string;
    documentType?: string;
    document: string;
    position: string;
    email?: string;
    phone?: string;
    hireDate?: string;
    contractType?: string;
    employmentStatus?: string;
    workCenter?: string;
    companyId: string;
  }) {
    const now = new Date();
    const employee = {
      id: randomUUID(),
      firstName: dto.firstName,
      lastName: dto.lastName,
      documentType: dto.documentType ?? 'CC',
      document: dto.document,
      position: dto.position,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      hireDate: dto.hireDate ? new Date(dto.hireDate) : null,
      contractType: dto.contractType ?? 'INDEFINITE',
      employmentStatus: dto.employmentStatus ?? 'ACTIVE',
      workCenter: dto.workCenter ?? null,
      companyId: dto.companyId,
      siteId: null,
      isActive: true,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.store.employees.unshift(employee);
    return Promise.resolve(this.withCompany(employee));
  }

  update(
    id: string,
    dto: {
      firstName?: string;
      lastName?: string;
      document?: string;
      position?: string;
      email?: string;
      phone?: string;
      companyId?: string;
      siteId?: string | null;
      isActive?: boolean;
    },
  ) {
    const employee = this.store.employees.find((e) => e.id === id);
    if (!employee) throw new Error('Employee not found');
    Object.assign(employee, {
      firstName: dto.firstName ?? employee.firstName,
      lastName: dto.lastName ?? employee.lastName,
      document: dto.document ?? employee.document,
      position: dto.position ?? employee.position,
      email: dto.email ?? employee.email,
      phone: dto.phone ?? employee.phone,
      companyId: dto.companyId ?? employee.companyId,
      siteId: dto.siteId === undefined ? employee.siteId : dto.siteId,
      isActive: dto.isActive ?? employee.isActive,
      deletedAt:
        dto.isActive === undefined
          ? employee.deletedAt
          : dto.isActive
            ? null
            : new Date(),
      updatedAt: new Date(),
    });
    return Promise.resolve(this.withCompany(employee));
  }

  updateScoped(
    id: string,
    companyId: string,
    dto: {
      firstName?: string;
      lastName?: string;
      document?: string;
      position?: string;
      email?: string;
      phone?: string;
      companyId?: string;
      siteId?: string | null;
      isActive?: boolean;
    },
  ) {
    const employee = this.store.employees.find(
      (e) => e.id === id && e.companyId === companyId,
    );
    if (!employee) return { count: 0 };
    void this.update(id, dto);
    return { count: 1 };
  }

  remove(id: string) {
    return this.update(id, { isActive: false });
  }

  async removeScoped(id: string, companyId: string) {
    const employee = this.store.employees.find(
      (e) => e.id === id && e.companyId === companyId,
    );
    if (!employee) return { count: 0 };
    await this.update(id, { isActive: false });
    return { count: 1 };
  }

  private withCompany(employee: (typeof this.store.employees)[number]) {
    const company = this.store.companies.find(
      (c) => c.id === employee.companyId,
    );
    const site = employee.siteId
      ? this.store.sites.find((s) => s.id === employee.siteId)
      : undefined;
    return {
      ...employee,
      company: company
        ? { id: company.id, name: company.name, nit: company.nit }
        : null,
      site: site
        ? { id: site.id, name: site.name, code: site.code ?? null }
        : null,
    };
  }
}

class MemoryDocumentsRepository {
  constructor(private readonly store: MemoryStore) {}

  findAll(
    companyId?: string,
    query: { page?: number; pageSize?: number; search?: string } = {},
  ) {
    const search = query.search?.toLowerCase();
    const rows = this.store.documents
      .filter((d) => d.companyId === companyId)
      .filter((d) =>
        search
          ? `${d.name} ${d.fileName ?? ''}`.toLowerCase().includes(search)
          : true,
      )
      .map((d) => this.withCompany(d));
    return Promise.resolve(paginate(rows, query));
  }

  findById(id: string) {
    const document = this.store.documents.find((d) => d.id === id);
    return Promise.resolve(document ? this.withCompany(document) : null);
  }

  findByIdScoped(id: string, companyId: string) {
    const document = this.store.documents.find(
      (d) => d.id === id && d.companyId === companyId,
    );
    return Promise.resolve(document ? this.withCompany(document) : null);
  }

  create(dto: {
    name: string;
    fileUrl: string;
    fileName?: string;
    mimeType?: string;
    description?: string;
    category?: string;
    status?: string;
    expiresAt?: string;
    companyId: string;
  }) {
    const now = new Date();
    const document = {
      id: randomUUID(),
      name: dto.name,
      fileUrl: dto.fileUrl,
      fileName: dto.fileName ?? null,
      mimeType: dto.mimeType ?? null,
      description: dto.description ?? null,
      category: dto.category ?? 'OTHER',
      status: dto.status ?? 'DRAFT',
      version: 1,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      companyId: dto.companyId,
      createdAt: now,
      updatedAt: now,
    };
    this.store.documents.unshift(document);
    return Promise.resolve(this.withCompany(document));
  }

  update(
    id: string,
    dto: {
      name?: string;
      description?: string;
      fileUrl?: string;
      expiresAt?: string;
      companyId?: string;
    },
  ) {
    const document = this.store.documents.find((d) => d.id === id);
    if (!document) throw new Error('Document not found');
    Object.assign(document, {
      name: dto.name ?? document.name,
      description: dto.description ?? document.description,
      fileUrl: dto.fileUrl ?? document.fileUrl,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : document.expiresAt,
      updatedAt: new Date(),
    });
    return Promise.resolve(this.withCompany(document));
  }

  updateScoped(
    id: string,
    companyId: string,
    dto: {
      name?: string;
      description?: string;
      fileUrl?: string;
      expiresAt?: string;
      companyId?: string;
    },
  ) {
    const document = this.store.documents.find(
      (d) => d.id === id && d.companyId === companyId,
    );
    if (!document) return null;
    return this.update(id, dto);
  }
  createVersionScoped(id: string, companyId: string, dto: { fileUrl: string }) {
    const document = this.store.documents.find(
      (d) => d.id === id && d.companyId === companyId,
    );
    if (!document) return null;
    document.version += 1;
    document.fileUrl = dto.fileUrl;
    document.updatedAt = new Date();
    return this.withCompany(document);
  }

  removeScoped(id: string, companyId: string) {
    const index = this.store.documents.findIndex(
      (d) => d.id === id && d.companyId === companyId,
    );
    if (index < 0) return false;
    this.store.documents.splice(index, 1);
    return true;
  }

  private withCompany(document: (typeof this.store.documents)[number]) {
    const company = this.store.companies.find(
      (c) => c.id === document.companyId,
    );
    return {
      ...document,
      company: company
        ? { id: company.id, name: company.name, nit: company.nit }
        : null,
    };
  }
}

class MemorySitesRepository {
  constructor(private readonly store: MemoryStore) {}

  findAll(
    companyId: string,
    query: { page?: number; pageSize?: number; search?: string } = {},
  ) {
    const search = query.search?.toLowerCase();
    const rows = this.store.sites
      .filter((s) => s.companyId === companyId && s.isActive)
      .filter((s) =>
        search
          ? `${s.name} ${s.code ?? ''} ${s.city ?? ''}`
              .toLowerCase()
              .includes(search)
          : true,
      )
      .map((s) => this.withCompany(s));
    return Promise.resolve(paginate(rows, query));
  }

  findById(id: string) {
    const site = this.store.sites.find((s) => s.id === id);
    return Promise.resolve(site ? this.withCompany(site) : null);
  }

  findByIdScoped(id: string, companyId: string) {
    const site = this.store.sites.find(
      (s) => s.id === id && s.companyId === companyId,
    );
    return Promise.resolve(site ? this.withCompany(site) : null);
  }

  findByCode(companyId: string, code: string) {
    return Promise.resolve(
      this.store.sites.find(
        (s) => s.companyId === companyId && s.code === code && !s.deletedAt,
      ) ?? null,
    );
  }

  create(
    dto: {
      name: string;
      code?: string;
      address?: string;
      city?: string;
      department?: string;
      isMain?: boolean;
      employeeIds?: string[];
    },
    companyId: string,
  ) {
    const now = new Date();
    const site = {
      id: randomUUID(),
      name: dto.name,
      code: dto.code ?? null,
      address: dto.address ?? null,
      city: dto.city ?? null,
      department: dto.department ?? null,
      isMain: dto.isMain ?? false,
      companyId,
      isActive: true,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.store.sites.unshift(site);
    if (dto.employeeIds) {
      for (const employeeId of dto.employeeIds) {
        const employee = this.store.employees.find((e) => e.id === employeeId);
        if (employee) {
          employee.siteId = site.id;
        }
      }
    }
    return Promise.resolve(this.withCompanyRelations(site));
  }

  update(
    id: string,
    dto: {
      name?: string;
      code?: string;
      address?: string;
      city?: string;
      department?: string;
      isMain?: boolean;
      employeeIds?: string[];
    },
  ) {
    const site = this.store.sites.find((s) => s.id === id);
    if (!site) throw new Error('Site not found');
    Object.assign(site, {
      name: dto.name ?? site.name,
      code: dto.code ?? site.code,
      address: dto.address ?? site.address,
      city: dto.city ?? site.city,
      department: dto.department ?? site.department,
      isMain: dto.isMain ?? site.isMain,
      updatedAt: new Date(),
    });
    return Promise.resolve(this.withCompany(site));
  }

  updateScoped(
    id: string,
    companyId: string,
    dto: {
      name?: string;
      code?: string;
      address?: string;
      city?: string;
      department?: string;
      isMain?: boolean;
      employeeIds?: string[];
    },
  ) {
    const site = this.store.sites.find(
      (s) => s.id === id && s.companyId === companyId,
    );
    if (!site) return null;
    void this.update(id, dto);
    if (dto.employeeIds) {
      for (const e of this.store.employees) {
        if (e.siteId === site.id && !dto.employeeIds.includes(e.id)) {
          e.siteId = null;
        }
      }
      for (const employeeId of dto.employeeIds) {
        const employee = this.store.employees.find((e) => e.id === employeeId);
        if (employee) {
          employee.siteId = site.id;
        }
      }
    }
    return Promise.resolve(this.withCompanyRelations(site));
  }

  remove(id: string) {
    const site = this.store.sites.find((s) => s.id === id);
    if (!site) throw new Error('Site not found');
    site.isActive = false;
    site.deletedAt = new Date();
    return Promise.resolve(this.withCompany(site));
  }

  removeScoped(id: string, companyId: string) {
    const site = this.store.sites.find(
      (s) => s.id === id && s.companyId === companyId,
    );
    if (!site) return Promise.resolve({ count: 0 });
    site.isActive = false;
    site.deletedAt = new Date();
    return Promise.resolve({ count: 1 });
  }

  /** Valida que los empleados existan en la empresa (misma regla que Prisma real). */
  assertEmployeesInCompany(employeeIds: string[], companyId: string) {
    const found = this.store.employees.filter(
      (e) => employeeIds.includes(e.id) && e.companyId === companyId,
    );
    if (found.length !== employeeIds.length) {
      return Promise.reject(new NotFoundException('Employee not found'));
    }
    return Promise.resolve();
  }

  private withCompanyRelations(site: (typeof this.store.sites)[number]) {
    const company = this.store.companies.find((c) => c.id === site.companyId);
    const employees = this.store.employees
      .filter((e) => e.siteId === site.id)
      .map((e) => ({
        id: e.id,
        firstName: e.firstName,
        lastName: e.lastName,
        position: e.position,
      }));
    return {
      ...site,
      company: company
        ? { id: company.id, name: company.name, nit: company.nit }
        : null,
      employees,
    };
  }

  private withCompany(site: (typeof this.store.sites)[number]) {
    return { ...this.withCompanyRelations(site), employees: undefined };
  }
}

class MemoryRisksRepository {
  constructor(private readonly store: MemoryStore) {}

  findAll(companyId: string, siteId?: string) {
    return Promise.resolve(
      this.store.risks
        .filter((r) => r.companyId === companyId)
        .filter((r) =>
          siteId === undefined
            ? true
            : siteId === 'none'
              ? r.siteId === null
              : r.siteId === siteId,
        ),
    );
  }

  findById(id: string) {
    return Promise.resolve(this.store.risks.find((r) => r.id === id) ?? null);
  }

  findByIdScoped(id: string, companyId: string) {
    return Promise.resolve(
      this.store.risks.find((r) => r.id === id && r.companyId === companyId) ??
        null,
    );
  }

  create(
    dto: {
      title: string;
      description?: string;
      level: string;
      siteId?: string | null;
    },
    companyId: string,
  ) {
    const risk = {
      id: randomUUID(),
      title: dto.title,
      description: dto.description ?? null,
      level: dto.level,
      companyId,
      siteId: dto.siteId ?? null,
      createdAt: new Date(),
    };
    this.store.risks.unshift(risk);
    return Promise.resolve(risk);
  }

  updateScoped(
    id: string,
    companyId: string,
    dto: {
      title?: string;
      description?: string;
      level?: string;
      siteId?: string | null;
    },
  ) {
    const risk = this.store.risks.find(
      (r) => r.id === id && r.companyId === companyId,
    );
    if (!risk) return null;
    Object.assign(risk, {
      title: dto.title ?? risk.title,
      description: dto.description ?? risk.description,
      level: dto.level ?? risk.level,
      siteId: dto.siteId === undefined ? risk.siteId : dto.siteId,
    });
    return risk;
  }

  removeScoped(id: string, companyId: string) {
    const index = this.store.risks.findIndex(
      (r) => r.id === id && r.companyId === companyId,
    );
    if (index < 0) return false;
    this.store.risks.splice(index, 1);
    return true;
  }
}

class MemoryIncidentsRepository {
  constructor(private readonly store: MemoryStore) {}

  findAll(user: unknown, companyId: string, query: unknown, siteId?: string) {
    return Promise.resolve(
      this.store.incidents
        .filter((i) => i.companyId === companyId)
        .filter((i) =>
          siteId === undefined
            ? true
            : siteId === 'none'
              ? i.siteId === null
              : i.siteId === siteId,
        ),
    );
  }

  findById(id: string) {
    return Promise.resolve(
      this.store.incidents.find((i) => i.id === id) ?? null,
    );
  }

  findByIdScoped(id: string, companyId: string) {
    return Promise.resolve(
      this.store.incidents.find(
        (i) => i.id === id && i.companyId === companyId,
      ) ?? null,
    );
  }

  create(
    dto: {
      title: string;
      description: string;
      date: string;
      siteId?: string | null;
    },
    companyId: string,
  ) {
    const incident = {
      id: randomUUID(),
      title: dto.title,
      description: dto.description,
      date: new Date(dto.date),
      status: 'PENDING',
      companyId,
      siteId: dto.siteId ?? null,
      createdAt: new Date(),
    };
    this.store.incidents.unshift(incident);
    return Promise.resolve(incident);
  }

  updateScoped(
    id: string,
    companyId: string,
    dto: { title?: string; status?: string; siteId?: string | null },
  ) {
    const incident = this.store.incidents.find(
      (i) => i.id === id && i.companyId === companyId,
    );
    if (!incident) return null;
    Object.assign(incident, {
      title: dto.title ?? incident.title,
      status: dto.status ?? incident.status,
      siteId: dto.siteId === undefined ? incident.siteId : dto.siteId,
    });
    return incident;
  }

  removeScoped(id: string, companyId: string) {
    const index = this.store.incidents.findIndex(
      (i) => i.id === id && i.companyId === companyId,
    );
    if (index < 0) return false;
    this.store.incidents.splice(index, 1);
    return true;
  }
}

class MemoryTrainingsRepository {
  constructor(private readonly store: MemoryStore) {}

  findAll(companyId: string, siteId?: string) {
    return Promise.resolve(
      this.store.trainings
        .filter((t) => t.companyId === companyId)
        .filter((t) =>
          siteId === undefined
            ? true
            : siteId === 'none'
              ? t.siteId === null
              : t.siteId === siteId,
        ),
    );
  }

  findById(id: string) {
    return Promise.resolve(
      this.store.trainings.find((t) => t.id === id) ?? null,
    );
  }

  findByIdScoped(id: string, companyId: string) {
    return Promise.resolve(
      this.store.trainings.find(
        (t) => t.id === id && t.companyId === companyId,
      ) ?? null,
    );
  }

  create(
    dto: {
      title: string;
      description?: string;
      date: string;
      siteId?: string | null;
    },
    companyId: string,
  ) {
    const training = {
      id: randomUUID(),
      title: dto.title,
      description: dto.description ?? null,
      date: new Date(dto.date),
      companyId,
      siteId: dto.siteId ?? null,
      createdAt: new Date(),
    };
    this.store.trainings.unshift(training);
    return Promise.resolve(training);
  }

  updateScoped(
    id: string,
    companyId: string,
    dto: { title?: string; siteId?: string | null },
  ) {
    const training = this.store.trainings.find(
      (t) => t.id === id && t.companyId === companyId,
    );
    if (!training) return null;
    Object.assign(training, {
      title: dto.title ?? training.title,
      siteId: dto.siteId === undefined ? training.siteId : dto.siteId,
    });
    return training;
  }

  removeScoped(id: string, companyId: string) {
    const index = this.store.trainings.findIndex(
      (t) => t.id === id && t.companyId === companyId,
    );
    if (index < 0) return false;
    this.store.trainings.splice(index, 1);
    return true;
  }
}

class MemorySgsstAuditsRepository {
  constructor(private readonly store: MemoryStore) {}

  findAll(
    companyId?: string,
    query: { page?: number; pageSize?: number; search?: string } = {},
  ) {
    const search = query.search?.toLowerCase();
    const rows = this.store.audits
      .filter((a) => a.companyId === companyId)
      .filter((a) => (search ? a.title.toLowerCase().includes(search) : true))
      .map((a) => this.withRelations(a));
    return Promise.resolve(paginate(rows, query));
  }

  findById(id: string) {
    const audit = this.store.audits.find((a) => a.id === id);
    return Promise.resolve(audit ? this.withRelations(audit) : null);
  }

  create(dto: {
    title: string;
    description?: string;
    status?: string;
    scope?: string;
    auditorName?: string;
    scheduledAt: string;
    companyId: string;
  }) {
    const now = new Date();
    const audit = {
      id: randomUUID(),
      title: dto.title,
      description: dto.description ?? null,
      status: dto.status ?? 'PLANNED',
      scope: dto.scope ?? null,
      auditorName: dto.auditorName ?? null,
      scheduledAt: new Date(dto.scheduledAt),
      result: null,
      closedAt: null,
      companyId: dto.companyId,
      createdAt: now,
      updatedAt: now,
    };
    this.store.audits.unshift(audit);
    return Promise.resolve(this.withRelations(audit));
  }

  update(
    id: string,
    dto: { title?: string; status?: string },
  ) {
    const audit = this.store.audits.find((a) => a.id === id);
    if (!audit) throw new Error('Audit not found');
    Object.assign(audit, {
      title: dto.title ?? audit.title,
      status: dto.status ?? audit.status,
      updatedAt: new Date(),
    });
    return Promise.resolve(this.withRelations(audit));
  }

  remove(id: string) {
    const index = this.store.audits.findIndex((a) => a.id === id);
    if (index < 0) throw new Error('Audit not found');
    // La cascada en la BD elimina findings, acciones y checklist del audit.
    this.store.findings = this.store.findings.filter((f) => f.auditId !== id);
    this.store.actions = this.store.actions.filter(
      (a) => !this.store.findings.some((f) => f.id === a.findingId),
    );
    this.store.audits.splice(index, 1);
    return Promise.resolve({ id, deleted: true });
  }

  createFinding(auditId: string, dto: { title: string; severity?: string }) {
    const now = new Date();
    const finding = {
      id: randomUUID(),
      title: dto.title,
      description: null,
      severity: dto.severity ?? 'MINOR',
      status: 'OPEN',
      auditId,
      createdAt: now,
      updatedAt: now,
    };
    this.store.findings.unshift(finding);
    return Promise.resolve({ ...finding, actions: [] });
  }

  findFindingById(id: string) {
    const finding = this.store.findings.find((f) => f.id === id);
    if (!finding) return Promise.resolve(null);
    const audit = this.store.audits.find((a) => a.id === finding.auditId)!;
    return Promise.resolve({ ...finding, audit, actions: [] });
  }

  findFindingByIdScoped(id: string, companyId: string) {
    const finding = this.store.findings.find((f) => f.id === id);
    if (!finding) return Promise.resolve(null);
    const audit = this.store.audits.find(
      (a) => a.id === finding.auditId && a.companyId === companyId,
    );
    if (!audit) return Promise.resolve(null);
    return Promise.resolve({ ...finding, audit, actions: [] });
  }

  updateFinding(id: string, dto: { title?: string; status?: string }) {
    const finding = this.store.findings.find((f) => f.id === id);
    if (!finding) throw new Error('Finding not found');
    Object.assign(finding, {
      title: dto.title ?? finding.title,
      status: dto.status ?? finding.status,
      updatedAt: new Date(),
    });
    const audit = this.store.audits.find((a) => a.id === finding.auditId)!;
    return Promise.resolve({ ...finding, audit, actions: [] });
  }

  createAction(
    findingId: string,
    dto: { title: string; responsible: string; dueDate: string },
  ) {
    const now = new Date();
    const action = {
      id: randomUUID(),
      title: dto.title,
      description: null,
      responsible: dto.responsible,
      dueDate: new Date(dto.dueDate),
      status: 'PENDING',
      closedAt: null,
      findingId,
      createdAt: now,
      updatedAt: now,
    };
    this.store.actions.unshift(action);
    return Promise.resolve(action);
  }

  findActionById(id: string) {
    const action = this.store.actions.find((a) => a.id === id);
    if (!action) return Promise.resolve(null);
    const finding = this.store.findings.find((f) => f.id === action.findingId)!;
    const audit = this.store.audits.find((a) => a.id === finding.auditId)!;
    return Promise.resolve({ ...action, finding: { ...finding, audit } });
  }

  findActionByIdScoped(id: string, companyId: string) {
    const action = this.store.actions.find((a) => a.id === id);
    if (!action) return Promise.resolve(null);
    const finding = this.store.findings.find((f) => f.id === action.findingId);
    if (!finding) return Promise.resolve(null);
    const audit = this.store.audits.find(
      (a) => a.id === finding.auditId && a.companyId === companyId,
    );
    if (!audit) return Promise.resolve(null);
    return Promise.resolve({ ...action, finding: { ...finding, audit } });
  }

  updateAction(id: string, dto: { title?: string; status?: string }) {
    const action = this.store.actions.find((a) => a.id === id);
    if (!action) throw new Error('Action not found');
    Object.assign(action, {
      title: dto.title ?? action.title,
      status: dto.status ?? action.status,
      updatedAt: new Date(),
    });
    const finding = this.store.findings.find((f) => f.id === action.findingId)!;
    const audit = this.store.audits.find((a) => a.id === finding.auditId)!;
    return Promise.resolve({ ...action, finding: { ...finding, audit } });
  }

  private withRelations(audit: (typeof this.store.audits)[number]) {
    const company = this.store.companies.find((c) => c.id === audit.companyId);
    const findings = this.store.findings
      .filter((f) => f.auditId === audit.id)
      .map((f) => ({
        ...f,
        actions: this.store.actions.filter((a) => a.findingId === f.id),
      }));
    return {
      ...audit,
      company: company
        ? { id: company.id, name: company.name, nit: company.nit }
        : null,
      findings,
    };
  }
}

class MemoryAuditService {
  constructor(private readonly store: MemoryStore) {}

  log(input: {
    user?: { sub: string };
    action: string;
    entity: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
  }) {
    const log = {
      id: randomUUID(),
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      before: input.before ?? null,
      after: input.after ?? null,
      actorId: input.user?.sub ?? null,
      createdAt: new Date(),
    };
    this.store.auditLogs.unshift(log);
    return Promise.resolve(log);
  }

  findAll(query: { page?: number; pageSize?: number; search?: string } = {}) {
    return Promise.resolve(paginate(this.store.auditLogs, query));
  }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('multi-tenant isolation (e2e)', () => {
  let app: INestApplication<App>;
  let store: MemoryStore;
  let jwtService: JwtService;
  let companyA: Tenant;
  let companyB: Tenant;

  const password = 'Admin12345';

  beforeAll(async () => {
    store = new MemoryStore();

    // Empresas
    for (const [name, nit] of [
      ['Empresa A S.A.S.', '900000001-1'],
      ['Empresa B S.A.S.', '900000002-2'],
    ] as const) {
      const now = new Date();
      store.companies.push({
        id: randomUUID(),
        name,
        nit,
        arl: null,
        riskClass: 'CLASS_I',
        isActive: true,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }
    const [companyARecord, companyBRecord] = store.companies;

    // Usuarios ADMIN por empresa
    const passwordHash = await bcrypt.hash(password, 4);
    for (const [email, company] of [
      ['admin-a@test.com', companyARecord],
      ['admin-b@test.com', companyBRecord],
    ] as const) {
      store.users.push({
        id: randomUUID(),
        name: `Admin ${company.name}`,
        email,
        password: passwordHash,
        role: 'ADMIN',
        companyId: company.id,
        refreshTokenHash: null,
        isActive: true,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: jwtSecret,
          signOptions: { expiresIn: '1d' },
        }),
      ],
      controllers: [
        AuthController,
        CompaniesController,
        UsersController,
        ReportsController,
        EmployeesController,
        DocumentsController,
        RisksController,
        SitesController,
        IncidentsController,
        TrainingsController,
        SgsstAuditsController,
      ],
      providers: [
        AuthService,
        CompaniesService,
        UsersService,
        EmployeesService,
        DocumentsService,
        RisksService,
        SitesService,
        IncidentsService,
        TrainingsService,
        SgsstAuditsService,
        JwtAuthGuard,
        RolesGuard,
        CompanyScopeService,
        {
          provide: UsersRepository,
          useValue: new MemoryUsersRepository(store),
        },
        {
          provide: CompaniesRepository,
          useValue: new MemoryCompaniesRepository(store),
        },
        {
          provide: EmployeesRepository,
          useValue: new MemoryEmployeesRepository(store),
        },
        {
          provide: DocumentsRepository,
          useValue: new MemoryDocumentsRepository(store),
        },
        {
          provide: DocumentsStorageService,
          useValue: { readDocument: jest.fn() },
        },
        {
          provide: RisksRepository,
          useValue: new MemoryRisksRepository(store),
        },
        {
          provide: SitesRepository,
          useValue: new MemorySitesRepository(store),
        },
        {
          provide: IncidentsRepository,
          useValue: new MemoryIncidentsRepository(store),
        },
        {
          provide: TrainingsRepository,
          useValue: new MemoryTrainingsRepository(store),
        },
        {
          provide: SgsstAuditsRepository,
          useValue: new MemorySgsstAuditsRepository(store),
        },
        { provide: AuditService, useValue: new MemoryAuditService(store) },
        {
          provide: ReportsService,
          useValue: {
            // El harness valida el RBAC del guard (403), no la logica del servicio.
            findExports: jest.fn().mockResolvedValue({
              data: [],
              meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
            }),
            metrics: jest.fn(),
            metricHistory: jest.fn(),
          },
        },
        {
          provide: ReportsQueueService,
          useValue: { enqueue: jest.fn() },
        },
        {
          provide: PrismaService,
          useValue: {
            company: { findFirst: jest.fn() },
          },
        },
        {
          provide: TotpService,
          useValue: {
            generateSecret: jest.fn(),
            verify: jest.fn(),
            otpauthUrl: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    jwtService = moduleFixture.get(JwtService);
    companyA = await bootstrapTenant(companyARecord, 'admin-a@test.com');
    companyB = await bootstrapTenant(companyBRecord, 'admin-b@test.com');

    // Usuario EMPLOYEE de la empresa A (rol operativo de solo lectura).
    const employeeUser = {
      id: randomUUID(),
      name: 'Empleado A',
      email: 'empleado-a@test.com',
      password: passwordHash,
      role: 'EMPLOYEE',
      companyId: companyARecord.id,
      refreshTokenHash: null,
      isActive: true,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.users.push(employeeUser);
    companyA.employeeToken = await jwtService.signAsync({
      sub: employeeUser.id,
      email: employeeUser.email,
      role: employeeUser.role,
      companyId: employeeUser.companyId,
      activeCompanyId: null,
      type: 'access',
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  function tokenFor(tenant: Tenant) {
    return `Bearer ${tenant.token}`;
  }

  async function bootstrapTenant(
    company: (typeof store.companies)[number],
    adminEmail: string,
  ): Promise<Tenant> {
    const admin = store.users.find((u) => u.email === adminEmail)!;

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password })
      .expect(201);
    const token = body<{ accessToken: string }>(loginResponse).accessToken;

    // Empleado propio
    const employeeResponse = await request(app.getHttpServer())
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'Empleado',
        lastName: company.name.startsWith('Empresa A') ? 'A' : 'B',
        document: company.name.startsWith('Empresa A')
          ? 'DOC-A-001'
          : 'DOC-B-001',
        position: 'Operario',
        companyId: company.id,
      })
      .expect(201);

    // Documento propio
    const documentResponse = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Documento ${company.name}`,
        fileUrl: `https://example.com/${company.id}/doc.pdf`,
        fileName: 'doc.pdf',
        mimeType: 'application/pdf',
        companyId: company.id,
      })
      .expect(201);

    // Riesgo propio
    const riskResponse = await request(app.getHttpServer())
      .post('/api/v1/risks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: `Riesgo ${company.name}`,
        level: 'HIGH',
        companyId: company.id,
      })
      .expect(201);

    // Sede propia
    const siteResponse = await request(app.getHttpServer())
      .post('/api/v1/sites')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Sede ${company.name}`,
        code: company.name.startsWith('Empresa A') ? 'SEDE-A' : 'SEDE-B',
        city: 'Bogota',
        companyId: company.id,
      })
      .expect(201);

    // Incidente propio
    const incidentResponse = await request(app.getHttpServer())
      .post('/api/v1/incidents')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: `Incidente ${company.name}`,
        description: 'Descripcion del incidente',
        date: new Date().toISOString(),
        companyId: company.id,
      })
      .expect(201);

    // Capacitacion propia
    const trainingResponse = await request(app.getHttpServer())
      .post('/api/v1/trainings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: `Capacitacion ${company.name}`,
        date: new Date().toISOString(),
        companyId: company.id,
      })
      .expect(201);

    // Auditoria propia con hallazgo y accion correctiva
    const auditResponse = await request(app.getHttpServer())
      .post('/api/v1/sgsst-audits')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: `Auditoria ${company.name}`,
        scheduledAt: new Date().toISOString(),
        companyId: company.id,
      })
      .expect(201);
    const auditId = body<{ id: string }>(auditResponse).id;

    const findingResponse = await request(app.getHttpServer())
      .post(`/api/v1/sgsst-audits/${auditId}/findings`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: `Hallazgo ${company.name}`, severity: 'MAJOR' })
      .expect(201);
    const findingId = body<{ id: string }>(findingResponse).id;

    const actionResponse = await request(app.getHttpServer())
      .post(`/api/v1/sgsst-audits/findings/${findingId}/actions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: `Accion ${company.name}`,
        responsible: 'Responsable SST',
        dueDate: new Date().toISOString(),
      })
      .expect(201);

    return {
      companyId: company.id,
      companyName: company.name,
      nit: company.nit,
      adminId: admin.id,
      adminEmail,
      token,
      employeeId: body<{ id: string }>(employeeResponse).id,
      documentId: body<{ id: string }>(documentResponse).id,
      riskId: body<{ id: string }>(riskResponse).id,
      siteId: body<{ id: string }>(siteResponse).id,
      incidentId: body<{ id: string }>(incidentResponse).id,
      trainingId: body<{ id: string }>(trainingResponse).id,
      auditId,
      findingId,
      actionId: body<{ id: string }>(actionResponse).id,
    };
  }

  it('creates isolated resources per company (A -> A allowed)', () => {
    expect(companyA.employeeId).toBeTruthy();
    expect(companyA.documentId).toBeTruthy();
    expect(companyA.riskId).toBeTruthy();
    expect(companyA.siteId).toBeTruthy();
    expect(companyA.incidentId).toBeTruthy();
    expect(companyA.trainingId).toBeTruthy();
    expect(companyA.auditId).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Sedes (sites)
  // -------------------------------------------------------------------------

  it('allows Company A to manage its own sites', async () => {
    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/sites')
      .set('Authorization', tokenFor(companyA))
      .expect(200);
    const siteIds = body<{ data: Array<{ id: string }> }>(
      listResponse,
    ).data.map((site) => site.id);
    expect(siteIds).toContain(companyA.siteId);
    expect(siteIds).not.toContain(companyB.siteId);

    await request(app.getHttpServer())
      .patch(`/api/v1/sites/${companyA.siteId}`)
      .set('Authorization', tokenFor(companyA))
      .send({ city: 'Medellin' })
      .expect(200)
      .then((response) => {
        expect(body<{ companyId: string }>(response).companyId).toBe(
          companyA.companyId,
        );
      });
  });

  it('filters employees by site and rejects a foreign site filter (404/403)', async () => {
    // Asignar el empleado de A a su sede.
    await request(app.getHttpServer())
      .patch(`/api/v1/sites/${companyA.siteId}`)
      .set('Authorization', tokenFor(companyA))
      .send({ employeeIds: [companyA.employeeId] })
      .expect(200);

    // Filtro por sede propia: solo empleados de esa sede.
    await request(app.getHttpServer())
      .get('/api/v1/employees')
      .query({ siteId: companyA.siteId })
      .set('Authorization', tokenFor(companyA))
      .expect(200)
      .then((response) => {
        const rows = body<{ data: Array<{ id: string }> }>(response).data;
        expect(rows.map((e) => e.id)).toContain(companyA.employeeId);
      });

    // Filtro por sede de B: no existe para el actor de A (404).
    await request(app.getHttpServer())
      .get('/api/v1/employees')
      .query({ siteId: companyB.siteId })
      .set('Authorization', tokenFor(companyA))
      .expect(404);

    // EMPLOYEE de A tambien puede filtrar por su sede (lectura).
    await request(app.getHttpServer())
      .get('/api/v1/employees')
      .query({ siteId: companyA.siteId })
      .set('Authorization', `Bearer ${companyA.employeeToken}`)
      .expect(200)
      .then((response) => {
        const rows = body<{ data: Array<{ companyId: string }> }>(
          response,
        ).data;
        for (const row of rows) {
          expect(row.companyId).toBe(companyA.companyId);
        }
      });
  });

  it('denies Company A access to Company B site (GET/PATCH/DELETE)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/sites/${companyB.siteId}`)
      .set('Authorization', tokenFor(companyA))
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/sites/${companyB.siteId}`)
      .set('Authorization', tokenFor(companyA))
      .send({ name: 'Hacked' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/sites/${companyB.siteId}`)
      .set('Authorization', tokenFor(companyA))
      .expect(404);
  });

  it('denies Company B access to Company A site (GET/PATCH/DELETE)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/sites/${companyA.siteId}`)
      .set('Authorization', tokenFor(companyB))
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/sites/${companyA.siteId}`)
      .set('Authorization', tokenFor(companyB))
      .send({ name: 'Hacked' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/sites/${companyA.siteId}`)
      .set('Authorization', tokenFor(companyB))
      .expect(404);
  });

  it('rejects client-sent foreign companyId when creating a site (never lands in Company B)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/sites')
      .set('Authorization', tokenFor(companyA))
      .send({
        name: 'Sede infiltrada',
        code: 'SEDE-X',
        companyId: companyB.companyId,
      })
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/v1/sites')
      .set('Authorization', tokenFor(companyA))
      .expect(200)
      .then((response) => {
        const names = body<{ data: Array<{ name: string }> }>(
          response,
        ).data.map((site) => site.name);
        expect(names).not.toContain('Sede infiltrada');
      });
  });

  it('rejects duplicate site code inside the tenant but allows it across tenants', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/sites')
      .set('Authorization', tokenFor(companyA))
      .send({ name: 'Sede duplicada', code: 'SEDE-A' })
      .expect(409);

    // El mismo codigo en otra empresa es valido (unicidad por tenant).
    await request(app.getHttpServer())
      .post('/api/v1/sites')
      .set('Authorization', tokenFor(companyB))
      .send({ name: 'Sede B con codigo de A', code: 'SEDE-A' })
      .expect(201);
  });

  // -------------------------------------------------------------------------
  // Empleados
  // -------------------------------------------------------------------------

  it('denies Company A access to Company B employee (GET/PATCH/DELETE)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/employees/${companyB.employeeId}`)
      .set('Authorization', tokenFor(companyA))
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/employees/${companyB.employeeId}`)
      .set('Authorization', tokenFor(companyA))
      .send({ position: 'Hacked' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/employees/${companyB.employeeId}`)
      .set('Authorization', tokenFor(companyA))
      .expect(404);
  });

  it('denies Company B access to Company A employee (GET/PATCH/DELETE)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/employees/${companyA.employeeId}`)
      .set('Authorization', tokenFor(companyB))
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/employees/${companyA.employeeId}`)
      .set('Authorization', tokenFor(companyB))
      .send({ position: 'Hacked' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/employees/${companyA.employeeId}`)
      .set('Authorization', tokenFor(companyB))
      .expect(404);
  });

  it('allows in-tenant employee update and keeps the employee in its company', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/employees/${companyA.employeeId}`)
      .set('Authorization', tokenFor(companyA))
      .send({ position: 'Coordinador' })
      .expect(200);
    const updated = body<{ position: string; companyId: string }>(response);
    expect(updated.position).toBe('Coordinador');
    expect(updated.companyId).toBe(companyA.companyId);
  });

  // -------------------------------------------------------------------------
  // companyId manipulado (FASE 15)
  // -------------------------------------------------------------------------

  it('rejects client-sent foreign companyId when creating an employee (never lands in Company B)', async () => {
    // Estrategia adoptada: companyId ajeno del cliente => 403. El recurso no se crea
    // en ninguna empresa (defensa explicita frente a la manipulacion del tenant).
    await request(app.getHttpServer())
      .post('/api/v1/employees')
      .set('Authorization', tokenFor(companyA))
      .send({
        firstName: 'Infiltrado',
        lastName: 'Test',
        document: 'DOC-A-002',
        position: 'Operario',
        companyId: companyB.companyId,
      })
      .expect(403);

    // Verificacion: el empleado no existe ni en la empresa del actor ni en la ajena.
    await request(app.getHttpServer())
      .get('/api/v1/employees')
      .set('Authorization', tokenFor(companyA))
      .expect(200)
      .then((response) => {
        const names = body<{ data: Array<{ firstName: string }> }>(
          response,
        ).data.map((employee) => employee.firstName);
        expect(names).not.toContain('Infiltrado');
      });
  });

  it('rejects client-sent companyId outside scope when listing employees', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/employees')
      .query({ companyId: companyB.companyId })
      .set('Authorization', tokenFor(companyA))
      .expect(403);
  });

  // -------------------------------------------------------------------------
  // Documentos
  // -------------------------------------------------------------------------

  it('denies Company A access to Company B document (GET/PATCH/DELETE/download)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/documents/${companyB.documentId}`)
      .set('Authorization', tokenFor(companyA))
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/documents/${companyB.documentId}`)
      .set('Authorization', tokenFor(companyA))
      .send({ name: 'Hacked' })
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/documents/${companyB.documentId}/download`)
      .set('Authorization', tokenFor(companyA))
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/documents/${companyB.documentId}`)
      .set('Authorization', tokenFor(companyA))
      .expect(404);
  });

  it('denies Company B access to Company A document (GET/PATCH/DELETE)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/documents/${companyA.documentId}`)
      .set('Authorization', tokenFor(companyB))
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/documents/${companyA.documentId}`)
      .set('Authorization', tokenFor(companyB))
      .send({ name: 'Hacked' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/documents/${companyA.documentId}`)
      .set('Authorization', tokenFor(companyB))
      .expect(404);
  });

  it('rejects cross-tenant document creation with foreign companyId', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', tokenFor(companyA))
      .send({
        name: 'Documento ilegal',
        fileUrl: 'https://example.com/x.pdf',
        companyId: companyB.companyId,
      })
      .expect(403);
  });

  // -------------------------------------------------------------------------
  // Riesgos, incidentes y capacitaciones
  // -------------------------------------------------------------------------

  it('denies cross-tenant access to risks (GET/PATCH/DELETE)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/risks/${companyB.riskId}`)
      .set('Authorization', tokenFor(companyA))
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/risks/${companyB.riskId}`)
      .set('Authorization', tokenFor(companyA))
      .send({ title: 'Hacked' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/risks/${companyB.riskId}`)
      .set('Authorization', tokenFor(companyA))
      .expect(404);
  });

  it('denies cross-tenant access to incidents (GET/PATCH/DELETE)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/incidents/${companyB.incidentId}`)
      .set('Authorization', tokenFor(companyA))
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/incidents/${companyB.incidentId}`)
      .set('Authorization', tokenFor(companyA))
      .send({ title: 'Hacked' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/incidents/${companyB.incidentId}`)
      .set('Authorization', tokenFor(companyA))
      .expect(404);
  });

  it('filters risks and incidents by site and rejects foreign sites', async () => {
    // Asignar sede al riesgo e incidente propios.
    await request(app.getHttpServer())
      .patch(`/api/v1/risks/${companyA.riskId}`)
      .set('Authorization', tokenFor(companyA))
      .send({ siteId: companyA.siteId })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/incidents/${companyA.incidentId}`)
      .set('Authorization', tokenFor(companyA))
      .send({ siteId: companyA.siteId })
      .expect(200);

    // Filtro por sede propia: aparecen los registros de esa sede.
    const filteredRisks = await request(app.getHttpServer())
      .get(`/api/v1/risks?siteId=${companyA.siteId}`)
      .set('Authorization', tokenFor(companyA))
      .expect(200);
    const filteredIncidents = await request(app.getHttpServer())
      .get(`/api/v1/incidents?siteId=${companyA.siteId}`)
      .set('Authorization', tokenFor(companyA))
      .expect(200);
    expect(
      (filteredRisks.body as Array<{ id: string }>).some(
        (r) => r.id === companyA.riskId,
      ),
    ).toBe(true);
    expect(
      (filteredIncidents.body as Array<{ id: string }>).some(
        (i) => i.id === companyA.incidentId,
      ),
    ).toBe(true);
    // Ningun registro de la empresa B se filtra.
    expect(
      (filteredRisks.body as Array<{ id: string }>).some(
        (r) => r.id === companyB.riskId,
      ),
    ).toBe(false);

    // EMPLOYEE tambien puede filtrar por sede de su empresa.
    await request(app.getHttpServer())
      .get(`/api/v1/risks?siteId=${companyA.siteId}`)
      .set('Authorization', `Bearer ${companyA.employeeToken}`)
      .expect(200);

    // Sede ajena: no existe para el actor (404).
    await request(app.getHttpServer())
      .get(`/api/v1/risks?siteId=${companyB.siteId}`)
      .set('Authorization', tokenFor(companyA))
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/incidents?siteId=${companyB.siteId}`)
      .set('Authorization', tokenFor(companyA))
      .expect(404);

    // Crear con sede ajena tambien es 404.
    await request(app.getHttpServer())
      .post('/api/v1/risks')
      .set('Authorization', tokenFor(companyA))
      .send({
        title: 'Riesgo sede ajena',
        level: 'LOW',
        siteId: companyB.siteId,
      })
      .expect(404);

    // 'none' = solo registros sin sede.
    await request(app.getHttpServer())
      .get('/api/v1/risks?siteId=none')
      .set('Authorization', tokenFor(companyA))
      .expect(200);
  });

  it('filters trainings by site and rejects foreign sites', async () => {
    // Asignar sede a la capacitacion propia.
    await request(app.getHttpServer())
      .patch(`/api/v1/trainings/${companyA.trainingId}`)
      .set('Authorization', tokenFor(companyA))
      .send({ siteId: companyA.siteId })
      .expect(200);

    // Filtro por sede propia: aparece la capacitacion de esa sede.
    const filtered = await request(app.getHttpServer())
      .get(`/api/v1/trainings?siteId=${companyA.siteId}`)
      .set('Authorization', tokenFor(companyA))
      .expect(200);
    expect(
      (filtered.body as Array<{ id: string }>).some(
        (t) => t.id === companyA.trainingId,
      ),
    ).toBe(true);

    // Sede ajena: no existe para el actor (404).
    await request(app.getHttpServer())
      .get(`/api/v1/trainings?siteId=${companyB.siteId}`)
      .set('Authorization', tokenFor(companyA))
      .expect(404);
  });

  it('filters documents by site and rejects foreign sites', async () => {
    // Asignar sede al documento propio.
    await request(app.getHttpServer())
      .patch(`/api/v1/documents/${companyA.documentId}`)
      .set('Authorization', tokenFor(companyA))
      .send({ siteId: companyA.siteId })
      .expect(200);

    // Filtro por sede propia: aparece el documento de esa sede (respuesta paginada).
    const filtered = await request(app.getHttpServer())
      .get(`/api/v1/documents?siteId=${companyA.siteId}`)
      .set('Authorization', tokenFor(companyA))
      .expect(200);
    const rows = (filtered.body as { data: Array<{ id: string }> }).data;
    expect(rows.some((d) => d.id === companyA.documentId)).toBe(true);

    // Sede ajena: no existe para el actor (404).
    await request(app.getHttpServer())
      .get(`/api/v1/documents?siteId=${companyB.siteId}`)
      .set('Authorization', tokenFor(companyA))
      .expect(404);
  });

  it('denies cross-tenant access to trainings (GET/PATCH/DELETE)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/trainings/${companyB.trainingId}`)
      .set('Authorization', tokenFor(companyA))
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/trainings/${companyB.trainingId}`)
      .set('Authorization', tokenFor(companyA))
      .send({ title: 'Hacked' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/trainings/${companyB.trainingId}`)
      .set('Authorization', tokenFor(companyA))
      .expect(404);
  });

  // -------------------------------------------------------------------------
  // Auditorias SG-SST y entidades relacionadas (FASE 10 / AC-06)
  // -------------------------------------------------------------------------

  it('denies Company A access to Company B audit and its findings/actions', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/sgsst-audits/${companyB.auditId}`)
      .set('Authorization', tokenFor(companyA))
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/sgsst-audits/${companyB.auditId}`)
      .set('Authorization', tokenFor(companyA))
      .send({ title: 'Hacked' })
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/sgsst-audits/findings/${companyB.findingId}`)
      .set('Authorization', tokenFor(companyA))
      .send({ status: 'CLOSED' })
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/sgsst-audits/actions/${companyB.actionId}`)
      .set('Authorization', tokenFor(companyA))
      .send({ status: 'COMPLETED' })
      .expect(404);
  });

  it('denies creating a finding in an audit of another company', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/sgsst-audits/${companyB.auditId}/findings`)
      .set('Authorization', tokenFor(companyA))
      .send({ title: 'Hallazgo ilegal', severity: 'CRITICAL' })
      .expect(404);
  });

  it('denies creating an action in a finding of another company', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/sgsst-audits/findings/${companyB.findingId}/actions`)
      .set('Authorization', tokenFor(companyA))
      .send({
        title: 'Accion ilegal',
        responsible: 'Alguien',
        dueDate: new Date().toISOString(),
      })
      .expect(404);
  });

  // -------------------------------------------------------------------------
  // Usuarios
  // -------------------------------------------------------------------------

  it('denies Company A access to Company B users (list and detail)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', tokenFor(companyA))
      .expect(200)
      .then((response) => {
        const emails = body<{ data: Array<{ email: string }> }>(
          response,
        ).data.map((user) => user.email);
        expect(emails).not.toContain(companyB.adminEmail);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/users/${companyB.adminId}`)
      .set('Authorization', tokenFor(companyA))
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/users/${companyB.adminId}`)
      .set('Authorization', tokenFor(companyA))
      .send({ name: 'Hacked' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/users/${companyB.adminId}`)
      .set('Authorization', tokenFor(companyA))
      .expect(404);
  });

  it('rejects creating a site with an employee from another company (404, never a 500)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/sites')
      .set('Authorization', tokenFor(companyA))
      .send({
        name: 'Sede con infiltrado',
        code: 'SEDE-INF',
        companyId: companyA.companyId,
        employeeIds: [companyB.employeeId],
      })
      .expect(404);

    // La sede no debe haberse creado.
    await request(app.getHttpServer())
      .get('/api/v1/sites')
      .set('Authorization', tokenFor(companyA))
      .expect(200)
      .then((response) => {
        const names = body<{ data: Array<{ name: string }> }>(
          response,
        ).data.map((site) => site.name);
        expect(names).not.toContain('Sede con infiltrado');
      });
  });

  it('assigns employees to a site and rejects foreign employees on update', async () => {
    // Asignar el empleado propio a la sede propia via PATCH.
    await request(app.getHttpServer())
      .patch(`/api/v1/sites/${companyA.siteId}`)
      .set('Authorization', tokenFor(companyA))
      .send({ employeeIds: [companyA.employeeId] })
      .expect(200)
      .then((response) => {
        const employees = body<{ employees: Array<{ id: string }> }>(
          response,
        ).employees;
        expect(employees.map((e) => e.id)).toContain(companyA.employeeId);
      });

    // Actualizar el empleado con una sede de otra empresa: 404 (no existe para el actor).
    await request(app.getHttpServer())
      .patch(`/api/v1/employees/${companyA.employeeId}`)
      .set('Authorization', tokenFor(companyA))
      .send({ siteId: companyB.siteId })
      .expect(404);

    // El empleado conserva su empresa y sin sede ajena.
    await request(app.getHttpServer())
      .get(`/api/v1/employees/${companyA.employeeId}`)
      .set('Authorization', tokenFor(companyA))
      .expect(200)
      .then((response) => {
        const employee = body<{ companyId: string; siteId: string | null }>(
          response,
        );
        expect(employee.companyId).toBe(companyA.companyId);
        expect(employee.siteId ?? null).not.toBe(companyB.siteId);
      });
  });

  // -------------------------------------------------------------------------
  // EMPLOYEE: lectura de su empresa, bloqueo de mutaciones y de datos ajenos
  // -------------------------------------------------------------------------

  it('allows Employee A to read its own company data', async () => {
    const token = `Bearer ${companyA.employeeToken}`;

    await request(app.getHttpServer())
      .get('/api/v1/employees')
      .set('Authorization', token)
      .expect(200)
      .then((response) => {
        const companyIds = body<{ data: Array<{ companyId: string }> }>(
          response,
        ).data.map((employee) => employee.companyId);
        expect(companyIds.length).toBeGreaterThan(0);
        for (const companyId of companyIds) {
          expect(companyId).toBe(companyA.companyId);
        }
      });

    await request(app.getHttpServer())
      .get(`/api/v1/employees/${companyA.employeeId}`)
      .set('Authorization', token)
      .expect(200);
  });

  it('blocks Employee A from other company data', async () => {
    const token = `Bearer ${companyA.employeeToken}`;

    await request(app.getHttpServer())
      .get(`/api/v1/employees/${companyB.employeeId}`)
      .set('Authorization', token)
      .expect(404);

    await request(app.getHttpServer())
      .get('/api/v1/incidents')
      .query({ companyId: companyB.companyId })
      .set('Authorization', token)
      .expect(403);
  });

  it('restricts Employee A to read-only endpoints (mutations require SST/ADMIN)', async () => {
    const token = `Bearer ${companyA.employeeToken}`;

    await request(app.getHttpServer())
      .post('/api/v1/employees')
      .set('Authorization', token)
      .send({
        firstName: 'No',
        lastName: 'Autorizado',
        document: 'DOC-A-403',
        position: 'Operario',
      })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/employees/${companyA.employeeId}`)
      .set('Authorization', token)
      .send({ position: 'Hacked' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/employees/${companyA.employeeId}`)
      .set('Authorization', token)
      .expect(403);

    // Los reportes/exports siguen siendo solo-backoffice.
    await request(app.getHttpServer())
      .get('/api/v1/reports/exports')
      .set('Authorization', token)
      .expect(403);
  });

  it('allows Employee A to report an incident that lands only in its own company', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/incidents')
      .set('Authorization', `Bearer ${companyA.employeeToken}`)
      .send({
        title: 'Incidente reportado por empleado',
        description: 'Reporte desde el rol EMPLOYEE',
        date: new Date().toISOString(),
      })
      .expect(201);

    expect(body<{ companyId: string }>(response).companyId).toBe(
      companyA.companyId,
    );

    // Intento de manipulacion: companyId ajeno del cliente se rechaza (403).
    await request(app.getHttpServer())
      .post('/api/v1/incidents')
      .set('Authorization', `Bearer ${companyA.employeeToken}`)
      .send({
        title: 'Incidente infiltrado',
        description: 'Debe ser rechazado',
        date: new Date().toISOString(),
        companyId: companyB.companyId,
      })
      .expect(403);
  });

  it('allows Employee A to read incidents/risks/trainings of its own company only', async () => {
    const token = `Bearer ${companyA.employeeToken}`;

    // Listados de operaciones: visibles para el trabajador, siempre su empresa.
    for (const resource of ['incidents', 'risks', 'trainings'] as const) {
      await request(app.getHttpServer())
        .get(`/api/v1/${resource}`)
        .set('Authorization', token)
        .expect(200)
        .then((response) => {
          const companyIds = (
            response.body as Array<{ companyId: string }>
          ).map((row) => row.companyId);
          expect(companyIds.length).toBeGreaterThan(0);
          for (const companyId of companyIds) {
            expect(companyId).toBe(companyA.companyId);
          }
        });
    }

    // Detalle cross-tenant: un recurso de Empresa B no existe para el empleado.
    await request(app.getHttpServer())
      .get(`/api/v1/incidents/${companyB.incidentId}`)
      .set('Authorization', token)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/risks/${companyB.riskId}`)
      .set('Authorization', token)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/trainings/${companyB.trainingId}`)
      .set('Authorization', token)
      .expect(404);
  });

  it('denies Employee A cross-tenant manipulation of incidents/risks/trainings', async () => {
    const token = `Bearer ${companyA.employeeToken}`;

    // RBAC: EMPLOYEE nunca muta recursos (403 antes de llegar al scope).
    await request(app.getHttpServer())
      .patch(`/api/v1/risks/${companyA.riskId}`)
      .set('Authorization', token)
      .send({ title: 'Hacked' })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/api/v1/risks/${companyA.riskId}`)
      .set('Authorization', token)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/risks')
      .set('Authorization', token)
      .send({ title: 'Riesgo no autorizado', level: 'HIGH' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/trainings')
      .set('Authorization', token)
      .send({
        title: 'Capacitacion no autorizada',
        date: new Date().toISOString(),
      })
      .expect(403);

    // Defensa en profundidad: aun con RBAC sorteado, el scope devuelve 404
    // para recursos de otra empresa (aqui lo ejercita el rol ADMIN de A).
    await request(app.getHttpServer())
      .patch(`/api/v1/risks/${companyB.riskId}`)
      .set('Authorization', tokenFor(companyA))
      .send({ title: 'Hacked' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/v1/trainings/${companyB.trainingId}`)
      .set('Authorization', tokenFor(companyA))
      .expect(404);
  });

  // -------------------------------------------------------------------------
  // SUPER_ADMIN con empresa activa (FASE 16 / AC-05)
  // -------------------------------------------------------------------------

  it('scopes SUPER_ADMIN queries to its selected active company', async () => {
    const activeToken = await jwtService.signAsync({
      sub: 'super-admin-e2e',
      email: 'super@platform.test',
      role: 'SUPER_ADMIN',
      companyId: null,
      activeCompanyId: companyA.companyId,
      type: 'access',
    });

    await request(app.getHttpServer())
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${activeToken}`)
      .expect(200)
      .then((response) => {
        const companyIds = body<{ data: Array<{ companyId: string }> }>(
          response,
        ).data.map((employee) => employee.companyId);
        expect(companyIds.length).toBeGreaterThan(0);
        for (const companyId of companyIds) {
          expect(companyId).toBe(companyA.companyId);
        }
      });

    await request(app.getHttpServer())
      .get(`/api/v1/employees/${companyB.employeeId}`)
      .set('Authorization', `Bearer ${activeToken}`)
      .expect(404);
  });

  it('requires SUPER_ADMIN to select a company before tenant data access', async () => {
    const noCompanyToken = await jwtService.signAsync({
      sub: 'super-admin-e2e',
      email: 'super@platform.test',
      role: 'SUPER_ADMIN',
      companyId: null,
      activeCompanyId: null,
      type: 'access',
    });

    await request(app.getHttpServer())
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${noCompanyToken}`)
      .expect(403);
  });
});
