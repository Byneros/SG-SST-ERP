import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, MenuItem, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import type {
  Company,
  Committee,
  CommitteeCommitmentFormValues,
  CommitteeFollowUp,
  CommitteeFormValues,
  CommitteeMeeting,
  CommitteeMeetingFormValues,
  CommitteeMeetingStatus,
  CommitteeMember,
  CommitteeMemberFormValues,
  CommitteeMemberRole,
  CommitteeSeatType,
} from '../../types'

const memberRoles: Array<{ value: CommitteeMemberRole; label: string }> = [
  { value: 'PRESIDENT', label: 'Presidente' },
  { value: 'SECRETARY', label: 'Secretario' },
  { value: 'PRINCIPAL', label: 'Principal' },
  { value: 'SUPERNUMERARY', label: 'Supernumerario' },
]

const seatTypes: Array<{ value: CommitteeSeatType; label: string }> = [
  { value: 'PRINCIPAL', label: 'Propietario' },
  { value: 'ALTERNATE', label: 'Suplente' },
]

const meetingStatuses: Array<{ value: CommitteeMeetingStatus; label: string }> = [
  { value: 'SCHEDULED', label: 'Programada' },
  { value: 'HELD', label: 'Realizada' },
  { value: 'CANCELLED', label: 'Cancelada' },
]

function CompanyPicker<T extends { companyId: string }>(props: {
  values: T
  companies: Company[]
  canPickCompany: boolean
  onChange: (values: T) => void
}) {
  if (props.canPickCompany) {
    return (
      <TextField
        select
        label="Empresa"
        value={props.values.companyId}
        disabled={props.companies.length === 0}
        onChange={(event) => props.onChange({ ...props.values, companyId: event.target.value })}
        required
      >
        {props.companies.map((company) => (
          <MenuItem key={company.id} value={company.id}>
            {company.name}
          </MenuItem>
        ))}
      </TextField>
    )
  }
  return (
    <TextField
      label="Empresa"
      value={props.companies.find((company) => company.id === props.values.companyId)?.name || props.values.companyId}
      InputProps={{ readOnly: true }}
      helperText="Empresa asignada según tu sesión"
    />
  )
}

