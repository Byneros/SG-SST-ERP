import { Delete, Edit } from '@mui/icons-material'
import { Box, Chip, IconButton, Paper, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, Typography } from '@mui/material'
import { ActiveCompanyBanner, Pager, TableControls, TableHeader } from '../../components/TablePieces'
import { ModuleAssistantButton } from '../../components/ModuleAssistantButton'
import type { EmergencyBrigade, EmergencyDrill, EmergencyDrillStatus, EmergencyPlan, PageMeta, TableState, View } from '../../types'

const drillStatusLabel: Record<EmergencyDrillStatus, string> = {
  PLANNED: 'Programado',
  EXECUTED: 'Ejecutado',
  CLOSED: 'Cerrado',
  CANCELLED: 'Cancelado',
}

const drillStatusColor: Record<EmergencyDrillStatus, 'default' | 'primary' | 'success' | 'error' | 'warning'> = {
  PLANNED: 'default',
  EXECUTED: 'primary',
  CLOSED: 'success',
  CANCELLED: 'error',
}

/** Marca de formacion vencida de brigadistas (criterio #31). */
function isExpiredDate(value?: string | null): boolean {
  return Boolean(value && new Date(value).getTime() < Date.now())
}

export type EmergencyTab = 'brigades' | 'plans' | 'drills'

