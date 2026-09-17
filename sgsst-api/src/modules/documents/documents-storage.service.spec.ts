import { BadRequestException } from '@nestjs/common';
import { DocumentsStorageService } from './documents-storage.service';

describe('DocumentsStorageService', () => {
  it('rejects a document storage reference that attempts path traversal', async () => {
    const storage = new DocumentsStorageService();

    await expect(
      storage.readDocument('storage://documents/../.env'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
