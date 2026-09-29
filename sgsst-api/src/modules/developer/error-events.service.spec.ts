import { ErrorEventsService } from './error-events.service';

describe('ErrorEventsService (ring buffer)', () => {
  it('registra y devuelve los eventos, el mas reciente primero', () => {
    const service = new ErrorEventsService();
    service.record({ level: 'error', context: 'Auth', message: 'fallo 1' });
    service.record({ level: 'warn', context: 'Reports', message: 'aviso 2' });

    const events = service.latest();
    expect(events).toHaveLength(2);
    expect(events[0]?.level).toBe('warn');
    expect(events[0]?.message).toBe('aviso 2');
    expect(events[1]?.message).toBe('fallo 1');
    expect(service.count()).toBe(2);
  });

  it('recorta mensajes y traces largos (sin secretos ni stacks gigantes)', () => {
    const service = new ErrorEventsService();
    service.record({
      level: 'error',
      context: 'X'.repeat(500),
      message: 'm'.repeat(10_000),
      trace: 't'.repeat(20_000),
    });

    const [event] = service.latest();
    // +1 por el caracter de suspension "…" anadido al truncar.
    expect(event?.context.length).toBeLessThanOrEqual(201);
    expect(event?.message.length).toBeLessThanOrEqual(2_001);
    expect(event?.trace?.length).toBeLessThanOrEqual(4_001);
  });

  it('respeta el limite de 200 eventos (FIFO)', () => {
    const service = new ErrorEventsService();
    for (let i = 0; i < 250; i += 1) {
      service.record({
        level: 'error',
        context: 'ctx',
        message: `evento ${i}`,
      });
    }
    expect(service.count()).toBe(200);
    // latest() por defecto devuelve 100 (el mas reciente primero).
    const events = service.latest();
    expect(events[0]?.message).toBe('evento 249');
    expect(events[events.length - 1]?.message).toBe('evento 150');
    // Con limite 200 cubre todo el buffer retenido: 0..49 se descartaron.
    const all = service.latest(200);
    expect(all[0]?.message).toBe('evento 249');
    expect(all[all.length - 1]?.message).toBe('evento 50');
  });
});