export function CommitteeDialog(props: {
  open: boolean
  editing: boolean
  values: CommitteeFormValues
  companies: Company[]
  loading: boolean
  canPickCompany: boolean
  onChange: (values: CommitteeFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Editar comité' : 'Nuevo comité'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Nombre"
            value={props.values.name}
            onChange={(event) => props.onChange({ ...props.values, name: event.target.value })}
            required
          />
          <Stack direction="row" spacing={2}>
            <TextField
              select
              label="Tipo"
              value={props.values.type}
              onChange={(event) => props.onChange({ ...props.values, type: event.target.value as CommitteeFormValues['type'] })}
              fullWidth
              required
            >
              <MenuItem value="COPASST">COPASST</MenuItem>
              <MenuItem value="CONVIVENCIA">Comité de Convivencia</MenuItem>
            </TextField>
            <TextField
              select
              label="Estado"
              value={props.values.status}
              onChange={(event) => props.onChange({ ...props.values, status: event.target.value as CommitteeFormValues['status'] })}
              fullWidth
            >
              <MenuItem value="ACTIVE">Activo</MenuItem>
              <MenuItem value="CLOSED">Cerrado</MenuItem>
            </TextField>
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Inicio del periodo"
              type="date"
              value={props.values.periodStart}
              onChange={(event) => props.onChange({ ...props.values, periodStart: event.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
              required
            />
            <TextField
              label="Fin del periodo"
              type="date"
              value={props.values.periodEnd}
              onChange={(event) => props.onChange({ ...props.values, periodEnd: event.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
              required
            />
          </Stack>
          <CompanyPicker values={props.values} companies={props.companies} canPickCompany={props.canPickCompany} onChange={props.onChange} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button onClick={props.onSave} variant="contained" disabled={props.loading}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function MemberForm(props: {
  values: CommitteeMemberFormValues
  employees: Array<{ id: string; firstName: string; lastName: string; document?: string }>
  onChange: (values: CommitteeMemberFormValues) => void
  onSave: () => void
}) {
  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <Stack direction="row" spacing={2}>
        <TextField
          select
          label="Empleado"
          value={props.values.employeeId}
          onChange={(event) => props.onChange({ ...props.values, employeeId: event.target.value })}
          fullWidth
          required
        >
          {props.employees.map((employee) => (
            <MenuItem key={employee.id} value={employee.id}>
              {employee.firstName} {employee.lastName}
              {employee.document ? ` (${employee.document})` : ''}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Cargo"
          value={props.values.role}
          onChange={(event) => props.onChange({ ...props.values, role: event.target.value as CommitteeMemberFormValues['role'] })}
          fullWidth
          required
        >
          {memberRoles.map((role) => (
            <MenuItem key={role.value} value={role.value}>
              {role.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      <Stack direction="row" spacing={2}>
        <TextField
          select
          label="Naturaleza"
          value={props.values.seatType}
          onChange={(event) => props.onChange({ ...props.values, seatType: event.target.value as CommitteeMemberFormValues['seatType'] })}
          fullWidth
        >
          {seatTypes.map((seat) => (
            <MenuItem key={seat.value} value={seat.value}>
              {seat.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Inicio"
          type="date"
          value={props.values.startDate}
          onChange={(event) => props.onChange({ ...props.values, startDate: event.target.value })}
          InputLabelProps={{ shrink: true }}
          fullWidth
          required
        />
        <TextField
          label="Fin (opcional)"
          type="date"
          value={props.values.endDate}
          onChange={(event) => props.onChange({ ...props.values, endDate: event.target.value })}
          InputLabelProps={{ shrink: true }}
          fullWidth
        />
      </Stack>
      <Button variant="contained" onClick={props.onSave}>
        Agregar integrante
      </Button>
    </Stack>
  )
}

function MeetingForm(props: {
  values: CommitteeMeetingFormValues
  documents: Array<{ id: string; name: string }>
  onChange: (values: CommitteeMeetingFormValues) => void
  onSave: () => void
}) {
  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <Stack direction="row" spacing={2}>
        <TextField
          label="Número"
          type="number"
          value={props.values.number}
          onChange={(event) => props.onChange({ ...props.values, number: event.target.value === '' ? '' : Number(event.target.value) })}
          sx={{ minWidth: 110 }}
          required
        />
        <TextField
          select
          label="Estado"
          value={props.values.status}
          onChange={(event) => props.onChange({ ...props.values, status: event.target.value as CommitteeMeetingFormValues['status'] })}
          fullWidth
        >
          {meetingStatuses.map((status) => (
            <MenuItem key={status.value} value={status.value}>
              {status.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Fecha"
          type="datetime-local"
          value={props.values.meetingAt}
          onChange={(event) => props.onChange({ ...props.values, meetingAt: event.target.value })}
          InputLabelProps={{ shrink: true }}
          fullWidth
          required
        />
      </Stack>
      <TextField
        label="Agenda"
        value={props.values.agenda}
        onChange={(event) => props.onChange({ ...props.values, agenda: event.target.value })}
        multiline
        minRows={2}
      />
      <Stack direction="row" spacing={2}>
        <TextField
          select
          label="Acta (documento)"
          value={props.values.minutesDocumentId}
          onChange={(event) => props.onChange({ ...props.values, minutesDocumentId: event.target.value })}
          fullWidth
          helperText="Documento del expediente que respalda la reunión"
        >
          <MenuItem value="">Sin acta</MenuItem>
          {props.documents.map((document) => (
            <MenuItem key={document.id} value={document.id}>
              {document.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Notas"
          value={props.values.notes}
          onChange={(event) => props.onChange({ ...props.values, notes: event.target.value })}
          fullWidth
        />
      </Stack>
      <Button variant="contained" onClick={props.onSave}>
        Registrar reunión
      </Button>
    </Stack>
  )
}

function CommitmentForm(props: {
  values: CommitteeCommitmentFormValues
  meeting: CommitteeMeeting
  employees: Array<{ id: string; firstName: string; lastName: string }>
  onChange: (values: CommitteeCommitmentFormValues) => void
  onSave: () => void
}) {
  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <Typography variant="subtitle2">Nuevo compromiso — reunión #{props.meeting.number}</Typography>
      <TextField
        label="Descripción"
        value={props.values.description}
        onChange={(event) => props.onChange({ ...props.values, description: event.target.value })}
        required
      />
      <Stack direction="row" spacing={2}>
        <TextField
          select
          label="Responsable"
          value={props.values.responsibleEmployeeId}
          onChange={(event) => props.onChange({ ...props.values, responsibleEmployeeId: event.target.value })}
          fullWidth
          required
        >
          {props.employees.map((employee) => (
            <MenuItem key={employee.id} value={employee.id}>
              {employee.firstName} {employee.lastName}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Fecha límite"
          type="date"
          value={props.values.dueDate}
          onChange={(event) => props.onChange({ ...props.values, dueDate: event.target.value })}
          InputLabelProps={{ shrink: true }}
          fullWidth
          required
        />
      </Stack>
      <Button variant="contained" onClick={props.onSave}>
        Crear compromiso
      </Button>
    </Stack>
  )
}

export function CommitteeDetailDialog(props: {
  open: boolean
  committee: Committee | null
  members: CommitteeMember[]
  meetings: CommitteeMeeting[]
  employees: Array<{ id: string; firstName: string; lastName: string; document?: string }>
  documents: Array<{ id: string; name: string }>
  followUp: CommitteeFollowUp | null
  followUpLoading: boolean
  canManage: boolean
  memberForm: CommitteeMemberFormValues
  meetingForm: CommitteeMeetingFormValues
  commitmentForm: CommitteeCommitmentFormValues
  commitmentMeeting: CommitteeMeeting | null
  onMemberFormChange: (values: CommitteeMemberFormValues) => void
  onMeetingFormChange: (values: CommitteeMeetingFormValues) => void
  onCommitmentFormChange: (values: CommitteeCommitmentFormValues) => void
  onCommitmentMeetingChange: (meeting: CommitteeMeeting | null) => void
  onSaveMember: () => void
  onSaveMeeting: () => void
  onSaveCommitment: () => void
  onRemoveMember: (member: CommitteeMember) => void
  onRemoveMeeting: (meeting: CommitteeMeeting) => void
  onToggleCommitment: (meeting: CommitteeMeeting, commitmentId: string, completed: boolean) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState(0)
  const committee = props.committee

  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {committee ? `${committee.name}` : 'Comité'}
        {committee && (
          <Typography variant="caption" display="block" color="text.secondary">
            Periodo {new Date(committee.periodStart).toLocaleDateString()} — {new Date(committee.periodEnd).toLocaleDateString()}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers>
        {committee && (
          <>
            <Tabs value={tab} onChange={(_, next) => setTab(next)} sx={{ mb: 2 }}>
              <Tab label={`Integrantes (${props.members.length})`} />
              <Tab label={`Reuniones (${props.meetings.length})`} />
              <Tab label="Seguimiento" />
            </Tabs>

            {tab === 0 && (
              <Stack spacing={2}>
                {props.members.map((member) => (
                  <Stack key={member.id} direction="row" spacing={2} alignItems="center">
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2">
                        {member.employee ? `${member.employee.firstName} ${member.employee.lastName}` : member.employeeId}
                        {member.employee?.document ? ` — ${member.employee.document}` : ''}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {memberRoles.find((role) => role.value === member.role)?.label ?? member.role}
                        {' · '}
                        {seatTypes.find((seat) => seat.value === member.seatType)?.label ?? member.seatType}
                      </Typography>
                    </Box>
                    {props.canManage && (
                      <Button size="small" color="error" onClick={() => props.onRemoveMember(member)}>
                        Quitar
                      </Button>
                    )}
                  </Stack>
                ))}
                {props.members.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Sin integrantes registrados.
                  </Typography>
                )}
                {props.canManage && (
                  <>
                    <Divider />
                    <MemberForm values={props.memberForm} employees={props.employees} onChange={props.onMemberFormChange} onSave={props.onSaveMember} />
                  </>
                )}
              </Stack>
            )}

            {tab === 1 && (
              <Stack spacing={3}>
                {props.meetings.map((meeting) => (
                  <Stack key={meeting.id} spacing={1}>
                    <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography variant="subtitle2">Reunión #{meeting.number}</Typography>
                      <Chip size="small" label={meetingStatuses.find((status) => status.value === meeting.status)?.label ?? meeting.status} variant="outlined" />
                      <Typography variant="caption" color="text.secondary">
                        {new Date(meeting.meetingAt).toLocaleString()}
                      </Typography>
                      {meeting.minutesDocument && (
                        <Chip size="small" label={`Acta: ${meeting.minutesDocument.name}`} color="primary" variant="outlined" />
                      )}
                      {props.canManage && (
                        <Button size="small" color="error" onClick={() => props.onRemoveMeeting(meeting)}>
                          Eliminar
                        </Button>
                      )}
                    </Stack>
                    {meeting.agenda && (
                      <Typography variant="body2" color="text.secondary">
                        Agenda: {meeting.agenda}
                      </Typography>
                    )}
                    <Stack spacing={0.5} sx={{ pl: 2 }}>
                      {meeting.commitments.map((commitment) => (
                        <Stack key={commitment.id} direction="row" spacing={1.5} alignItems="center">
                          <Typography variant="body2" sx={{ flex: 1 }}>
                            {commitment.completedAt ? '✔ ' : '• '}
                            {commitment.description}
                            {commitment.responsible ? ` — ${commitment.responsible.firstName} ${commitment.responsible.lastName}` : ''}
                            {' '}
                            (vence {new Date(commitment.dueDate).toLocaleDateString()})
                          </Typography>
                          {props.canManage && (
                            <Button
                              size="small"
                              onClick={() => props.onToggleCommitment(meeting, commitment.id, !commitment.completedAt)}
                            >
                              {commitment.completedAt ? 'Reabrir' : 'Cerrar'}
                            </Button>
                          )}
                        </Stack>
                      ))}
                      {meeting.commitments.length === 0 && (
                        <Typography variant="caption" color="text.secondary">
                          Sin compromisos de esta reunión.
                        </Typography>
                      )}
                    </Stack>
                    {props.canManage && (
                      <Button size="small" onClick={() => props.onCommitmentMeetingChange(meeting)}>
                        + Compromiso
                      </Button>
                    )}
                    {props.canManage && props.commitmentMeeting?.id === meeting.id && (
                      <CommitmentForm
                        values={props.commitmentForm}
                        meeting={meeting}
                        employees={props.employees}
                        onChange={props.onCommitmentFormChange}
                        onSave={props.onSaveCommitment}
                      />
                    )}
                    <Divider />
                  </Stack>
                ))}
                {props.meetings.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Sin reuniones registradas.
                  </Typography>
                )}
                {props.canManage && (
                  <MeetingForm values={props.meetingForm} documents={props.documents} onChange={props.onMeetingFormChange} onSave={props.onSaveMeeting} />
                )}
              </Stack>
            )}

            {tab === 2 && (
              <Stack spacing={2}>
                {props.followUpLoading && (
                  <Typography variant="body2" color="text.secondary">
                    Calculando seguimiento...
                  </Typography>
                )}
                {!props.followUpLoading && props.followUp && (
                  <>
                    <Alert severity={props.followUp.overdueCount === 0 ? 'success' : 'warning'} variant="outlined">
                      {props.followUp.overdueCount === 0
                        ? 'Sin compromisos vencidos: el seguimiento está al día.'
                        : `${props.followUp.overdueCount} compromiso(s) vencido(s) requieren atención.`}
                    </Alert>
                    {props.followUp.overdue.map((item) => (
                      <Stack key={item.id} direction="row" spacing={2} alignItems="center">
                        <Typography variant="body2" sx={{ flex: 1 }}>
                          {item.description}
                          {item.responsible ? ` — ${item.responsible.firstName} ${item.responsible.lastName}` : ''}
                        </Typography>
                        <Chip size="small" color="error" label={`Venció ${new Date(item.dueDate).toLocaleDateString()}`} variant="outlined" />
                      </Stack>
                    ))}
                  </>
                )}
              </Stack>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}
