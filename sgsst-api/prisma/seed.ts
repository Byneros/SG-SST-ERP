import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  CompanyRiskClass,
  ContractType,
  DocumentCategory,
  DocumentStatus,
  DocumentType,
  EmploymentStatus,
  IncidentStatus,
  PrismaClient,
  RiskLevel,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }),
});

async function main() {
  const password = await bcrypt.hash('Admin12345', 12);

  const company = await prisma.company.upsert({
    where: { nit: '900123456-7' },
    update: {
      name: 'Industrias Andinas S.A.S.',
      address: 'Calle 26 # 68-45, Bogota',
      phone: '+57 601 555 0101',
      email: 'contacto@industriasandinas.com',
      arl: 'SURA',
      riskClass: CompanyRiskClass.CLASS_IV,
      economicActivity: 'Manufactura de productos metalmecanicos',
      city: 'Bogota',
      department: 'Cundinamarca',
    },
    create: {
      name: 'Industrias Andinas S.A.S.',
      nit: '900123456-7',
      address: 'Calle 26 # 68-45, Bogota',
      phone: '+57 601 555 0101',
      email: 'contacto@industriasandinas.com',
      arl: 'SURA',
      riskClass: CompanyRiskClass.CLASS_IV,
      economicActivity: 'Manufactura de productos metalmecanicos',
      city: 'Bogota',
      department: 'Cundinamarca',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@sgsst.com' },
    update: {
      name: 'Administrador SG-SST',
      role: Role.ADMIN,
      // Sin empresa el scope multi-tenant rechaza todo acceso (403).
      companyId: company.id,
    },
    create: {
      name: 'Administrador SG-SST',
      email: 'admin@sgsst.com',
      password,
      role: Role.ADMIN,
      companyId: company.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'sst@sgsst.com' },
    update: {
      name: 'Coordinador SST',
      role: Role.SST,
      companyId: company.id,
    },
    create: {
      name: 'Coordinador SST',
      email: 'sst@sgsst.com',
      password,
      role: Role.SST,
      companyId: company.id,
    },
  });

  // Usuario EMPLOYEE de QA: lectura de su empresa y reporte de incidentes.
  await prisma.user.upsert({
    where: { email: 'empleado@sgsst.com' },
    update: {
      name: 'Empleado QA',
      role: Role.EMPLOYEE,
      companyId: company.id,
    },
    create: {
      name: 'Empleado QA',
      email: 'empleado@sgsst.com',
      password,
      role: Role.EMPLOYEE,
      companyId: company.id,
    },
  });

  // Sede principal para los empleados de demostracion.
  const mainSite = await prisma.site.upsert({
    where: {
      companyId_code: { companyId: company.id, code: 'SEDE-NORTE' },
    },
    update: {
      name: 'Planta Norte',
      address: 'KM 4 Via Cali, Bogota',
      city: 'Bogota',
      department: 'Cundinamarca',
      isMain: true,
    },
    create: {
      name: 'Planta Norte',
      code: 'SEDE-NORTE',
      address: 'KM 4 Via Cali, Bogota',
      city: 'Bogota',
      department: 'Cundinamarca',
      isMain: true,
      companyId: company.id,
    },
  });

  const employees = [
    {
      firstName: 'Laura',
      lastName: 'Mendez',
      document: '1001001001',
      position: 'Coordinadora de operaciones',
      documentType: DocumentType.CC,
      workCenter: 'Planta Norte',
      contractType: ContractType.INDEFINITE,
      employmentStatus: EmploymentStatus.ACTIVE,
      hireDate: new Date('2024-02-15T00:00:00.000Z'),
      email: 'laura.mendez@industriasandinas.com',
      phone: '3005551101',
    },
    {
      firstName: 'Carlos',
      lastName: 'Rivas',
      document: '1001001002',
      position: 'Operario de produccion',
      documentType: DocumentType.CC,
      workCenter: 'Bodega',
      contractType: ContractType.FIXED_TERM,
      employmentStatus: EmploymentStatus.ACTIVE,
      hireDate: new Date('2025-07-01T00:00:00.000Z'),
      email: 'carlos.rivas@industriasandinas.com',
      phone: '3005551102',
    },
    {
      firstName: 'Diana',
      lastName: 'Castro',
      document: '1001001003',
      position: 'Supervisora HSE',
      documentType: DocumentType.CC,
      workCenter: 'HSE',
      contractType: ContractType.INDEFINITE,
      employmentStatus: EmploymentStatus.ACTIVE,
      hireDate: new Date('2023-10-10T00:00:00.000Z'),
      email: 'diana.castro@industriasandinas.com',
      phone: '3005551103',
    },
  ];

  for (const employee of employees) {
    await prisma.employee.upsert({
      where: { document: employee.document },
      update: { ...employee, companyId: company.id, siteId: mainSite.id },
      create: { ...employee, companyId: company.id, siteId: mainSite.id },
    });
  }

  const risk = await prisma.risk.findFirst({
    where: { companyId: company.id, title: 'Trabajo en alturas en zona de mantenimiento' },
  });
  if (!risk) {
    await prisma.risk.create({
      data: {
        title: 'Trabajo en alturas en zona de mantenimiento',
        description: 'Riesgo de caida por actividades sobre plataformas y escaleras.',
        level: RiskLevel.HIGH,
        companyId: company.id,
        siteId: mainSite.id,
      },
    });
  }

  const incident = await prisma.incident.findFirst({
    where: { companyId: company.id, title: 'Casi accidente con montacargas' },
  });
  if (!incident) {
    await prisma.incident.create({
      data: {
        title: 'Casi accidente con montacargas',
        description: 'Cruce no controlado en bodega durante maniobra de carga.',
        date: new Date('2026-05-08T14:30:00.000Z'),
        status: IncidentStatus.IN_PROGRESS,
        companyId: company.id,
        siteId: mainSite.id,
      },
    });
  }

  const training = await prisma.training.findFirst({
    where: { companyId: company.id, title: 'Induccion SG-SST personal operativo' },
  });
  if (!training) {
    await prisma.training.create({
      data: {
        title: 'Induccion SG-SST personal operativo',
        description: 'Responsabilidades, reporte de incidentes y uso de EPP.',
        date: new Date('2026-05-20T13:00:00.000Z'),
        companyId: company.id,
        siteId: mainSite.id,
      },
    });
  }

  const document = await prisma.document.findFirst({
    where: { companyId: company.id, name: 'Politica de seguridad y salud en el trabajo' },
  });
  if (!document) {
    await prisma.document.create({
      data: {
        name: 'Politica de seguridad y salud en el trabajo',
        description: 'Documento base publicado para consulta y auditoria SG-SST.',
        category: DocumentCategory.POLICY,
        status: DocumentStatus.PUBLISHED,
        fileUrl: 'https://example.com/sgsst/politica-sst.pdf',
        fileName: 'politica-sst.pdf',
        mimeType: 'application/pdf',
        version: 1,
        expiresAt: new Date('2027-05-20T00:00:00.000Z'),
        companyId: company.id,
        versions: {
          create: {
            version: 1,
            fileUrl: 'https://example.com/sgsst/politica-sst.pdf',
            fileName: 'politica-sst.pdf',
            mimeType: 'application/pdf',
            notes: 'Version inicial de demostracion',
          },
        },
      },
    });
  }

  console.log(
    'Seed listo: admin@sgsst.com, sst@sgsst.com y empleado@sgsst.com / Admin12345',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
