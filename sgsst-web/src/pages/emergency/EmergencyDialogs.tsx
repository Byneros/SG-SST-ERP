import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, MenuItem, Stack, TextField, Typography } from '@mui/material'
import type {
  Company,
  EmergencyBrigade,
  EmergencyBrigadeMember,
  EmergencyBrigadeMemberFormValues,
  EmergencyBrigadeFormValues,
  EmergencyDrill,
  EmergencyDrillFinding,
  EmergencyDrillFindingFormValues,
  EmergencyDrillFormValues,
  EmergencyDrillStatus,
  EmergencyFindingSeverity,
  EmergencyPlan,
  EmergencyPlanFormValues,
  EmergencyResource,
  EmergencyResourceFormValues,
  EmergencyResourceStatus,
  EmergencyThreat,
  EmergencyThreatFormValues,
  EmergencyThreatRisk,
} from '../../types'

const brigadeRoles: Array<{ value: EmergencyBrigadeMemberFormValues['role']; label: string }> = [
  { value: 'JEFE_BRIGADA', label: 'Jefe de brigada' },
  { value: 'PREVENCION_INCENDIOS', label: 'Prevención y control de incendios' },
  { value: 'PRIMEROS_AUXILIOS', label: 'Primeros auxilios' },
  { value: 'EVACUACION_RESCATE', label: 'Evacuación y rescate' },
  { value: 'BRIGADISTA', label: 'Brigadista' },
]

const threatRisks: Array<{ value: EmergencyThreatRisk; label: string }> = [
  { value: 'LOW', label: 'Bajo' },
  { value: 'MEDIUM', label: 'Medio' },
  { value: 'HIGH', label: 'Alto' },
]

const resourceStatuses: Array<{ value: EmergencyResourceStatus; label: string }> = [
  { value: 'OPERATIVE', label: 'Operativo' },
  { value: 'MAINTENANCE', label: 'En mantenimiento' },
  { value: 'EXPIRED', label: 'Vencido' },
]

const findingSeverities: Array<{ value: EmergencyFindingSeverity; label: string }> = [
  { value: 'MINOR', label: 'Menor' },
  { value: 'MAJOR', label: 'Mayor' },
  { value: 'CRITICAL', label: 'Crítico' },
]

const drillStatuses: Array<{ value: EmergencyDrillStatus; label: string }> = [
  { value: 'PLANNED', label: 'Programado' },
  { value: 'EXECUTED', label: 'Ejecutado' },
  { value: 'CLOSED', label: 'Cerrado' },
  { value: 'CANCELLED', label: 'Cancelado' },
]

function isExpiredDate(value?: string | null): boolean {
  return Boolean(value && new Date(value).getTime() < Date.now())
}

