import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from '@mui/material'
import type {
  Company,
  MedicalExamFormValues,
  MedicalProfileFormValues,
  MedicalRestrictionFormValues,
  MedicalSurveillanceProgramFormValues,
  PveCaseFormValues,
  PveDiagnosisFormValues,
} from '../../types'

const examTypes = ['INGRESO', 'PERIODICO', 'RETIRO', 'POSTINCAPACIDAD', 'CAMBIO_CARGO']
const concepts = ['PENDIENTE', 'APTO', 'APTO_RESTRICCION', 'NO_APTO']

export function MedicalProfileDialog(props: {
  open: boolean
  values: MedicalProfileFormValues
  companies: Company[]
  risks?: Array<{ id: string; title: string; level: string; position?: string }>
  loading: boolean
  canPickCompany: boolean
  onChange: (values: MedicalProfileFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Nuevo profesiograma</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Cargo"
            value={props.values.position}
            onChange={(event) => props.onChange({ ...props.values, position: event.target.value })}
            required
          />
          <TextField
            label="Descripcion"
            value={props.values.description}
            onChange={(event) => props.onChange({ ...props.values, description: event.target.value })}
            multiline
            minRows={2}
          />
          <TextField
            select
            label="Requisito (tipo de examen)"
            value={props.values.examType}
            onChange={(event) => props.onChange({ ...props.values, examType: event.target.value })}
            helperText="Se agrega al crear el profesiograma"
          >
            {examTypes.map((type) => (
              <MenuItem key={type} value={type}>{type}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Riesgo del cargo (opcional)"
            value={props.values.riskId ?? ''}
            onChange={(event) => props.onChange({ ...props.values, riskId: event.target.value })}
            helperText="Habilita la derivacion de requisitos desde la matriz GTC-45"
          >
            <MenuItem value="">Sin riesgo asociado</MenuItem>
            {(props.risks ?? []).map((risk) => (
              <MenuItem key={risk.id} value={risk.id}>
                {risk.title} ({risk.level}){risk.position ? ` - ${risk.position}` : ''}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Empresa"
            value={props.values.companyId}
            disabled={!props.canPickCompany}
            onChange={(event) => props.onChange({ ...props.values, companyId: event.target.value })}
            required
          >
            {props.companies.map((company) => (
              <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button variant="contained" disabled={props.loading || !props.values.position.trim()} onClick={props.onSave}>
          Crear
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function MedicalExamDialog(props: {
  open: boolean
  editing: boolean
  values: MedicalExamFormValues
  employees: Array<{ id: string; firstName: string; lastName: string; document: string }>
  loading: boolean
  canPickCompany: boolean
  companies: Company[]
  onChange: (values: MedicalExamFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Registrar resultado del examen' : 'Programar examen ocupacional'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            label="Tipo de examen"
            value={props.values.examType}
            disabled={props.editing}
            onChange={(event) => props.onChange({ ...props.values, examType: event.target.value })}
            required
          >
            {examTypes.map((type) => (
              <MenuItem key={type} value={type}>{type}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Trabajador"
            value={props.values.employeeId}
            disabled={props.editing}
            onChange={(event) => props.onChange({ ...props.values, employeeId: event.target.value })}
            required
          >
            {props.employees.map((employee) => (
              <MenuItem key={employee.id} value={employee.id}>
                {employee.firstName} {employee.lastName} ({employee.document})
              </MenuItem>
            ))}
          </TextField>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              type="date" label="Programado" InputLabelProps={{ shrink: true }}
              value={props.values.scheduledAt}
              disabled={props.editing}
              onChange={(event) => props.onChange({ ...props.values, scheduledAt: event.target.value })}
              required
            />
            <TextField
              select
              label="Concepto ocupacional"
              value={props.values.concept}
              onChange={(event) => props.onChange({ ...props.values, concept: event.target.value })}
              sx={{ maxWidth: 240 }}
              helperText="Solo concepto operativo; no registrar diagnosticos"
            >
              {concepts.map((concept) => (
                <MenuItem key={concept} value={concept}>{concept}</MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              type="date" label="Realizado" InputLabelProps={{ shrink: true }}
              value={props.values.performedAt}
              onChange={(event) => props.onChange({ ...props.values, performedAt: event.target.value })}
            />
            <TextField
              type="date" label="Proxima fecha" InputLabelProps={{ shrink: true }}
              value={props.values.nextDueAt}
              onChange={(event) => props.onChange({ ...props.values, nextDueAt: event.target.value })}
            />
            <TextField
              label="Proveedor"
              value={props.values.provider}
              onChange={(event) => props.onChange({ ...props.values, provider: event.target.value })}
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button variant="contained" disabled={props.loading} onClick={props.onSave}>
          {props.editing ? 'Guardar resultado' : 'Programar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function MedicalRestrictionDialog(props: {
  open: boolean
  values: MedicalRestrictionFormValues
  employees: Array<{ id: string; firstName: string; lastName: string; document: string }>
  loading: boolean
  canPickCompany: boolean
  companies: Company[]
  onChange: (values: MedicalRestrictionFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Nueva restriccion laboral</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Descripcion de la restriccion"
            value={props.values.description}
            onChange={(event) => props.onChange({ ...props.values, description: event.target.value })}
            required
            multiline
            minRows={2}
          />
          <TextField
            select
            label="Trabajador"
            value={props.values.employeeId}
            onChange={(event) => props.onChange({ ...props.values, employeeId: event.target.value })}
            required
          >
            {props.employees.map((employee) => (
              <MenuItem key={employee.id} value={employee.id}>
                {employee.firstName} {employee.lastName} ({employee.document})
              </MenuItem>
            ))}
          </TextField>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              type="date" label="Desde" InputLabelProps={{ shrink: true }}
              value={props.values.startDate}
              onChange={(event) => props.onChange({ ...props.values, startDate: event.target.value })}
            />
            <TextField
              type="date" label="Hasta" InputLabelProps={{ shrink: true }}
              value={props.values.endDate}
              onChange={(event) => props.onChange({ ...props.values, endDate: event.target.value })}
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button variant="contained" disabled={props.loading || !props.values.description.trim() || !props.values.employeeId} onClick={props.onSave}>
          Crear
        </Button>
      </DialogActions>
    </Dialog>
  )
}

const riskTypes = ['BIOMECANICO', 'FISICO', 'QUIMICO', 'PSICOSOCIAL', 'BIOLOGICO', 'MECANICO', 'ERGONOMICO']

export function MedicalSurveillanceProgramDialog(props: {
  open: boolean
  values: MedicalSurveillanceProgramFormValues
  companies: Company[]
  loading: boolean
  canPickCompany: boolean
  onChange: (values: MedicalSurveillanceProgramFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Nuevo programa de vigilancia epidemiologica</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Nombre del programa"
            value={props.values.name}
            onChange={(event) => props.onChange({ ...props.values, name: event.target.value })}
            required
          />
          <TextField
            select
            label="Tipo de riesgo vigilado"
            value={props.values.riskType}
            onChange={(event) => props.onChange({ ...props.values, riskType: event.target.value })}
          >
            {riskTypes.map((type) => (
              <MenuItem key={type} value={type}>{type}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Objetivo"
            value={props.values.objective}
            onChange={(event) => props.onChange({ ...props.values, objective: event.target.value })}
            multiline
            minRows={2}
          />
          <TextField
            select
            label="Empresa"
            value={props.values.companyId}
            disabled={!props.canPickCompany}
            onChange={(event) => props.onChange({ ...props.values, companyId: event.target.value })}
            required
          >
            {props.companies.map((company) => (
              <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={props.loading || !props.values.name.trim() || !props.values.companyId}
          onClick={props.onSave}
        >
          Crear
        </Button>
      </DialogActions>
    </Dialog>
  )
}

const pveStatuses = ['SUSPECTED', 'CONFIRMED', 'CLOSED']
const pveStatusLabels: Record<string, string> = {
  SUSPECTED: 'Sospecha',
  CONFIRMED: 'Confirmado',
  CLOSED: 'Cerrado',
}

/** Dialogo de caso PVE (#44): crea o edita; el estado se avanza desde la tabla. */
export function PveCaseDialog(props: {
  open: boolean
  values: PveCaseFormValues
  companies: Company[]
  employees: Array<{ id: string; firstName: string; lastName: string }>
  programs: Array<{ id: string; name: string }>
  cohorts: Array<{ id: string; label: string; programId: string }>
  diagnoses: Array<{ id: string; code: string; name: string; active: boolean }>
  loading: boolean
  canPickCompany: boolean
  onChange: (values: PveCaseFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  const programCohorts = props.cohorts.filter((cohort) => cohort.programId === props.values.programId)
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Caso de vigilancia epidemiologica (PVE)</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            label="Trabajador"
            value={props.values.employeeId}
            onChange={(event) => props.onChange({ ...props.values, employeeId: event.target.value })}
            required
          >
            {props.employees.map((employee) => (
              <MenuItem key={employee.id} value={employee.id}>
                {employee.firstName} {employee.lastName}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Programa de vigilancia"
            value={props.values.programId}
            onChange={(event) => props.onChange({ ...props.values, programId: event.target.value, cohortId: '' })}
            required
          >
            {props.programs.map((program) => (
              <MenuItem key={program.id} value={program.id}>{program.name}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Cohorte de origen (opcional)"
            value={props.values.cohortId}
            onChange={(event) => props.onChange({ ...props.values, cohortId: event.target.value })}
            disabled={!props.values.programId}
          >
            <MenuItem value="">Sin cohorte</MenuItem>
            {programCohorts.map((cohort) => (
              <MenuItem key={cohort.id} value={cohort.id}>{cohort.label}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Diagnostico CIE-10"
            value={props.values.diagnosisId}
            onChange={(event) => props.onChange({ ...props.values, diagnosisId: event.target.value })}
            required
            helperText="Catalogo de la empresa; solo codigos activos."
          >
            {props.diagnoses.filter((diagnosis) => diagnosis.active || diagnosis.id === props.values.diagnosisId).map((diagnosis) => (
              <MenuItem key={diagnosis.id} value={diagnosis.id}>
                {diagnosis.code} - {diagnosis.name}
              </MenuItem>
            ))
            }
          </TextField>
          <TextField
            select
            label="Estado"
            value={props.values.status}
            onChange={(event) => props.onChange({ ...props.values, status: event.target.value })}
          >
            {pveStatuses.map((status) => (
              <MenuItem key={status} value={status}>{pveStatusLabels[status] ?? status}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Fecha de reporte"
            type="date"
            value={props.values.reportedAt}
            onChange={(event) => props.onChange({ ...props.values, reportedAt: event.target.value })}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Proximo control"
            type="date"
            value={props.values.nextFollowUpAt}
            onChange={(event) => props.onChange({ ...props.values, nextFollowUpAt: event.target.value })}
            helperText="Vacia = sin seguimiento programado."
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Dias de ausentismo"
            type="number"
            value={props.values.absenceDays}
            onChange={(event) => props.onChange({ ...props.values, absenceDays: Math.max(0, Number(event.target.value) || 0) })}
            inputProps={{ min: 0 }}
          />
          <TextField
            label="Notas"
            value={props.values.notes}
            onChange={(event) => props.onChange({ ...props.values, notes: event.target.value })}
            multiline
            minRows={2}
          />
          <TextField
            select
            label="Empresa"
            value={props.values.companyId}
            disabled={!props.canPickCompany}
            onChange={(event) => props.onChange({ ...props.values, companyId: event.target.value })}
            required
          >
            {props.companies.map((company) => (
              <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={
            props.loading ||
            !props.values.employeeId ||
            !props.values.programId ||
            !props.values.diagnosisId ||
            !props.values.companyId
          }
          onClick={props.onSave}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/** Dialogo de administracion del catalogo CIE-10 por empresa (#44). */
export function PveDiagnosisDialog(props: {
  open: boolean
  values: PveDiagnosisFormValues
  companies: Company[]
  loading: boolean
  canPickCompany: boolean
  onChange: (values: PveDiagnosisFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Diagnostico CIE-10 del catalogo</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Codigo CIE-10"
            value={props.values.code}
            onChange={(event) => props.onChange({ ...props.values, code: event.target.value.toUpperCase() })}
            required
            helperText="Formato letra + digitos, p. ej. M54.5"
          />
          <TextField
            label="Nombre"
            value={props.values.name}
            onChange={(event) => props.onChange({ ...props.values, name: event.target.value })}
            required
          />
          <TextField
            label="Categoria (opcional)"
            value={props.values.category}
            onChange={(event) => props.onChange({ ...props.values, category: event.target.value })}
          />
          <TextField
            select
            label="Empresa"
            value={props.values.companyId}
            disabled={!props.canPickCompany}
            onChange={(event) => props.onChange({ ...props.values, companyId: event.target.value })}
            required
          >
            {props.companies.map((company) => (
              <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={props.loading || !props.values.code.trim() || !props.values.name.trim() || !props.values.companyId}
          onClick={props.onSave}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
