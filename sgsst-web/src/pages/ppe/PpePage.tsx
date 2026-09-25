import { Delete, Edit, LocalShipping } from '@mui/icons-material'
import { Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Paper, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, Typography } from '@mui/material'
import { useState } from 'react'
import { ActiveCompanyBanner, Pager, TableControls, TableHeader, ViewBreadcrumb } from '../../components/TablePieces'
import type { PageMeta, PpeDelivery, PpeItem, TableState } from '../../types'

export function PpePage(props: {
  items: PpeItem[]
  deliveries: PpeDelivery[]
  itemMeta: PageMeta
  tableState: TableState
  canManage: boolean
  employees: Array<{ id: string; firstName: string; lastName: string; document: string }>
  onTableChange: (state: TableState) => void
  onCreateItem: () => void
  onPreloadCreateItem?: () => void
  onEditItem: (item: PpeItem) => void
  onDeleteItem: (id: string) => void
  onNewDelivery: () => void
  onEmployeeExpediente: (employeeId: string) => void
  activeCompanyName?: string
}) {
  const [tab, setTab] = useState(0)
  const [expediente, setExpediente] = useState<{ employeeName: string; deliveries: PpeDelivery[] } | null>(null)

  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <ViewBreadcrumb view="EPP" />
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
        <Tabs value={tab} onChange={(_e, value: number) => setTab(value)}>
          <Tab label="Catalogo e inventario" />
          <Tab label="Entregas" />
        </Tabs>
        <Button variant="contained" disabled={!props.canManage} onClick={props.onNewDelivery} startIcon={<LocalShipping />}>
          Registrar entrega
        </Button>
      </Stack>
      {tab === 0 && (
        <>
          <TableHeader title="Catalogo EPP" canCreate={props.canManage} onCreate={props.onCreateItem} onPreloadCreate={props.onPreloadCreateItem} />
          <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar por nombre o tipo" />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Elemento</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Norma</TableCell>
                  <TableCell>Talla</TableCell>
                  <TableCell align="right">Stock</TableCell>
                  <TableCell align="right">Stock minimo</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {props.items.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.type ?? '-'}</TableCell>
                    <TableCell>{item.standard ?? '-'}</TableCell>
                    <TableCell>{item.size ?? '-'}</TableCell>
                    <TableCell align="right">
                      <Chip
                        size="small"
                        color={item.stock < item.stockMin ? 'error' : 'default'}
                        label={String(item.stock)}
                      />
                    </TableCell>
                    <TableCell align="right">{item.stockMin}</TableCell>
                    <TableCell>
                      <Chip size="small" color={item.isActive ? 'success' : 'default'} label={item.isActive ? 'Activo' : 'Inactivo'} />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton disabled={!props.canManage} onClick={() => props.onEditItem(item)}>
                        <Edit />
                      </IconButton>
                      <IconButton disabled={!props.canManage} color="error" onClick={() => props.onDeleteItem(item.id)}>
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {props.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Typography variant="body2" color="text.secondary">Sin elementos EPP registrados.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
      {tab === 1 && (
        <>
          <TableHeader title="Entregas de EPP" canCreate={false} onCreate={() => undefined} />
          <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar por trabajador o elemento" />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Trabajador</TableCell>
                  <TableCell>Elemento</TableCell>
                  <TableCell align="right">Cantidad</TableCell>
                  <TableCell>Entregado</TableCell>
                  <TableCell>Reposicion</TableCell>
                  <TableCell align="right">Expediente</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {props.deliveries.map((delivery) => (
                  <TableRow key={delivery.id} hover>
                    <TableCell>
                      {delivery.employee ? `${delivery.employee.firstName} ${delivery.employee.lastName}` : '-'}
                    </TableCell>
                    <TableCell>{delivery.item?.name ?? '-'}</TableCell>
                    <TableCell align="right">{delivery.quantity}</TableCell>
                    <TableCell>{delivery.deliveredAt.slice(0, 10)}</TableCell>
                    <TableCell>{delivery.dueReplacementAt?.slice(0, 10) ?? '-'}</TableCell>
                    <TableCell align="right">
                      {delivery.employee && (
                        <Button
                          size="small"
                          onClick={() =>
                            props.onEmployeeExpediente(delivery.employee!.id) ??
                            setExpediente({
                              employeeName: `${delivery.employee!.firstName} ${delivery.employee!.lastName}`,
                              deliveries: [delivery],
                            })
                          }
                        >
                          Ver
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {props.deliveries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography variant="body2" color="text.secondary">Sin entregas registradas.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
      <Pager meta={props.itemMeta} state={props.tableState} onChange={props.onTableChange} />

      <Dialog open={Boolean(expediente)} onClose={() => setExpediente(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Expediente EPP: {expediente?.employeeName}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1} sx={{ mt: 1 }}>
            {(expediente?.deliveries ?? []).map((delivery) => (
              <Stack key={delivery.id} direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {delivery.item?.name} x{delivery.quantity}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Entregado {delivery.deliveredAt.slice(0, 10)}
                  {delivery.dueReplacementAt ? ` - Reposicion ${delivery.dueReplacementAt.slice(0, 10)}` : ''}
                </Typography>
              </Stack>
            ))}
            {(expediente?.deliveries.length ?? 0) === 0 && (
              <Typography variant="body2" color="text.secondary">Sin entregas para este trabajador.</Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExpediente(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}
