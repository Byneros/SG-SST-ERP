/**
 * Purga one-off de soft-deletes legacy en SgsstEvaluation e Indicator.
 *
 * Contexto: hasta 3c730b6 el DELETE de evaluaciones e indicadores era soft
 * delete (isActive=false + deletedAt). Esas filas legacy siguen en BD (dev ya
 * se limpio a mano; prod no) y bloquean reusar un Indicator.code
 * (@@unique([companyId, code]) incluye filas borradas).
 *
 * Uso (desde sgsst-api):
 *   npm run purge:soft-deletes          # DRY-RUN: solo conteos
 *   PURGE_EXECUTE=1 npm run purge:soft-deletes
 *
 * Seguro por diseno:
 * - Sin PURGE_EXECUTE=1 NO escribe nada (dry-run).
 * - Los deletes aprovechan onDelete: Cascade del esquema (items, metas y
 *   mediciones se eliminan con su padre en la misma sentencia).
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const execute = process.env.PURGE_EXECUTE === '1';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }),
});

async function main() {
  const mode = execute ? 'EJECUCION' : 'DRY-RUN (usa PURGE_EXECUTE=1 para aplicar)';
  console.log(`Purga de soft-deletes legacy — modo: ${mode}`);

  const [evaluations, indicators, items, targets, measurements] =
    await Promise.all([
      prisma.sgsstEvaluation.count({ where: { deletedAt: { not: null } } }),
      prisma.indicator.count({ where: { deletedAt: { not: null } } }),
      prisma.evaluationItem.count({
        where: { evaluation: { deletedAt: { not: null } } },
      }),
      prisma.indicatorTarget.count({
        where: { indicator: { deletedAt: { not: null } } },
      }),
      prisma.indicatorMeasurement.count({
        where: { indicator: { deletedAt: { not: null } } },
      }),
    ]);

  console.log('Filas a eliminar:');
  console.log(`  SgsstEvaluation (deletedAt != null): ${evaluations}`);
  console.log(`  EvaluationItem (cascada):            ${items}`);
  console.log(`  Indicator (deletedAt != null):       ${indicators}`);
  console.log(`  IndicatorTarget (cascada):           ${targets}`);
  console.log(`  IndicatorMeasurement (cascada):      ${measurements}`);

  if (!execute) {
    console.log('Dry-run completado: no se elimino nada.');
    return;
  }

  const [deletedEvaluations, deletedIndicators] = await prisma.$transaction([
    prisma.sgsstEvaluation.deleteMany({ where: { deletedAt: { not: null } } }),
    prisma.indicator.deleteMany({ where: { deletedAt: { not: null } } }),
  ]);

  console.log(
    `Eliminadas: ${deletedEvaluations.count} evaluaciones (con sus items en cascada)`,
  );
  console.log(
    `Eliminados: ${deletedIndicators.count} indicadores (con metas y mediciones en cascada)`,
  );
}

main()
  .catch((error) => {
    console.error('Purga fallida:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
