import { NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service';

describe('DocumentsService', () => {
  const documentsRepository = {
    findById: jest.fn(),
    findByIdScoped: jest.fn(),
  };
  const auditService = { log: jest.fn() };
  const documentsStorageService = { deleteDocumentFile: jest.fn() };
  const companyAUser = {
    sub: 'user-a',
    email: 'sst@company-a.test',
    role: 'SST',
    companyId: 'company-a',
    activeCompanyId: 'company-a',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects reading a document that belongs to another company', async () => {
    // Con aislamiento en consulta, el documento ajeno no existe para el actor (404).
    documentsRepository.findByIdScoped.mockResolvedValue(null);
    const service = new DocumentsService(
      documentsRepository as never,
      auditService as never,
      { findByIdScoped: jest.fn().mockResolvedValue(null) } as never,
      documentsStorageService as never,
    );

    await expect(
      service.findOne('document-b', companyAUser),
    ).rejects.toBeInstanceOf(NotFoundException);
    // Nunca consulta el documento global cuando hay scope de empresa.
    expect(documentsRepository.findById).not.toHaveBeenCalled();
  });
});
