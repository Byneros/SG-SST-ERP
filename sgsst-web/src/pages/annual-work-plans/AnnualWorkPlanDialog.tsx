import { AddTask, Delete, Save } from '@mui/icons-material'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import type {
  AnnualActivityCycle,
  AnnualActivityFormValues,
  AnnualActivityStatus,
  AnnualWorkPlan,
  AnnualWorkPlanFormValues,
  Company,
  SgsstDocument,
  SystemUser,
} from '../../types'

const cycles: AnnualActivityCycle[] = ['PLANEAR', 'HACER', 'VERIFICAR', 'ACTUAR', 'ACT']
const activityStatuses: AnnualActivityStatus[] = ['PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED']
const planStatuses: AnnualWorkPlan['status'][] = ['DRAFT', 'APPROVED', 'IN_PROGRESS', 'CLOSED']

const planStatusLabel: Record<AnnualWorkPlan['status'], string> = {
  DRAFT: 'Borrador',
  APPROVED: 'Aprobado',
  IN_PROGRESS: 'En ejecucion',
  CLOSED: 'Cerrado',
}

const cycleLabel: Record<AnnualActivityCycle, string> = {
  PLANEAR: 'Planear',
  HACER: 'Hacer',
  VERIFICAR: 'Verificar',
  ACTUAR: 'Actuar',
  ACT: 'Actividad',
}