export function EmergencyPage(props: {
  tab: EmergencyTab
  onTabChange: (tab: EmergencyTab) => void
  brigades: EmergencyBrigade[]
  brigadeMeta: PageMeta
  brigadeTable: TableState
  plans: EmergencyPlan[]
  planMeta: PageMeta
  planTable: TableState
  drills: EmergencyDrill[]
  drillMeta: PageMeta
  drillTable: TableState
  canManage: boolean
  onBrigadeTableChange: (state: TableState) => void
  onPlanTableChange: (state: TableState) => void
  onDrillTableChange: (state: TableState) => void
  onCreateBrigade: () => void
  onEditBrigade: (item: EmergencyBrigade) => void
  onDeleteBrigade: (item: EmergencyBrigade) => void
  onOpenBrigadeDetail: (item: EmergencyBrigade) => void
  onCreatePlan: () => void
  onEditPlan: (item: EmergencyPlan) => void
  onDeletePlan: (item: EmergencyPlan) => void
  onOpenPlanDetail: (item: EmergencyPlan) => void
  onCreateDrill: () => void
  onEditDrill: (item: EmergencyDrill) => void
  onDeleteDrill: (item: EmergencyDrill) => void
  onOpenDrillDetail: (item: EmergencyDrill) => void
  onOpenAssistant?: (view: View, assistantId: string) => void
  activeCompanyName?: string
}) {
  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={props.tab} onChange={(_, next: EmergencyTab) => props.onTabChange(next)}>
          <Tab value="brigades" label={`Brigadas (${props.brigadeMeta.total})`} />
          <Tab value="plans" label={`Planes por sede (${props.planMeta.total})`} />
          <Tab value="drills" label={`Simulacros (${props.drillMeta.total})`} />
        </Tabs>
      </Box>

      {props.tab === 'brigades' && (
        <>
          <TableHeader
            title="Brigadas de emergencia"
            canCreate={props.canManage}
            onCreate={props.onCreateBrigade}
            assistant={props.onOpenAssistant && <ModuleAssistantButton assistantId="emergency" onOpen={props.onOpenAssistant} />}
          />
          <TableControls state={props.brigadeTable} onChange={props.onBrigadeTableChange} placeholder="Buscar brigada" />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Brigada</TableCell>
                  <TableCell>Sede</TableCell>
                  <TableCell>Integrantes</TableCell>
                  <TableCell>Formación vencida</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {props.brigades.map((brigade) => {
                  const expired = (brigade.members ?? []).filter((member) => isExpiredDate(member.validUntil)).length
                  return (
                    <TableRow key={brigade.id} hover>
                      <TableCell>
                        <Typography variant="body2">{brigade.name}</Typography>
                      </TableCell>
                      <TableCell>{brigade.site?.name ?? brigade.siteId}</TableCell>
                      <TableCell>{brigade._count?.members ?? brigade.members?.length ?? 0}</TableCell>
                      <TableCell>
                        {expired > 0 ? (
                          <Chip size="small" color="error" label={`${expired} vencida(s)`} variant="outlined" />
                        ) : (
                          <Chip size="small" color="success" label="Al día" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" color="primary" title="Integrantes" onClick={() => props.onOpenBrigadeDetail(brigade)}>
                          <Edit />
                        </IconButton>
                        <IconButton size="small" disabled={!props.canManage} onClick={() => props.onEditBrigade(brigade)}>
                          <Edit />
                        </IconButton>
                        <IconButton size="small" disabled={!props.canManage} color="error" onClick={() => props.onDeleteBrigade(brigade)}>
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {props.brigades.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                        Sin brigadas para mostrar.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Pager meta={props.brigadeMeta} state={props.brigadeTable} onChange={props.onBrigadeTableChange} />
        </>
      )}

      {props.tab === 'plans' && (
        <>
          <TableHeader
            title="Planes de emergencias por sede"
            canCreate={props.canManage}
            onCreate={props.onCreatePlan}
          />
          <TableControls state={props.planTable} onChange={props.onPlanTableChange} placeholder="Buscar plan" />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Plan</TableCell>
                  <TableCell>Sede</TableCell>
                  <TableCell>Responsable</TableCell>
                  <TableCell>Amenazas</TableCell>
                  <TableCell>Recursos</TableCell>
                  <TableCell>Simulacros</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {props.plans.map((plan) => (
                  <TableRow key={plan.id} hover>
                    <TableCell>
                      <Typography variant="body2">{plan.name}</Typography>
                      {plan.meetingPoint && (
                        <Typography variant="caption" color="text.secondary">
                          Punto de encuentro: {plan.meetingPoint}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{plan.site?.name ?? plan.siteId}</TableCell>
                    <TableCell>
                      {plan.responsible ? `${plan.responsible.firstName} ${plan.responsible.lastName}` : '-'}
                    </TableCell>
                    <TableCell>{plan._count?.threats ?? plan.threats?.length ?? 0}</TableCell>
                    <TableCell>{plan._count?.resources ?? plan.resources?.length ?? 0}</TableCell>
                    <TableCell>{plan._count?.drills ?? 0}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="primary" title="Amenazas y recursos" onClick={() => props.onOpenPlanDetail(plan)}>
                        <Edit />
                      </IconButton>
                      <IconButton size="small" disabled={!props.canManage} onClick={() => props.onEditPlan(plan)}>
                        <Edit />
                      </IconButton>
                      <IconButton size="small" disabled={!props.canManage} color="error" onClick={() => props.onDeletePlan(plan)}>
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {props.plans.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                        Sin planes de emergencias. Cada sede tiene su plan independiente.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Pager meta={props.planMeta} state={props.planTable} onChange={props.onPlanTableChange} />
        </>
      )}

      {props.tab === 'drills' && (
        <>
          <TableHeader
            title="Simulacros de emergencia"
            canCreate={props.canManage}
            onCreate={props.onCreateDrill}
          />
          <TableControls state={props.drillTable} onChange={props.onDrillTableChange} placeholder="Buscar simulacro" />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Simulacro</TableCell>
                  <TableCell>Plan / sede</TableCell>
                  <TableCell>Programado</TableCell>
                  <TableCell>Ejecutado</TableCell>
                  <TableCell>Hallazgos</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {props.drills.map((drill) => (
                  <TableRow key={drill.id} hover>
                    <TableCell>
                      <Typography variant="body2">{drill.name}</Typography>
                      {drill.scenario && (
                        <Typography variant="caption" color="text.secondary">
                          {drill.scenario}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {drill.plan?.name ?? drill.planId}
                      {drill.plan?.site?.name ? ` — ${drill.plan.site.name}` : ''}
                    </TableCell>
                    <TableCell>{new Date(drill.plannedAt).toLocaleDateString()}</TableCell>
                    <TableCell>{drill.executedAt ? new Date(drill.executedAt).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>{drill._count?.findings ?? drill.findings?.length ?? 0}</TableCell>
                    <TableCell>
                      <Chip size="small" label={drillStatusLabel[drill.status]} color={drillStatusColor[drill.status]} variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="primary" title="Hallazgos y cierre" onClick={() => props.onOpenDrillDetail(drill)}>
                        <Edit />
                      </IconButton>
                      <IconButton size="small" disabled={!props.canManage} onClick={() => props.onEditDrill(drill)}>
                        <Edit />
                      </IconButton>
                      <IconButton size="small" disabled={!props.canManage} color="error" onClick={() => props.onDeleteDrill(drill)}>
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {props.drills.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                        Sin simulacros. Planifica uno vinculado a un plan de emergencias.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Pager meta={props.drillMeta} state={props.drillTable} onChange={props.onDrillTableChange} />
        </>
      )}
    </Paper>
  )
}
