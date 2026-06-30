import { Delete, DeleteForever, Edit, RestoreFromTrash } from '@mui/icons-material'
import { IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip } from '@mui/material'
import { riskClassLabels } from '../../constants/catalogs'
import { ActiveChip, ActiveCompanyBanner, Pager, TableControls, TableHeader } from '../../components/TablePieces'
import type { Company, PageMeta, TableState } from '../../types'

export function CompaniesPage(props: {
  companies: Company[]
  meta: PageMeta
  tableState: TableState
  canManage: boolean
  onTableChange: (state: TableState) => void
  onCreate: () => void
  onPreloadCreate?: () => void
  onEdit: (item: Company) => void
  onDelete: (id: string) => void
  onDeletePermanent: (id: string) => void
  onRestore: (id: string) => void
  activeCompanyName?: string
}) {
  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <TableHeader title="CRUD Empresas" canCreate={props.canManage} onCreate={props.onCreate} onPreloadCreate={props.onPreloadCreate} />
      <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar por empresa, NIT o correo" />
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Empresa</TableCell>
              <TableCell>NIT</TableCell>
              <TableCell>ARL / Riesgo</TableCell>
              <TableCell>Ciudad</TableCell>
              <TableCell>Contacto</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.companies.map((company) => (
              <TableRow key={company.id} hover>
                <TableCell>{company.name}</TableCell>
                <TableCell>{company.nit}</TableCell>
                <TableCell>
                  {company.arl || '-'} / {riskClassLabels[company.riskClass]}
                </TableCell>
                <TableCell>{[company.city, company.department].filter(Boolean).join(', ') || '-'}</TableCell>
                <TableCell>{company.email || company.phone || '-'}</TableCell>
                <TableCell>
                  <ActiveChip active={company.isActive} />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Editar empresa">
                    <IconButton disabled={!props.canManage} onClick={() => props.onEdit(company)}>
                      <Edit />
                    </IconButton>
                  </Tooltip>
                  {company.isActive ? (
                    <Tooltip title="Desactivar empresa">
                      <IconButton disabled={!props.canManage} color="error" onClick={() => props.onDelete(company.id)}>
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <>
                      <Tooltip title="Restaurar empresa">
                        <IconButton disabled={!props.canManage} color="success" onClick={() => props.onRestore(company.id)}>
                          <RestoreFromTrash />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar permanentemente">
                        <IconButton disabled={!props.canManage} color="error" onClick={() => props.onDeletePermanent(company.id)}>
                          <DeleteForever />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Pager meta={props.meta} state={props.tableState} onChange={props.onTableChange} />
    </Paper>
  )
}