export function AnnualWorkPlanDialog(props: {
  open: boolean
  editing: boolean
  values: AnnualWorkPlanFormValues
  companies: Company[]
  item?: AnnualWorkPlan
  users: SystemUser[]
  documents: SgsstDocument[]
  loading: boolean
  canPickCompany: boolean
  canManageActivities: boolean
  onChange: (values: AnnualWorkPlanFormValues) => void
  onClose: () => void
  onSave: () => void
  onLoadActivities: (planId: string) => void
  onAddActivity: (planId: string, payload: AnnualActivityFormValues) => void
  onUpdateActivity: (planId: string, activityId: string, payload: Partial<AnnualActivityFormValues>) => void
  onDeleteActivity: (planId: string, activityId: string) => void
}) {
  const [newActivity, setNewActivity] = useState<AnnualActivityFormValues>({
    cycle: 'ACT',
    name: '',
    frequency: '',
    dueDate: '',
    progress: '0',
    status: 'PENDING',
    budget: '',
    ownerId: '',
    evidenceId: '',
  })
  const [activities, setActivities] = useState<NonNullable<AnnualWorkPlan['activities']>>([])
  const [planProgress, setPlanProgress] = useState<number | null>(null)

  const planId = props.item?.id
  const activitiesVersion = `${planId ?? ''}:${props.item?.updatedAt ?? ''}`

  useEffect(() => {
    if (props.open && planId) {
      props.onLoadActivities(planId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, activitiesVersion])

  useEffect(() => {
    setActivities(props.item?.activities ?? [])
    setPlanProgress(props.item?.planProgress ?? null)
  }, [activitiesVersion, props.item?.activities, props.item?.planProgress])

  // Sedes/documentos de la empresa del plan: la evidencia siempre es de la misma empresa.
  const companyId = props.values.companyId || props.item?.companyId || ''
  const documentOptions = props.documents.filter((doc) => doc.companyId === companyId)
  const userOptions = props.users.filter((u) => u.companyId === companyId)

  const resetNewActivity = () =>
    setNewActivity({
      cycle: 'ACT',
      name: '',
      frequency: '',
      dueDate: '',
      progress: '0',
      status: 'PENDING',
      budget: '',
      ownerId: '',
      evidenceId: '',
    })

  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="md" fullWidth>
      <DialogTitle>{props.editing ? `Plan anual ${props.item?.year ?? ''}` : 'Nuevo plan anual'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              type="number"
              label="Anio"
              value={props.values.year}
              onChange={(event) => props.onChange({ ...props.values, year: event.target.value })}
              required
              sx={{ maxWidth: 140 }}
            />
            <TextField
              select
              label="Estado"
              value={props.values.status}
              onChange={(event) => props.onChange({ ...props.values, status: event.target.value as AnnualWorkPlan['status'] })}
              sx={{ maxWidth: 200 }}
            >
              {planStatuses.map((status) => (
                <MenuItem key={status} value={status}>{planStatusLabel[status]}</MenuItem>
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
          <TextField
            label="Notas"
            value={props.values.notes}
            onChange={(event) => props.onChange({ ...props.values, notes: event.target.value })}
            multiline
            minRows={2}
          />

          {props.editing && planId && (
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2">Actividades del plan</Typography>
                <Chip size="small" label={String(activities.length)} variant="outlined" />
                {planProgress !== null && (
                  <Chip size="small" color="primary" label={`${planProgress}% avance`} />
                )}
              </Stack>
              {planProgress !== null && <LinearProgress variant="determinate" value={planProgress} sx={{ mb: 1 }} />}
              {activities.length === 0 && (
                <Typography variant="body2" color="text.secondary">El plan aun no tiene actividades.</Typography>
              )}

              {props.canManageActivities && (
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mt: 1 }} alignItems={{ md: 'center' }} useFlexGap flexWrap="wrap">
                  <TextField
                    select size="small" label="Ciclo" sx={{ maxWidth: 130 }}
                    value={newActivity.cycle}
                    onChange={(event) => setNewActivity((c) => ({ ...c, cycle: event.target.value as AnnualActivityCycle }))}
                  >
                    {cycles.map((cycle) => (
                      <MenuItem key={cycle} value={cycle}>{cycleLabel[cycle]}</MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    size="small" label="Actividad" required sx={{ flex: 1, minWidth: 200 }}
                    value={newActivity.name}
                    onChange={(event) => setNewActivity((c) => ({ ...c, name: event.target.value }))}
                  />
                  <TextField
                    size="small" type="date" label="Fecha" InputLabelProps={{ shrink: true }} sx={{ maxWidth: 170 }}
                    value={newActivity.dueDate}
                    onChange={(event) => setNewActivity((c) => ({ ...c, dueDate: event.target.value }))}
                  />
                  <TextField
                    select size="small" label="Responsable" sx={{ maxWidth: 190 }}
                    value={newActivity.ownerId}
                    onChange={(event) => setNewActivity((c) => ({ ...c, ownerId: event.target.value }))}
                  >
                    <MenuItem value="">Sin responsable</MenuItem>
                    {userOptions.map((u) => (
                      <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select size="small" label="Evidencia" sx={{ maxWidth: 190 }}
                    value={newActivity.evidenceId}
                    onChange={(event) => setNewActivity((c) => ({ ...c, evidenceId: event.target.value }))}
                    helperText={documentOptions.length === 0 ? 'Sin documentos en la empresa' : undefined}
                  >
                    <MenuItem value="">Sin evidencia</MenuItem>
                    {documentOptions.map((doc) => (
                      <MenuItem key={doc.id} value={doc.id}>{doc.name}</MenuItem>
                    ))}
                  </TextField>
                  <Button
                    variant="outlined"
                    startIcon={<AddTask />}
                    disabled={props.loading || !newActivity.name.trim()}
                    onClick={() => {
                      props.onAddActivity(planId, newActivity)
                      resetNewActivity()
                    }}
                  >
                    Agregar
                  </Button>
                </Stack>
              )}

              {activities.map((activity) => (
                <Box key={activity.id} sx={{ py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip size="small" label={cycleLabel[activity.cycle] ?? activity.cycle} variant="outlined" />
                    <Typography variant="subtitle2" sx={{ flex: 1 }}>{activity.name}</Typography>
                    {props.canManageActivities && (
                      <IconButton
                        size="small"
                        color="error"
                        disabled={props.loading}
                        onClick={() => props.onDeleteActivity(planId, activity.id)}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mt: 0.5 }} useFlexGap flexWrap="wrap">
                    <Typography variant="caption" color="text.secondary">
                      {activity.dueDate ? `Vence ${activity.dueDate.slice(0, 10)}` : 'Sin fecha'}
                      {activity.owner ? ` - Responsable: ${activity.owner.name}` : ''}
                      {activity.evidence ? ` - Evidencia: ${activity.evidence.name}` : ''}
                    </Typography>
                  </Stack>
                  {props.canManageActivities && (
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mt: 1 }} useFlexGap flexWrap="wrap">
                      <TextField
                        size="small" type="number" label="% avance" sx={{ maxWidth: 110 }}
                        defaultValue={activity.progress}
                        inputProps={{ min: 0, max: 100 }}
                        onBlur={(event) => {
                          const progress = Math.max(0, Math.min(100, Number(event.target.value)))
                          if (progress !== activity.progress) {
                            props.onUpdateActivity(planId, activity.id, { progress: String(progress) })
                          }
                        }}
                      />
                      <TextField
                        select size="small" label="Estado" sx={{ maxWidth: 150 }}
                        defaultValue={activity.status}
                        onChange={(event) => {
                          const status = event.target.value as AnnualActivityStatus
                          if (status !== activity.status) {
                            props.onUpdateActivity(planId, activity.id, {
                              status,
                              progress: status === 'DONE' ? '100' : undefined,
                            })
                          }
                        }}
                      >
                        {activityStatuses.map((status) => (
                          <MenuItem key={status} value={status}>{status}</MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        select size="small" label="Evidencia" sx={{ maxWidth: 220 }}
                        defaultValue={activity.evidenceId ?? ''}
                        onChange={(event) => {
                          const evidenceId = event.target.value
                          if (evidenceId !== (activity.evidenceId ?? '')) {
                            props.onUpdateActivity(planId, activity.id, { evidenceId })
                          }
                        }}
                      >
                        <MenuItem value="">Sin evidencia</MenuItem>
                        {documentOptions.map((doc) => (
                          <MenuItem key={doc.id} value={doc.id}>{doc.name}</MenuItem>
                        ))}
                      </TextField>
                      <Button size="small" startIcon={<Save />} disabled={props.loading} onClick={() => props.onLoadActivities(planId)}>
                        Refrescar
                      </Button>
                    </Stack>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button variant="contained" disabled={props.loading} onClick={props.onSave}>
          {props.editing ? 'Guardar' : 'Crear plan'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
