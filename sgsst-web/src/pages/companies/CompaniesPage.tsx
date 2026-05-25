import { Delete, Edit, RestoreFromTrash } from '@mui/icons-material'
import { IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'
import { riskClassLabels } from '../../constants/catalogs'
import { ActiveChip, Pager, TableControls, TableHeader } from '../../components/TablePieces'
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
  onRestore: (id: string) => void
}) {
  return (
    <Paper className="panel" variant="outlined">
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
                  <IconButton disabled={!props.canManage} onClick={() => props.onEdit(company)}>
                    <Edit />
                  </IconButton>
                  {company.isActive ? (
                    <IconButton disabled={!props.canManage} color="error" onClick={() => props.onDelete(company.id)}>
                      <Delete />
                    </IconButton>
                  ) : (
                    <IconButton disabled={!props.canManage} color="success" onClick={() => props.onRestore(company.id)}>
                      <RestoreFromTrash />
                    </IconButton>
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
