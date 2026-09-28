import { useState } from 'react'
import { Delete, Edit, VerifiedUser } from '@mui/icons-material'
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { ActiveCompanyBanner, Pager, TableControls, TableHeader } from '../../components/TablePieces'
import type { Contractor, ContractorEntryAuthorization, ContractorStatus, PageMeta, TableState } from '../../types'

const statusColor: Record<ContractorStatus, 'success' | 'warning' | 'error'> = {
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  BLOCKED: 'error',
}

const statusLabel: Record<ContractorStatus, string> = {
  ACTIVE: 'Activo',
  SUSPENDED: 'Suspendido',
  BLOCKED: 'Bloqueado',
}

export function ContractorsPage(props: {
  contractors: Contractor[]
  meta: PageMeta
  tableState: TableState
  canManage: boolean
  canViewEntryAuth: boolean
  onTableChange: (state: TableState) => void
  onCreate: () => void
  onPreloadCreate?: () => void
  onEdit: (item: Contractor) => void
  onDelete: (item: Contractor) => void
  onOpenEntryAuth: (item: Contractor) => void
  entryAuth: ContractorEntryAuthorization | null
  entryAuthLoading: boolean
  onCloseEntryAuth: () => void
  activeCompanyName?: string
}) {
  const [statusFilter, setStatusFilter] = useState<'all' | ContractorStatus>('all')

  const visible = statusFilter === 'all' ? props.contractors : props.contractors.filter((item) => item.status === statusFilter)

  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <TableHeader title="Contratistas" canCreate={props.canManage} onCreate={props.onCreate} onPreloadCreate={props.onPreloadCreate} />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar por nombre o NIT" />
        </Box>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
          <Chip
            size="small"
            label="Todos"
            color={statusFilter === 'all' ? 'primary' : 'default'}
            variant={statusFilter === 'all' ? 'filled' : 'outlined'}
            onClick={() => setStatusFilter('all')}
          />
          {(Object.keys(statusLabel) as ContractorStatus[]).map((status) => (
            <Chip
              key={status}
              size="small"
              label={statusLabel[status]}
              color={statusFilter === status ? 'primary' : 'default'}
              variant={statusFilter === status ? 'filled' : 'outlined'}
              onClick={() => setStatusFilter(status)}
            />
          ))}
        </Stack>
      </Stack>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Contratista</TableCell>
              <TableCell>NIT</TableCell>
              <TableCell>Contacto</TableCell>
              <TableCell>Personal</TableCell>
              <TableCell>Documentos</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((contractor) => (
              <TableRow key={contractor.id} hover>
                <TableCell>
                  <Typography variant="body2">{contractor.name}</Typography>
                  {contractor.activity && (
                    <Typography variant="caption" color="text.secondary">
                      {contractor.activity}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>{contractor.nit}</TableCell>
                <TableCell>
                  {[contractor.contact, contractor.phone].filter(Boolean).join(' · ') || '-'}
                </TableCell>
                <TableCell>{contractor._count?.workers ?? 0}</TableCell>
                <TableCell>{contractor._count?.documents ?? 0}</TableCell>
                <TableCell>
                  <Chip size="small" label={statusLabel[contractor.status]} color={statusColor[contractor.status]} variant="outlined" />
                </TableCell>
                <TableCell align="right">
                  {props.canViewEntryAuth && (
                    <IconButton size="small" color="primary" title="Autorización de ingreso" onClick={() => props.onOpenEntryAuth(contractor)}>
                      <VerifiedUser />
                    </IconButton>
                  )}
                  <IconButton size="small" disabled={!props.canManage} onClick={() => props.onEdit(contractor)}>
                    <Edit />
                  </IconButton>
                  <IconButton size="small" disabled={!props.canManage} color="error" onClick={() => props.onDelete(contractor)}>
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                    Sin contratistas para mostrar.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Pager meta={props.meta} state={props.tableState} onChange={props.onTableChange} />
      <EntryAuthorizationDialog
        entryAuth={props.entryAuth}
        loading={props.entryAuthLoading}
        onClose={props.onCloseEntryAuth}
      />
    </Paper>
  )
}

/**
 * Dialogo de autorizacion de ingreso: refleja la decision del backend
 * (canAuthorizeEntry) y las razones de bloqueo; la UI nunca decide sola.
 */
function EntryAuthorizationDialog(props: {
  entryAuth: ContractorEntryAuthorization | null
  loading: boolean
  onClose: () => void
}) {
  const entryAuth = props.entryAuth
  return (
    <Dialog open={entryAuth !== null || props.loading} onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle>Autorización de ingreso</DialogTitle>
      <DialogContent dividers>
        {props.loading && (
          <Typography variant="body2" color="text.secondary">
            Cargando cumplimiento del contratista...
          </Typography>
        )}
        {!props.loading && entryAuth && (
          <Stack spacing={2}>
            <Alert severity={entryAuth.canAuthorizeEntry ? 'success' : 'error'} variant="outlined">
              <Typography variant="subtitle2">
                {entryAuth.canAuthorizeEntry
                  ? 'El contratista cumple los requisitos: ingreso AUTORIZADO.'
                  : 'El contratista NO puede ingresar: revise las razones de bloqueo.'}
              </Typography>
            </Alert>
            {entryAuth.contractor && (
              <Typography variant="body2">
                {entryAuth.contractor.name} — estado {entryAuth.contractor.status}
              </Typography>
            )}
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip size="small" label={`Documentos: ${entryAuth.documentsTotal}`} variant="outlined" />
              <Chip size="small" label={`Personal: ${entryAuth.workersActive}/${entryAuth.workersTotal} activo(s)`} variant="outlined" />
              {entryAuth.workersWithoutInduction > 0 && (
                <Chip size="small" color="warning" label={`${entryAuth.workersWithoutInduction} sin inducción`} variant="outlined" />
              )}
              {entryAuth.expiredByDate.length > 0 && (
                <Chip size="small" color="error" label={`${entryAuth.expiredByDate.length} vencido(s) por fecha`} variant="outlined" />
              )}
            </Stack>
            {Object.keys(entryAuth.byDocumentStatus).length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {Object.entries(entryAuth.byDocumentStatus).map(([status, count]) => (
                  <Chip
                    key={status}
                    size="small"
                    label={`${status}: ${count}`}
                    color={status === 'VALID' ? 'success' : status === 'PENDING' ? 'warning' : 'error'}
                    variant="outlined"
                  />
                ))}
              </Stack>
            )}
            {entryAuth.blockingReasons.length > 0 && (
              <Stack spacing={0.5}>
                <Typography variant="subtitle2">Razones de bloqueo</Typography>
                {entryAuth.blockingReasons.map((reason) => (
                  <Typography key={reason} variant="body2" color="error">
                    • {reason}
                  </Typography>
                ))}
              </Stack>
            )}
            {entryAuth.expiredByDate.length > 0 && (
              <Stack spacing={0.5}>
                <Typography variant="subtitle2">Documentos vencidos por fecha</Typography>
                {entryAuth.expiredByDate.map((doc) => (
                  <Typography key={doc.id} variant="body2" color="text.secondary">
                    • {doc.documentType}
                    {doc.expiresAt ? ` — venció el ${new Date(doc.expiresAt).toLocaleDateString()}` : ''}
                  </Typography>
                ))}
              </Stack>
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
