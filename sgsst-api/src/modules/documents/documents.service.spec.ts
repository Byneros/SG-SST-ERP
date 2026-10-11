import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service';

describe('DocumentsService', () => {
  const documentsRepository = {
    findById: jest.fn(),
    findByIdScoped: jest.fn(),
    approveScoped: jest.fn(),
    transitionStatusScoped: jest.fn(),
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

  it('approves a draft only in the authenticated company and audits it', async () => {
    const draft = {
      id: 'document-a',
      companyId: 'company-a',
      status: 'DRAFT',
      version: 2,
    };
    const published = { ...draft, status: 'PUBLISHED' };
    documentsRepository.findByIdScoped.mockResolvedValue(draft);
    documentsRepository.approveScoped.mockResolvedValue(published);
    const service = new DocumentsService(
      documentsRepository as never,
      auditService as never,
      { findByIdScoped: jest.fn() } as never,
      documentsStorageService as never,
    );

    await expect(
      service.approve(
        'document-a',
        { comments: 'Aprobado para publicar' },
        companyAUser,
      ),
    ).resolves.toEqual(published);

    expect(documentsRepository.approveScoped).toHaveBeenCalledWith(
      'document-a',
      'company-a',
      'user-a',
      'Aprobado para publicar',
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'APPROVE',
        entity: 'Document',
        entityId: 'document-a',
      }),
    );
  });

  it('rejects approval when the document is not a draft', async () => {
    documentsRepository.findByIdScoped.mockResolvedValue({
      id: 'document-a',
      companyId: 'company-a',
      status: 'PUBLISHED',
    });
    const service = new DocumentsService(
      documentsRepository as never,
      auditService as never,
      { findByIdScoped: jest.fn() } as never,
      documentsStorageService as never,
    );

    await expect(
      service.approve('document-a', {}, companyAUser),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(documentsRepository.approveScoped).not.toHaveBeenCalled();
  });

  it('expires only a published document whose date has passed and audits it', async () => {
    const before = {
      id: 'document-a',
      companyId: 'company-a',
      status: 'PUBLISHED',
      expiresAt: new Date('2020-01-01T00:00:00.000Z'),
    };
    const expired = { ...before, status: 'EXPIRED' };
    documentsRepository.findByIdScoped.mockResolvedValue(before);
    documentsRepository.transitionStatusScoped.mockResolvedValue(expired);
    const service = new DocumentsService(
      documentsRepository as never,
      auditService as never,
      { findByIdScoped: jest.fn() } as never,
      documentsStorageService as never,
    );

    await expect(service.expire('document-a', companyAUser)).resolves.toEqual(
      expired,
    );
    expect(documentsRepository.transitionStatusScoped).toHaveBeenCalledWith(
      'document-a',
      'company-a',
      'EXPIRED',
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EXPIRE',
        entity: 'Document',
        entityId: 'document-a',
      }),
    );
  });
});
