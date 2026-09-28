import {
  buildHelpContext,
  findHelpTopics,
  findNormSources,
  HELP_TOPICS,
  NORM_SOURCES,
} from './ai-assistant.knowledge';

/**
 * Pruebas de la base de conocimiento curada (Sprint 16, tareas 16.4 y 16.5).
 *
 * - Contenido basado en modulos reales del ERP; normas verificables del repo.
 * - 16.5: indice de fuentes con vigencia y secciones verificadas; las normas
 *   derogadas nunca se citan como vigentes.
 * - Recuperacion tolerante a acentos/mayusculas y con fallback seguro.
 */
describe('ai-assistant.knowledge', () => {
  it('cubre los modulos implementados del ERP con keywords y normas', () => {
    expect(HELP_TOPICS.length).toBeGreaterThanOrEqual(12);
    for (const topic of HELP_TOPICS) {
      expect(topic.title).toBeTruthy();
      expect(topic.view).toBeTruthy();
      expect(topic.what.length).toBeGreaterThan(40);
      expect(topic.keywords.length).toBeGreaterThan(2);
      expect(topic.norms.length).toBeGreaterThan(0);
    }
  });

  it('solo cita normas presentes en el indice de fuentes verificado (16.5)', () => {
    const allowed = new Set(NORM_SOURCES.map((norm) => norm.name));
    for (const topic of HELP_TOPICS) {
      for (const norm of topic.norms) {
        expect(allowed.has(norm)).toBe(true);
      }
    }
  });

  it('incluye las normas obligatorias del marco SG-SST colombiano', () => {
    const names = NORM_SOURCES.map((norm) => norm.name);
    expect(names).toContain('Decreto 1072 de 2015');
    expect(names).toContain('Resolucion 0312 de 2019');
    expect(names).toContain('Ley 1562 de 2012');
    expect(names).toContain('Resolucion 1401 de 2007');
    expect(names).toContain('Resolucion 1843 de 2025');
    expect(names).toContain('GTC 45');
  });

  it('marca la Resolucion 2346 de 2007 como derogada por la 1843 de 2025', () => {
    const derogada = NORM_SOURCES.find(
      (norm) => norm.name === 'Resolucion 2346 de 2007',
    );
    expect(derogada?.status).toBe('derogada');
    expect(derogada?.replacedBy).toBe('Resolucion 1843 de 2025');
    // Todas las entradas declaran cuando fueron verificadas.
    for (const norm of NORM_SOURCES) {
      expect(norm.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(norm.sections.length).toBeGreaterThan(0);
    }
  });

  it('findNormSources resuelve fuentes por palabras clave con acentos', () => {
    const pat = findNormSources('¿Qué dice la norma sobre el plan anual de trabajo?');
    expect(pat.map((norm) => norm.name)).toContain('Decreto 1072 de 2015');

    const investigacion = findNormSources('como investigo un ACCIDENTE de trabajo');
    expect(investigacion.map((norm) => norm.name)).toContain(
      'Resolucion 1401 de 2007',
    );

    const examenes = findNormSources('vigencia del examen ocupacional');
    expect(examenes.map((norm) => norm.name)).toContain('Resolucion 1843 de 2025');
  });

  it('findNormSources no devuelve fuentes cuando la consulta no es normativa', () => {
    expect(findNormSources('como cambio mi contrasena')).toEqual([]);
    expect(findNormSources('')).toEqual([]);
  });

  it('buildHelpContext inyecta modulos relevantes y secciones verificadas', () => {
    const context = buildHelpContext('como creo un riesgo nuevo');
    expect(context).toContain('Riesgos y matriz de peligros');
    expect(context).toContain('GTC 45');
    expect(context).toContain('no cites normas que no esten en esta lista');
    // 16.5: secciones exactas citables dentro del contexto.
    expect(context).toContain('Articulo 2.2.4.6.15');
    expect(context).toContain('Secciones verificadas');
  });

  it('buildHelpContext marca la norma derogada para que el modelo no la cite', () => {
    const context = buildHelpContext('examenes medicos ocupacionales');
    expect(context).toContain('Resolucion 1843 de 2025');
    expect(context).toContain('[DEROGADA por Resolucion 1843 de 2025');
    expect(context).toContain('no la cites como vigente');
  });

  it('recupera temas por palabras clave con acentos y mayusculas', () => {
    const riesgos = findHelpTopics('¿Cómo valoro un PELIGRO en la matriz?');
    expect(riesgos[0].title).toContain('Riesgos');

    const capacitaciones = findHelpTopics('necesito agendar una Capacitación');
    expect(capacitaciones[0].title).toContain('Capacitaciones');

    const examenes = findHelpTopics('cuando me toca el examen ocupacional');
    expect(examenes.some((topic) => topic.title.includes('Medicina'))).toBe(
      true,
    );
  });

  it('devuelve contexto general cuando nada coincide (fallback)', () => {
    const topics = findHelpTopics('zzz texto sin relation con modulos');
    expect(topics).toHaveLength(4);
  });

  it('no ofrece como propios los modulos no implementados del ERP', () => {
    const text = HELP_TOPICS.map(
      (topic) => `${topic.title} ${topic.what}`,
    ).join(' ');
    expect(text).not.toContain('emergencias');
    expect(text).not.toContain('contratistas');
  });
});
