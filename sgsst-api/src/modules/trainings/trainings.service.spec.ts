import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TrainingsService } from './trainings.service';

/**
 * Capacitaciones completas (#58):
 * - Alta con asistentes inline (employeeId o name; nombres del trabajador).
 * - Vencimiento derivado al PASSED: fecha + validityMonths (meses de 30 días).
 * - Evidencia y empleado en scope de empresa (404 si es ajena).
 * - Regla dura: máximo 200 asistentes por capacitación.
 */
describe('TrainingsService (#58)', () => {
  const repository = {
    findAll: jest.fn(),
    findByIdScoped: jest.fn(),
    findEmployeeScoped: jest.fn(),
    findAttendeeScoped: jest.fn(),
    create: jest.fn(),
    createAttendee: jest.fn(),
    updateAttendee: jest.fn(),
    countAttendeeExpirationBuckets: jest.fn(),
    findExpiringAttendees: jest.fn(),
  };
  const sitesRepository = { findByIdScoped: jest.fn() };
  const documentsRepository = { findByIdScoped: jest.fn() };

  const adminA = {
    sub: 'admin-a',
    email: 'admin-a@test.com',
    role: 'ADMIN',
    companyId: 'company-a',
    activeCompanyId: 'company-a',
  };
  const companyA = 'company-a';

  type ServiceInstance = InstanceType<typeof TrainingsService>;
  let service: ServiceInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TrainingsService(
      repository as never,
      sitesRepository as never,
      documentsRepository as never,
    );
  });

  describe('create con asistentes inline', () => {
    const date = '2026-01-15T10:00:00.000Z';

    it('congela el nombre del trabajador y deriva el vencimiento al PASSED', async () => {
      repository.findEmployeeScoped.mockResolvedValue({
        id: 'emp-1',
        firstName: 'QA',
        lastName: 'Operario A',
      });
      repository.create.mockResolvedValue({ id: 'training-1' });

      await service.create(adminA, {
        title: 'Inducción',
        date,
        validityMonths: 2,
        attendees: [{ employeeId: 'emp-1', status: 'PASSED', score: 95 }],
      } as never);

      expect(repository.create).toHaveBeenCalledWith(
        { title: 'Inducción', date, validityMonths: 2 },
        companyA,
        [
          expect.objectContaining({
            employeeId: 'emp-1',
            name: 'QA Operario A',
            status: 'PASSED',
            score: 95,
            // fecha + 2 meses de 30 días = 60 días después
            expiresAt: new Date(
              new Date(date).getTime() + 60 * 24 * 3600 * 1000,
            ),
          }),
        ],
      );
    });

    it('sin nombre ni employeeId rechaza con 400', async () => {
      await expect(
        service.create(adminA, {
          title: 'Inducción',
          date,
          attendees: [{}],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('más de MAX_ATTENDEES (200) rechaza con 400', async () => {
      const attendees = Array.from({ length: 201 }, () => ({ name: 'x' }));
      await expect(
        service.create(adminA, { title: 'X', date, attendees }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('employee de otra empresa no existe para el actor (404)', async () => {
      repository.findEmployeeScoped.mockResolvedValue(null);
      await expect(
        service.create(adminA, {
          title: 'X',
          date,
          attendees: [{ employeeId: 'emp-b' }],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('evidencia de otra empresa no existe para el actor (404)', async () => {
      documentsRepository.findByIdScoped.mockResolvedValue(null);
      await expect(
        service.create(adminA, {
          title: 'X',
          date,
          attendees: [{ name: 'Externo', evidenceId: 'doc-b' }],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateAttendee', () => {
    it('al pasar (PASSED) deriva el vencimiento con la vigencia del training', async () => {
      const trainingDate = new Date('2026-02-01T09:00:00.000Z');
      repository.findAttendeeScoped.mockResolvedValue({
        id: 'att-1',
        training: { id: 't-1', date: trainingDate, validityMonths: 3 },
      });
      repository.updateAttendee.mockResolvedValue({ id: 'att-1' });

      await service.updateAttendee(adminA, 'att-1', { status: 'PASSED' });

      expect(repository.updateAttendee).toHaveBeenCalledWith('att-1', {
        status: 'PASSED',
        expiresAt: new Date(trainingDate.getTime() + 90 * 24 * 3600 * 1000),
      });
    });

    it('expiresAt explícito tiene prioridad sobre el derivado', async () => {
      repository.findAttendeeScoped.mockResolvedValue({
        id: 'att-1',
        training: {
          id: 't-1',
          date: new Date('2026-02-01T09:00:00.000Z'),
          validityMonths: 3,
        },
      });
      repository.updateAttendee.mockResolvedValue({ id: 'att-1' });
      const explicit = '2027-01-01T00:00:00.000Z';

      await service.updateAttendee(adminA, 'att-1', {
        status: 'PASSED',
        expiresAt: explicit,
      });

      expect(repository.updateAttendee).toHaveBeenCalledWith('att-1', {
        status: 'PASSED',
        expiresAt: new Date(explicit),
      });
    });

    it('attendee de otra empresa no existe para el actor (404)', async () => {
      repository.findAttendeeScoped.mockResolvedValue(null);
      await expect(
        service.updateAttendee(adminA, 'att-2', { score: 10 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('evidencia en PATCH debe seguir en scope (404 si es ajena)', async () => {
      repository.findAttendeeScoped.mockResolvedValue({
        id: 'att-1',
        training: { validityMonths: null },
      });
      documentsRepository.findByIdScoped.mockResolvedValue(null);
      await expect(
        service.updateAttendee(adminA, 'att-1', { evidenceId: 'doc-b' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createAttendee', () => {
    it('capacitación llena rechaza por máximo de asistentes (400)', async () => {
      repository.findByIdScoped.mockResolvedValue({
        id: 't-1',
        date: new Date(),
        validityMonths: null,
        attendees: Array.from({ length: 200 }, (_, i) => ({ id: `a${i}` })),
      });
      // Employee válido para pasar las validaciones previas.
      repository.findEmployeeScoped.mockResolvedValue({
        id: 'emp-1',
        firstName: 'A',
        lastName: 'B',
      });
      documentsRepository.findByIdScoped.mockResolvedValue({ id: 'doc-1' });

      await expect(
        service.createAttendee(adminA, 't-1', {
          employeeId: 'emp-1',
          status: 'PASSED',
          evidenceId: 'doc-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('capacitación de otra empresa no existe para el actor (404)', async () => {
      repository.findByIdScoped.mockResolvedValue(null);
      await expect(
        service.createAttendee(adminA, 't-b', { name: 'Externo' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('expirations (dashboard de vencimientos)', () => {
    it('arma resumen (vencidos / próxima ventana) y detalle scoped', async () => {
      repository.countAttendeeExpirationBuckets.mockResolvedValue([2, 5]);
      repository.findExpiringAttendees.mockResolvedValue([{ id: 'att-1' }]);

      const result = await service.expirations(adminA, 60);

      expect(result).toMatchObject({
        windowDays: 60,
        summary: { expired: 2, expiringSoon: 5 },
      });
      expect(repository.countAttendeeExpirationBuckets).toHaveBeenCalledWith(
        companyA,
        expect.any(Date),
        expect.any(Date),
      );
      expect(repository.findExpiringAttendees).toHaveBeenCalledWith(
        companyA,
        expect.any(Date),
        expect.any(Date),
      );
    });
  });
});
