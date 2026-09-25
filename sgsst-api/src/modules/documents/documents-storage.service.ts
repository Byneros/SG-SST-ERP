import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type ServerSideEncryption,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { env } from '../../config/env';

type UploadedDocumentFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
};

const allowedMimeTypes = new Set([
  'application/pdf',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

@Injectable()
export class DocumentsStorageService {
  private s3Client?: S3Client;

  async upload(file?: UploadedDocumentFile) {
    return this.uploadToFolder('documents', file);
  }

  async uploadReport(file?: UploadedDocumentFile) {
    return this.uploadToFolder('reports', file);
  }

  async delete(storageKey?: string | null) {
    if (!storageKey) {
      return { deleted: false };
    }
    if (!storageKey.startsWith('reports/')) {
      throw new BadRequestException(
        'Only generated report files can be removed by cleanup',
      );
    }
    if (env.documentStorageDriver === 's3') {
      await this.deleteFromS3(storageKey);
      return { deleted: true };
    }
    if (env.documentStorageDriver !== 'local') {
      throw new BadRequestException(
        'Configured document storage driver is not supported',
      );
    }

    const uploadsRoot = resolve(env.uploadsPath);
    const target = resolve(env.uploadsPath, storageKey);
    if (target !== uploadsRoot && !target.startsWith(`${uploadsRoot}${sep}`)) {
      throw new BadRequestException('Invalid storage key');
    }
    try {
      await unlink(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
    return { deleted: true };
  }

  /**
   * Elimina el archivo de un documento de la carpeta `documents/` (local o S3).
   * Parte del hard delete de Document (ADR de borrado): al eliminar la fila se
   * elimina tambien el artefacto fisico en la misma operacion.
   */
  async deleteDocumentFile(fileUrl?: string | null) {
    if (!fileUrl) {
      return { deleted: false };
    }
    // URLs legacy/externas (fuera del storage gestionado) no se tocan: no hay
    // artefacto propio que eliminar y el delete de la fila no debe fallar.
    let storageKey: string;
    try {
      storageKey = this.documentStorageKey(fileUrl);
    } catch {
      return { deleted: false };
    }
    if (env.documentStorageDriver === 's3') {
      await this.deleteFromS3(storageKey);
      return { deleted: true };
    }
    if (env.documentStorageDriver !== 'local') {
      throw new BadRequestException(
        'Configured document storage driver is not supported',
      );
    }

    const uploadsRoot = resolve(env.uploadsPath);
    const target = resolve(env.uploadsPath, storageKey);
    if (target !== uploadsRoot && !target.startsWith(`${uploadsRoot}${sep}`)) {
      throw new BadRequestException('Invalid storage key');
    }
    try {
      await unlink(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
    return { deleted: true };
  }

  async readDocument(fileUrl: string): Promise<Buffer> {
    const storageKey = this.documentStorageKey(fileUrl);
    if (env.documentStorageDriver === 's3') {
      return this.readFromS3(storageKey);
    }
    if (env.documentStorageDriver !== 'local') {
      throw new BadRequestException(
        'Configured document storage driver is not supported',
      );
    }

    const uploadsRoot = resolve(env.uploadsPath);
    const target = resolve(uploadsRoot, storageKey);
    if (!target.startsWith(`${uploadsRoot}${sep}`)) {
      throw new BadRequestException('Invalid document storage key');
    }
    return readFile(target);
  }

  async readReport(storageKey: string): Promise<Buffer> {
    if (!storageKey.startsWith('reports/') || storageKey.includes('..')) {
      throw new BadRequestException('Invalid report storage key');
    }
    if (env.documentStorageDriver === 's3') {
      return this.readFromS3(storageKey);
    }
    if (env.documentStorageDriver !== 'local') {
      throw new BadRequestException(
        'Configured document storage driver is not supported',
      );
    }

    const uploadsRoot = resolve(env.uploadsPath);
    const target = resolve(uploadsRoot, storageKey);
    if (!target.startsWith(`${uploadsRoot}${sep}`)) {
      throw new BadRequestException('Invalid report storage key');
    }
    return readFile(target);
  }

  private async uploadToFolder(
    folder: 'documents' | 'reports',
    file?: UploadedDocumentFile,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!file.buffer) {
      throw new BadRequestException('File content is empty');
    }
    if (file.size > env.maxUploadBytes) {
      throw new BadRequestException('File exceeds maximum allowed size');
    }
    if (!allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException('File type is not allowed');
    }
    const extension = extname(file.originalname).toLowerCase();
    const storageName = `${randomUUID()}${extension}`;

    if (env.documentStorageDriver === 's3') {
      return this.uploadToS3(file, `${folder}/${storageName}`);
    }
    if (env.documentStorageDriver !== 'local') {
      throw new BadRequestException(
        'Configured document storage driver is not supported',
      );
    }

    const uploadRoot = resolve(env.uploadsPath, folder);
    await mkdir(uploadRoot, { recursive: true });

    const storagePath = join(uploadRoot, storageName);
    await writeFile(storagePath, file.buffer);

    return {
      fileUrl: this.privateStorageUrl(folder, storageName),
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      storageDriver: env.documentStorageDriver,
      storageKey: `${folder}/${storageName}`,
    };
  }

  private async uploadToS3(file: UploadedDocumentFile, storageKey: string) {
    if (!env.s3Bucket || !env.s3AccessKeyId || !env.s3SecretAccessKey) {
      throw new BadRequestException('S3 storage is not configured');
    }

    await this.getS3Client().send(
      new PutObjectCommand({
        Bucket: env.s3Bucket,
        Key: storageKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        ServerSideEncryption: (env.s3ServerSideEncryption || undefined) as
          ServerSideEncryption | undefined,
        Metadata: {
          originalName: file.originalname,
        },
      }),
    );

    return {
      fileUrl: `storage://${storageKey}`,
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      storageDriver: env.documentStorageDriver,
      storageKey,
    };
  }

  private documentStorageKey(fileUrl: string) {
    if (fileUrl.startsWith('storage://documents/')) {
      const fileName = fileUrl.slice('storage://documents/'.length);
      if (fileName && !fileName.includes('/') && !fileName.includes('..')) {
        return `documents/${fileName}`;
      }
    }
    try {
      const pathname = new URL(fileUrl).pathname;
      const marker = '/documents/';
      const markerIndex = pathname.indexOf(marker);
      if (markerIndex >= 0) {
        const fileName = pathname.slice(markerIndex + marker.length);
        if (fileName && !fileName.includes('/') && !fileName.includes('..')) {
          return `documents/${fileName}`;
        }
      }
    } catch {
      // Persisted legacy URLs are validated below and cannot escape storage.
    }
    throw new BadRequestException('Document is not stored in managed storage');
  }

  private privateStorageUrl(
    folder: 'documents' | 'reports',
    storageName: string,
  ) {
    return `storage://${folder}/${storageName}`;
  }

  private async readFromS3(storageKey: string): Promise<Buffer> {
    if (!env.s3Bucket || !env.s3AccessKeyId || !env.s3SecretAccessKey) {
      throw new BadRequestException('S3 storage is not configured');
    }
    const response = await this.getS3Client().send(
      new GetObjectCommand({ Bucket: env.s3Bucket, Key: storageKey }),
    );
    if (!response.Body) {
      throw new BadRequestException('Document content is empty');
    }
    return Buffer.from(await response.Body.transformToByteArray());
  }

  private getS3Client() {
    this.s3Client =
      this.s3Client ??
      new S3Client({
        region: env.s3Region,
        endpoint: env.s3Endpoint,
        forcePathStyle: env.s3ForcePathStyle,
        credentials: {
          accessKeyId: env.s3AccessKeyId,
          secretAccessKey: env.s3SecretAccessKey,
        },
      });
    return this.s3Client;
  }

  private async deleteFromS3(storageKey: string) {
    if (!env.s3Bucket || !env.s3AccessKeyId || !env.s3SecretAccessKey) {
      throw new BadRequestException('S3 storage is not configured');
    }
    await this.getS3Client().send(
      new DeleteObjectCommand({
        Bucket: env.s3Bucket,
        Key: storageKey,
      }),
    );
  }
}
