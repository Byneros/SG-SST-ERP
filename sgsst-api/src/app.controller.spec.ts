import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const appService = {
      getHealth: jest.fn(() => ({
        status: 'ok' as const,
        service: 'sgsst-api',
        environment: 'test',
        timestamp: '2026-01-01T00:00:00.000Z',
      })),
      getReadiness: jest.fn(() =>
        Promise.resolve({
          status: 'ok' as const,
          service: 'sgsst-api',
          environment: 'test',
          timestamp: '2026-01-01T00:00:00.000Z',
          dependencies: { database: 'ok' as const, redis: 'ok' as const },
        }),
      ),
    };
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: appService }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return API health response', () => {
      expect(appController.getHealth()).toMatchObject({
        status: 'ok',
        service: 'sgsst-api',
      });
    });

    it('should return dependency readiness', async () => {
      await expect(appController.getReadiness()).resolves.toMatchObject({
        status: 'ok',
        dependencies: { database: 'ok', redis: 'ok' },
      });
    });
  });
});
