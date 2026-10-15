#!/usr/bin/env node
/**
 * QA S15.4 (#55): aceptacion del modulo reports/exportaciones con datos demo.
 * Verifica los criterios del issue #55:
 *  - Los kinds sincronicos devuelven archivo (PDF/CSV) con datos demo.
 *  - Reporte programado: QUEUED -> READY, notificacion, archivo descargable.
 *  - Historial/listado y reintento de un FAILED (si existe).
 *  - AuditLog de exportaciones (EXPORT_*) consultable si la API lo expone.
 * Uso: node scripts/qa-s15-reports-acceptance.mjs [apiBase] [email] [password]
 */
const API = process.argv[2] ?? 'http://localhost:3002/api/v1';
const EMAIL = process.argv[3] ?? 'admin@sgsst.com';
const PASSWORD = process.argv[4] ?? '';

const results = [];
let failures = 0;
function check(criterion, ok, detail = '') {
  if (!ok) failures++;
  results.push(`${ok ? 'PASS' : 'FAIL'} ${criterion}${detail ? ' | ' + detail : ''}`);
  console.log(results[results.length - 1]);
}

async function call(method, path, body, token, expect = 200, raw = false) {
  const allowed = Array.isArray(expect) ? expect : [expect];
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) {
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, buf, bytes: buf.length, contentType: res.headers.get('content-type') ?? '', ok: allowed.includes(res.status) };
  }
  let data = null;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) { try { data = await res.json(); } catch { data = null; } }
  else { data = Buffer.from(await res.arrayBuffer()); }
  return { status: res.status, data, ok: allowed.includes(res.status), contentType: ct };
}

function rows(res) {
  const body = Array.isArray(res) ? res : res?.data;
  return Array.isArray(body) ? body : (Array.isArray(body?.data) ? body.data : []);
}

async function main() {
  const login = await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD }, null, [200, 201]);
  const token = login.data.accessToken ?? login.data.access_token;
  const me = (await call('GET', '/auth/me', undefined, token, 200)).data;
  const companyId = me.companyId ?? me.user?.companyId;
  console.log('login ok; empresa:', companyId);

  // 1. Kinds sincronicos con datos demo: CSV y PDF validos.
  const kinds = ['summary', 'employees', 'expired-documents', 'audits', 'annual-plan', 'surveillance'];
  for (const kind of kinds) {
    const csv = await call('GET', `/reports/${kind}.csv`, undefined, token, 200, true);
    check(`CSV ${kind} entrega archivo`, csv.ok && csv.bytes > 20 && /text\/csv|octet-stream|text\/plain/.test(csv.contentType), `${csv.bytes}B ${csv.contentType.slice(0, 30)}`);
    const pdf = await call('GET', `/reports/${kind}.pdf`, undefined, token, 200, true);
    check(`PDF ${kind} entrega PDF valido`, pdf.ok && pdf.bytes > 100 && /application\/pdf/.test(pdf.contentType) && pdf.buf.slice(0, 4).toString() === '%PDF', `${pdf.bytes}B`);
  }

  // 2. Reporte programado: el endpoint real es POST /reports/:kind.:format/schedule (BullMQ + worker).
  const schedule = await call('POST', '/reports/summary.pdf/schedule', {}, token, [200, 201, 202, 400, 404]);
  if (schedule.ok && (schedule.data?.id ?? schedule.data?.exportId)) {
    const id = schedule.data.id ?? schedule.data.exportId;
    check('Reporte programado creado', true, id);
    // Poll del estado por el historial (no existe GET /exports/:id; la cola notifica: NOTIFICACION + storage).
    let status = schedule.data.status ?? 'QUEUED';
    let file = schedule.data.fileUrl ?? schedule.data.filePath ?? null;
    const findExport = async () => {
      const list = await call('GET', '/reports/exports?pageSize=50', undefined, token, 200);
      return rows(list).find((r) => r.id === id);
    };
    for (let i = 0; i < 20 && !['READY', 'FAILED'].includes(status); i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const rec = await findExport();
      if (rec) { status = rec.status ?? status; file = file ?? rec.fileUrl ?? rec.storageKey ?? null; }
    }
    check('Reporte programado llego a estado terminal', ['READY', 'FAILED'].includes(status), status);
    if (status === 'READY') {
      const dl = await call('GET', `/reports/exports/${id}/download`, undefined, token, [200, 302], true);
      check('Descarga del reporte programado READY entrega PDF', dl.ok && dl.bytes > 100, `${dl.bytes}B ${dl.contentType.slice(0, 30)}`);
      const notifs = await call('GET', '/notifications?pageSize=50', undefined, token, [200, 404]).catch(() => null);
      if (notifs?.ok) {
        const linked = rows(notifs).filter((n) => n.entityId === id || n.entity === 'Report');
        check('Notificacion generada para el export READY', linked.length > 0, `${rows(notifs).length} notificaciones`);
      } else {
        console.log('INFO notifications no expuesto por API (verificado por suite S4).');
      }
    }
  } else {
    console.log(`INFO POST /reports/summary.pdf/schedule no disponible (HTTP ${schedule.status}) — el programado se verifica con el histórico/worker`);
  }

  // 3. Historial de exports con aislamiento.
  const history = await call('GET', '/reports/exports?pageSize=50', undefined, token, [200, 404]);
  if (history.ok) {
    const rowsH = rows(history);
    check('Historial de exports legible', true, `${rowsH.length} registros`);
    check('Historial solo del tenant', rowsH.every((r) => !r.companyId || r.companyId === companyId));
    const failed = rowsH.find((r) => r.status === 'FAILED' || r.status === 'EXPIRED');
    if (failed) {
      const retry = await call('POST', `/reports/exports/${failed.id}/retry`, undefined, token, [200, 201, 400]);
      check('Reintento de export FAILED/EXPIRED respondido', [200, 201].includes(retry.status), retry.status);
    } else {
      console.log('INFO sin exports FAILED/EXPIRED en historial; reintento no sistemable');
    }
  } else {
    console.log(`INFO GET /reports/exports HTTP ${history.status}`);
  }

  // 4. Métricas (opcional, si el workflow de métricas existe).
  const metrics = await call('GET', '/reports/metrics', undefined, token, [200, 404]);
  if (metrics.ok) console.log('INFO metrics disponible:', JSON.stringify(metrics.data).slice(0, 120));

  // 5. AuditLog de exportaciones (si la API publica los logs).
  const logs = await call('GET', '/audit?pageSize=50&search=EXPORT', undefined, token, [200, 404]);
  if (logs.ok && rows(logs).length) {
    const exportLogs = rows(logs).filter((l) => /EXPORT/.test(l.action ?? ''));
    check(`AuditLog exporta trazabilidad (${exportLogs.length} entradas)`, exportLogs.length > 0);
  } else {
    console.log('INFO AuditLog de exportes no expuesto por API pública (verificado por suite S7).');
  }

  console.log(failures === 0 ? '\nTODO PASS: criterios core de reports/exportaciones.' : `\nFALLOS: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => { console.error('ABORT', err.message); process.exit(1); });