export function EmergencyBrigadeDialog(props: {
  open: boolean
  editing: boolean
  values: EmergencyBrigadeFormValues
  sites: Array<{ id: string; name: string }>
  companies: Company[]
  loading: boolean
  canPickCompany: boolean
  onChange: (values: EmergencyBrigadeFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Editar brigada' : 'Nueva brigada'}</DialogTitle>
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
              label="Sede"
              value={props.values.siteId}
              onChange={(event) => props.onChange({ ...props.values, siteId: event.target.value })}
              fullWidth
              required
            >
              {props.sites.map((site) => (
                <MenuItem key={site.id} value={site.id}>
                  {site.name}
                </MenuItem>
              ))}
            </TextField>
            {props.canPickCompany ? (
              <TextField
                select
                label="Empresa"
                value={props.values.companyId}
                onChange={(event) => props.onChange({ ...props.values, companyId: event.target.value })}
                fullWidth
              >
                {props.companies.map((company) => (
                  <MenuItem key={company.id} value={company.id}>
                    {company.name}
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <TextField
                label="Empresa"
                value={props.companies.find((company) => company.id === props.values.companyId)?.name || props.values.companyId}
                InputProps={{ readOnly: true }}
                fullWidth
              />
            )}
          </Stack>
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

export function EmergencyBrigadeDetailDialog(props: {
  open: boolean
  brigade: EmergencyBrigade | null
  members: EmergencyBrigadeMember[]
  employees: Array<{ id: string; firstName: string; lastName: string; document?: string }>
  canManage: boolean
  memberForm: EmergencyBrigadeMemberFormValues
  onMemberFormChange: (values: EmergencyBrigadeMemberFormValues) => void
  onSaveMember: () => void
  onRemoveMember: (member: EmergencyBrigadeMember) => void
  onClose: () => void
}) {
  const brigade = props.brigade
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {brigade ? `${brigade.name}` : 'Brigada'}
        {brigade?.site && (
          <Typography variant="caption" display="block" color="text.secondary">
            Sede: {brigade.site.name}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers>
        {brigade && (
          <Stack spacing={2}>
            {props.members.map((member) => {
              const expired = isExpiredDate(member.validUntil)
              return (
                <Stack key={member.id} direction="row" spacing={2} alignItems="center">
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2">
                      {member.employee ? `${member.employee.firstName} ${member.employee.lastName}` : member.employeeId}
                      {member.employee?.document ? ` — ${member.employee.document}` : ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {brigadeRoles.find((role) => role.value === member.role)?.label ?? member.role}
                      {member.validUntil ? ` · vigencia hasta ${new Date(member.validUntil).toLocaleDateString()}` : ' · sin fecha de vigencia'}
                    </Typography>
                  </Box>
                  {expired ? (
                    <Chip size="small" color="error" label="Formación vencida" variant="outlined" />
                  ) : member.validUntil ? (
                    <Chip size="small" color="success" label="Vigente" variant="outlined" />
                  ) : (
                    <Chip size="small" label="Sin formación" variant="outlined" />
                  )}
                  {props.canManage && (
                    <Button size="small" color="error" onClick={() => props.onRemoveMember(member)}>
                      Quitar
                    </Button>
                  )}
                </Stack>
              )
            })}
            {props.members.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Sin integrantes registrados.
              </Typography>
            )}
            {props.canManage && (
              <>
                <Divider />
                <Typography variant="subtitle2">Agregar brigadista</Typography>
                <Stack direction="row" spacing={2}>
                  <TextField
                    select
                    label="Empleado"
                    value={props.memberForm.employeeId}
                    onChange={(event) => props.onMemberFormChange({ ...props.memberForm, employeeId: event.target.value })}
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
                    label="Frente"
                    value={props.memberForm.role}
                    onChange={(event) => props.onMemberFormChange({ ...props.memberForm, role: event.target.value as EmergencyBrigadeMemberFormValues['role'] })}
                    fullWidth
                    required
                  >
                    {brigadeRoles.map((role) => (
                      <MenuItem key={role.value} value={role.value}>
                        {role.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Formación completada"
                    type="date"
                    value={props.memberForm.formationCompletedAt}
                    onChange={(event) => props.onMemberFormChange({ ...props.memberForm, formationCompletedAt: event.target.value })}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                  <TextField
                    label="Vigencia hasta"
                    type="date"
                    value={props.memberForm.validUntil}
                    onChange={(event) => props.onMemberFormChange({ ...props.memberForm, validUntil: event.target.value })}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                  <Button variant="contained" onClick={props.onSaveMember} disabled={!props.memberForm.employeeId}>
                    Agregar
                  </Button>
                </Stack>
              </>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}

export function EmergencyPlanDialog(props: {
  open: boolean
  editing: boolean
  values: EmergencyPlanFormValues
  sites: Array<{ id: string; name: string }>
  employees: Array<{ id: string; firstName: string; lastName: string }>
  companies: Company[]
  loading: boolean
  canPickCompany: boolean
  onChange: (values: EmergencyPlanFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Editar plan de emergencias' : 'Nuevo plan de emergencias'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Nombre del plan"
            value={props.values.name}
            onChange={(event) => props.onChange({ ...props.values, name: event.target.value })}
            required
          />
          <Stack direction="row" spacing={2}>
            <TextField
              select
              label="Sede (plan independiente)"
              value={props.values.siteId}
              onChange={(event) => props.onChange({ ...props.values, siteId: event.target.value })}
              fullWidth
              required
            >
              {props.sites.map((site) => (
                <MenuItem key={site.id} value={site.id}>
                  {site.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Responsable"
              value={props.values.responsibleEmployeeId}
              onChange={(event) => props.onChange({ ...props.values, responsibleEmployeeId: event.target.value })}
              fullWidth
            >
              <MenuItem value="">Sin responsable</MenuItem>
              {props.employees.map((employee) => (
                <MenuItem key={employee.id} value={employee.id}>
                  {employee.firstName} {employee.lastName}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          {props.canPickCompany ? (
            <TextField
              select
              label="Empresa"
              value={props.values.companyId}
              onChange={(event) => props.onChange({ ...props.values, companyId: event.target.value })}
              fullWidth
            >
              {props.companies.map((company) => (
                <MenuItem key={company.id} value={company.id}>
                  {company.name}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <TextField
              label="Empresa"
              value={props.companies.find((company) => company.id === props.values.companyId)?.name || props.values.companyId}
              InputProps={{ readOnly: true }}
              fullWidth
            />
          )}
          <TextField
            label="Punto de encuentro"
            value={props.values.meetingPoint}
            onChange={(event) => props.onChange({ ...props.values, meetingPoint: event.target.value })}
          />
          <TextField
            label="Rutas de evacuación"
            value={props.values.routesDescription}
            onChange={(event) => props.onChange({ ...props.values, routesDescription: event.target.value })}
            multiline
            minRows={2}
          />
          <TextField
            label="Procedimientos de respuesta"
            value={props.values.procedures}
            onChange={(event) => props.onChange({ ...props.values, procedures: event.target.value })}
            multiline
            minRows={2}
          />
          <TextField
            label="Vulnerabilidades identificadas"
            value={props.values.vulnerabilityNotes}
            onChange={(event) => props.onChange({ ...props.values, vulnerabilityNotes: event.target.value })}
            multiline
            minRows={2}
          />
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

export function EmergencyPlanDetailDialog(props: {
  open: boolean
  plan: EmergencyPlan | null
  canManage: boolean
  threatForm: EmergencyThreatFormValues
  resourceForm: EmergencyResourceFormValues
  onThreatFormChange: (values: EmergencyThreatFormValues) => void
  onResourceFormChange: (values: EmergencyResourceFormValues) => void
  onSaveThreat: () => void
  onSaveResource: () => void
  onRemoveThreat: (threat: EmergencyThreat) => void
  onRemoveResource: (resource: EmergencyResource) => void
  onClose: () => void
}) {
  const plan = props.plan
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {plan ? `${plan.name}` : 'Plan'}
        {plan?.site && (
          <Typography variant="caption" display="block" color="text.secondary">
            Sede: {plan.site.name}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers>
        {plan && (
          <Stack spacing={3}>
            <Stack spacing={1}>
              <Typography variant="subtitle2">Punto de encuentro y rutas</Typography>
              <Typography variant="body2" color="text.secondary">
                {plan.meetingPoint || 'Sin punto de encuentro definido.'}
                {plan.routesDescription ? ` — Rutas: ${plan.routesDescription}` : ''}
              </Typography>
            </Stack>

            <Stack spacing={1}>
              <Typography variant="subtitle2">Amenazas identificadas</Typography>
              {(plan.threats ?? []).map((threat) => (
                <Stack key={threat.id} direction="row" spacing={1.5} alignItems="center">
                  <Chip
                    size="small"
                    color={threat.riskLevel === 'HIGH' ? 'error' : threat.riskLevel === 'MEDIUM' ? 'warning' : 'default'}
                    label={threatRisks.find((risk) => risk.value === threat.riskLevel)?.label ?? threat.riskLevel}
                    variant="outlined"
                  />
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    <strong>{threat.type}</strong>
                    {threat.description ? ` — ${threat.description}` : ''}
                  </Typography>
                  {props.canManage && (
                    <Button size="small" color="error" onClick={() => props.onRemoveThreat(threat)}>
                      Eliminar
                    </Button>
                  )}
                </Stack>
              ))}
              {(plan.threats ?? []).length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Sin amenazas registradas.
                </Typography>
              )}
              {props.canManage && (
                <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                  <TextField
                    label="Tipo de amenaza"
                    value={props.threatForm.type}
                    onChange={(event) => props.onThreatFormChange({ ...props.threatForm, type: event.target.value })}
                    placeholder="Incendio, sismo, inundación..."
                    required
                  />
                  <TextField
                    select
                    label="Riesgo"
                    value={props.threatForm.riskLevel}
                    onChange={(event) => props.onThreatFormChange({ ...props.threatForm, riskLevel: event.target.value as EmergencyThreatRisk })}
                  >
                    {threatRisks.map((risk) => (
                      <MenuItem key={risk.value} value={risk.value}>
                        {risk.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button variant="contained" onClick={props.onSaveThreat} disabled={!props.threatForm.type}>
                    Agregar amenaza
                  </Button>
                </Stack>
              )}
            </Stack>

            <Divider />
            <Stack spacing={1}>
              <Typography variant="subtitle2">Recursos de emergencia</Typography>
              {(plan.resources ?? []).map((resource) => {
                const expired = isExpiredDate(resource.expiresAt)
                return (
                  <Stack key={resource.id} direction="row" spacing={1.5} alignItems="center">
                    <Chip
                      size="small"
                      color={resource.status === 'OPERATIVE' && !expired ? 'success' : expired ? 'error' : 'warning'}
                      label={resourceStatuses.find((status) => status.value === resource.status)?.label ?? resource.status}
                      variant="outlined"
                    />
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {resource.quantity} × {resource.resourceType}
                      {resource.location ? ` — ${resource.location}` : ''}
                      {resource.expiresAt ? ` (vence ${new Date(resource.expiresAt).toLocaleDateString()})` : ''}
                    </Typography>
                    {props.canManage && (
                      <Button size="small" color="error" onClick={() => props.onRemoveResource(resource)}>
                        Eliminar
                      </Button>
                    )}
                  </Stack>
                )
              })}
              {(plan.resources ?? []).length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Sin recursos registrados.
                </Typography>
              )}
              {props.canManage && (
                <Stack direction="row" spacing={2} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                  <TextField
                    label="Tipo de recurso"
                    value={props.resourceForm.resourceType}
                    onChange={(event) => props.onResourceFormChange({ ...props.resourceForm, resourceType: event.target.value })}
                    placeholder="Extintor, botiquín, alarma..."
                    required
                  />
                  <TextField
                    label="Ubicación"
                    value={props.resourceForm.location}
                    onChange={(event) => props.onResourceFormChange({ ...props.resourceForm, location: event.target.value })}
                  />
                  <TextField
                    label="Cantidad"
                    type="number"
                    value={props.resourceForm.quantity}
                    onChange={(event) => props.onResourceFormChange({ ...props.resourceForm, quantity: event.target.value === '' ? '' : Number(event.target.value) })}
                    sx={{ width: 120 }}
                  />
                  <TextField
                    label="Vence"
                    type="date"
                    value={props.resourceForm.expiresAt}
                    onChange={(event) => props.onResourceFormChange({ ...props.resourceForm, expiresAt: event.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                  <Button variant="contained" onClick={props.onSaveResource} disabled={!props.resourceForm.resourceType}>
                    Agregar recurso
                  </Button>
                </Stack>
              )}
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}

export function EmergencyDrillDialog(props: {
  open: boolean
  editing: boolean
  values: EmergencyDrillFormValues
  plans: Array<{ id: string; name: string }>
  companies: Company[]
  loading: boolean
  canPickCompany: boolean
  onChange: (values: EmergencyDrillFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Editar simulacro' : 'Nuevo simulacro'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Nombre"
            value={props.values.name}
            onChange={(event) => props.onChange({ ...props.values, name: event.target.value })}
            required
          />
          <TextField
            label="Escenario"
            value={props.values.scenario}
            onChange={(event) => props.onChange({ ...props.values, scenario: event.target.value })}
            placeholder="Incendio en bodega, sismo, evacuación total..."
          />
          <Stack direction="row" spacing={2}>
            <TextField
              select
              label="Plan de emergencias"
              value={props.values.planId}
              onChange={(event) => props.onChange({ ...props.values, planId: event.target.value })}
              fullWidth
              required
            >
              {props.plans.map((plan) => (
                <MenuItem key={plan.id} value={plan.id}>
                  {plan.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Fecha programada"
              type="datetime-local"
              value={props.values.plannedAt}
              onChange={(event) => props.onChange({ ...props.values, plannedAt: event.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
              required
            />
          </Stack>
          {props.canPickCompany ? (
            <TextField
              select
              label="Empresa"
              value={props.values.companyId}
              onChange={(event) => props.onChange({ ...props.values, companyId: event.target.value })}
              fullWidth
            >
              {props.companies.map((company) => (
                <MenuItem key={company.id} value={company.id}>
                  {company.name}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <TextField
              label="Empresa"
              value={props.companies.find((company) => company.id === props.values.companyId)?.name || props.values.companyId}
              InputProps={{ readOnly: true }}
              fullWidth
            />
          )}
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

export function EmergencyDrillDetailDialog(props: {
  open: boolean
  drill: EmergencyDrill | null
  canManage: boolean
  findingForm: EmergencyDrillFindingFormValues
  onFindingFormChange: (values: EmergencyDrillFindingFormValues) => void
  onSaveFinding: () => void
  onRemoveFinding: (finding: EmergencyDrillFinding) => void
  onToggleFinding: (finding: EmergencyDrillFinding, closed: boolean) => void
  onMarkExecuted?: (drill: EmergencyDrill) => void
  onMarkClosed?: (drill: EmergencyDrill) => void
  onClose: () => void
}) {
  const drill = props.drill
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {drill ? `${drill.name}` : 'Simulacro'}
        {drill && (
          <Typography variant="caption" display="block" color="text.secondary">
            {drill.plan?.name ?? drill.planId}
            {drill.plan?.site?.name ? ` — ${drill.plan.site.name}` : ''}
            {` · programado ${new Date(drill.plannedAt).toLocaleString()}`}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers>
        {drill && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              <Chip size="small" label={drillStatuses.find((status) => status.value === drill.status)?.label ?? drill.status} color={drill.status === 'CLOSED' ? 'success' : drill.status === 'CANCELLED' ? 'error' : 'primary'} variant="outlined" />
              {drill.executedAt && (
                <Chip size="small" label={`Ejecutado ${new Date(drill.executedAt).toLocaleDateString()}`} variant="outlined" />
              )}
              {typeof drill.durationMinutes === 'number' && <Chip size="small" label={`${drill.durationMinutes} min`} variant="outlined" />}
              {typeof drill.participants === 'number' && <Chip size="small" label={`${drill.participants} participantes`} variant="outlined" />}
            </Stack>
            {drill.resultNotes && (
              <Alert severity="info" variant="outlined">
                {drill.resultNotes}
              </Alert>
            )}
            {props.canManage && drill.status !== 'CLOSED' && drill.status !== 'CANCELLED' && (
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
                {drill.status === 'PLANNED' && (
                  <Button size="small" variant="outlined" onClick={() => props.onMarkExecuted?.(drill)}>
                    Marcar ejecutado
                  </Button>
                )}
                {drill.status === 'EXECUTED' && (
                  <Button size="small" variant="outlined" color="success" onClick={() => props.onMarkClosed?.(drill)}>
                    Cerrar simulacro
                  </Button>
                )}
              </Stack>
            )}
            <Divider />
            <Typography variant="subtitle2">Hallazgos y acciones</Typography>
            {(drill.findings ?? []).map((finding) => (
              <Stack key={finding.id} spacing={0.5}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Chip
                    size="small"
                    color={finding.severity === 'CRITICAL' ? 'error' : finding.severity === 'MAJOR' ? 'warning' : 'default'}
                    label={findingSeverities.find((severity) => severity.value === finding.severity)?.label ?? finding.severity}
                    variant="outlined"
                  />
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {finding.closedAt ? '✔ ' : '• '}
                    {finding.description}
                  </Typography>
                  {props.canManage && (
                    <>
                      <Button size="small" onClick={() => props.onToggleFinding(finding, !finding.closedAt)}>
                        {finding.closedAt ? 'Reabrir' : 'Cerrar'}
                      </Button>
                      <Button size="small" color="error" onClick={() => props.onRemoveFinding(finding)}>
                        Eliminar
                      </Button>
                    </>
                  )}
                </Stack>
                {finding.actionDescription && (
                  <Typography variant="caption" color="text.secondary" sx={{ pl: 4 }}>
                    Acción: {finding.actionDescription}
                    {finding.actionResponsible ? ` — responsable: ${finding.actionResponsible}` : ''}
                    {finding.actionDueDate ? ` — vence ${new Date(finding.actionDueDate).toLocaleDateString()}` : ''}
                  </Typography>
                )}
              </Stack>
            ))}
            {(drill.findings ?? []).length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Sin hallazgos registrados.
              </Typography>
            )}
            {props.canManage && (
              <>
                <Divider />
                <Typography variant="subtitle2">Nuevo hallazgo</Typography>
                <TextField
                  label="Descripción del hallazgo"
                  value={props.findingForm.description}
                  onChange={(event) => props.onFindingFormChange({ ...props.findingForm, description: event.target.value })}
                  required
                />
                <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                  <TextField
                    select
                    label="Severidad"
                    value={props.findingForm.severity}
                    onChange={(event) => props.onFindingFormChange({ ...props.findingForm, severity: event.target.value as EmergencyFindingSeverity })}
                    sx={{ minWidth: 140 }}
                  >
                    {findingSeverities.map((severity) => (
                      <MenuItem key={severity.value} value={severity.value}>
                        {severity.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Acción correctiva"
                    value={props.findingForm.actionDescription}
                    onChange={(event) => props.onFindingFormChange({ ...props.findingForm, actionDescription: event.target.value })}
                    fullWidth
                  />
                </Stack>
                <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
                  <TextField
                    label="Responsable de la acción"
                    value={props.findingForm.actionResponsible}
                    onChange={(event) => props.onFindingFormChange({ ...props.findingForm, actionResponsible: event.target.value })}
                    fullWidth
                  />
                  <TextField
                    label="Fecha límite"
                    type="date"
                    value={props.findingForm.actionDueDate}
                    onChange={(event) => props.onFindingFormChange({ ...props.findingForm, actionDueDate: event.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                  <Button variant="contained" onClick={props.onSaveFinding} disabled={!props.findingForm.description}>
                    Registrar hallazgo
                  </Button>
                </Stack>
              </>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}
