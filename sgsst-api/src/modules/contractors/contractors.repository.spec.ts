import { ContractorsRepository } from './contractors.repository';

/**
 * getCompliance agrega por estado (groupBy) dentro de $transaction y decide si
 * se autoriza el ingreso del contratista. Regla (doc funcional §8): no se
 * autoriza con documentos vencidos/rechazados/pendientes, contratista inactivo
 * o sin documentos.
 */
describe('ContractorsRepository - getCompliance', () => {
  const prisma = {
    contractorDocument: { groupBy: jest.fn() },
    contractorWorker: { groupBy: jest.fn() },
    contractor: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };

  const repository = new ContractorsRepository(prisma as never);

  const companyId = 'company-a';
  const contractorId = 'contractor-a';

  /** Filas que devuelven los groupBy dentro de la transaccion. */
  type Row = { status: string; _count: { _all: number } };

  function mockTransaction(
    docRows: Row[],
    workerRows: Row[],
    contractor: { id: string; status: string; name: string } | null,
  ) {
    prisma.$transaction.mockImplementationOnce(() => [
      docRows,
      workerRows,
      contractor,
    ]);
  }

  /** Verifica que los agregados queden scoped por empresa y contratista. */
  type WhereArgs = { where: unknown };
  function firstCallArg<M extends { mock: { calls: unknown[][] } }>(
    mock: M,
  ): WhereArgs | undefined {
    return mock.mock.calls[0]?.[0] as WhereArgs | undefined;
  }

  function expectScopedQueries() {
    const docArgs = firstCallArg(prisma.contractorDocument.groupBy);
    const workerArgs = firstCallArg(prisma.contractorWorker.groupBy);
    const contractorArgs = firstCallArg(prisma.contractor.findFirst);
    expect(docArgs?.where).toEqual({ contractorId, companyId });
    expect(workerArgs?.where).toEqual({ contractorId, companyId });
    expect(contractorArgs?.where).toEqual({ id: contractorId, companyId });
  }

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('autoriza el ingreso con contratista ACTIVE y todos los documentos validos', async () => {
    mockTransaction(
      [{ status: 'VALID', _count: { _all: 3 } }],
      [{ status: 'ACTIVE', _count: { _all: 2 } }],
      { id: contractorId, status: 'ACTIVE', name: 'Seguridad SAS' },
    );

    const result = await repository.getCompliance(contractorId, companyId);

    expectScopedQueries();
    expect(result.canAuthorizeEntry).toBe(true);
    expect(result.documentsTotal).toBe(3);
    expect(result.workersTotal).toBe(2);
    expect(result.workersActive).toBe(2);
    expect(result.blockingReasons).toEqual([]);
  });

  it('bloquea con documentos vencidos y lista la razon', async () => {
    mockTransaction(
      [
        { status: 'VALID', _count: { _all: 1 } },
        { status: 'EXPIRED', _count: { _all: 2 } },
      ],
      [{ status: 'ACTIVE', _count: { _all: 1 } }],
      { id: contractorId, status: 'ACTIVE', name: 'Seguridad SAS' },
    );

    const result = await repository.getCompliance(contractorId, companyId);

    expect(result.canAuthorizeEntry).toBe(false);
    expect(result.blockingReasons).toContain(
      'documentos vencidos o rechazados',
    );
  });

  it('bloquea con documentos rechazados', async () => {
    mockTransaction(
      [{ status: 'REJECTED', _count: { _all: 1 } }],
      [{ status: 'ACTIVE', _count: { _all: 1 } }],
      { id: contractorId, status: 'ACTIVE', name: 'Seguridad SAS' },
    );

    const result = await repository.getCompliance(contractorId, companyId);

    expect(result.canAuthorizeEntry).toBe(false);
    expect(result.blockingReasons).toContain(
      'documentos vencidos o rechazados',
    );
  });

  it('bloquea con documentos pendientes de validacion', async () => {
    mockTransaction(
      [{ status: 'PENDING', _count: { _all: 4 } }],
      [{ status: 'ACTIVE', _count: { _all: 1 } }],
      { id: contractorId, status: 'ACTIVE', name: 'Seguridad SAS' },
    );

    const result = await repository.getCompliance(contractorId, companyId);

    expect(result.canAuthorizeEntry).toBe(false);
    expect(result.blockingReasons).toContain(
      'documentos pendientes de validacion',
    );
  });

  it('bloquea con contratista SUSPENDED e indica el estado como razon', async () => {
    mockTransaction(
      [{ status: 'VALID', _count: { _all: 1 } }],
      [{ status: 'ACTIVE', _count: { _all: 1 } }],
      { id: contractorId, status: 'SUSPENDED', name: 'Seguridad SAS' },
    );

    const result = await repository.getCompliance(contractorId, companyId);

    expect(result.canAuthorizeEntry).toBe(false);
    expect(result.blockingReasons).toContain('contratista suspended');
  });

  it('bloquea cuando el contratista no existe (o es de otra empresa)', async () => {
    mockTransaction([], [], null);

    const result = await repository.getCompliance(contractorId, companyId);

    expect(result.canAuthorizeEntry).toBe(false);
    expect(result.contractor).toBeNull();
    expect(result.blockingReasons).toContain('sin documentos registrados');
  });

  it('bloquea sin documentos registrados', async () => {
    mockTransaction([], [{ status: 'ACTIVE', _count: { _all: 1 } }], {
      id: contractorId,
      status: 'ACTIVE',
      name: 'Seguridad SAS',
    });

    const result = await repository.getCompliance(contractorId, companyId);

    expect(result.canAuthorizeEntry).toBe(false);
    expect(result.blockingReasons).toContain('sin documentos registrados');
  });

  it('agrupa correctamente cuando hay varios estados a la vez', async () => {
    mockTransaction(
      [
        { status: 'VALID', _count: { _all: 2 } },
        { status: 'PENDING', _count: { _all: 1 } },
        { status: 'EXPIRED', _count: { _all: 3 } },
      ],
      [
        { status: 'ACTIVE', _count: { _all: 5 } },
        { status: 'INACTIVE', _count: { _all: 1 } },
      ],
      { id: contractorId, status: 'ACTIVE', name: 'Seguridad SAS' },
    );

    const result = await repository.getCompliance(contractorId, companyId);

    expect(result.byDocumentStatus).toEqual({
      VALID: 2,
      PENDING: 1,
      EXPIRED: 3,
    });
    expect(result.workersTotal).toBe(6);
    expect(result.workersActive).toBe(5);
    expect(result.canAuthorizeEntry).toBe(false);
  });
});
