import { Delete, Edit, RestoreFromTrash } from '@mui/icons-material'
import { Button, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'
import type { ReportFormat } from '../../api/client'
import { contractTypeLabels } from '../../constants/catalogs'
import { ActiveChip, ActiveCompanyBanner, Pager, TableControls, TableHeader } from '../../components/TablePieces'
import type { Employee, PageMeta, TableState } from '../../types'

export function EmployeesPage(props: {
  employees: Employee[]
  meta: PageMeta
  tableState: TableState
  canManage: boolean
  canDelete: boolean
  onTableChange: (state: TableState) => void
  onCreate: () => void
  onPreloadCreate?: () => void
  onEdit: (item: Employee) => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
  onDownloadReport: (format: ReportFormat) => void
  onScheduleReport: (format: ReportFormat) => void
  activeCompanyName?: string
}) {
  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <TableHeader title="CRUD Empleados" canCreate={props.canManage} onCreate={props.onCreate} onPreloadCreate={props.onPreloadCreate} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end" sx={{ mb: 2 }}>
        <Button variant="outlined" onClick={() => props.onDownloadReport('pdf')}>
          Empleados PDF
        </Button>
        <Button variant="outlined" onClick={() => props.onDownloadReport('csv')}>
          Empleados CSV
        </Button>
        <Button variant="contained" onClick={() => props.onScheduleReport('pdf')}>
          Programar PDF
        </Button>
      </Stack>
      <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar por nombre, documento, cargo o correo" />
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Empleado</TableCell>
              <TableCell>Documento</TableCell>
              <TableCell>Cargo</TableCell>
              <TableCell>Contrato</TableCell>
              <TableCell>Centro</TableCell>
              <TableCell>Empresa</TableCell>
              <TableCell>Contacto</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.employees.map((employee) => (
              <TableRow key={employee.id} hover>
                <TableCell>
                  {employee.firstName} {employee.lastName}
                </TableCell>
                <TableCell>
                  {employee.documentType} {employee.document}
                </TableCell>
                <TableCell>{employee.position}</TableCell>
                <TableCell>{contractTypeLabels[employee.contractType]}</TableCell>
                <TableCell>{employee.workCenter || '-'}</TableCell>
                <TableCell>{employee.company?.name ?? '-'}</TableCell>
                <TableCell>{employee.email || employee.phone || '-'}</TableCell>
                <TableCell>
                  <ActiveChip active={employee.isActive} />
                </TableCell>
                <TableCell align="right">
                  <IconButton disabled={!props.canManage} onClick={() => props.onEdit(employee)}>
                    <Edit />
                  </IconButton>
                  {employee.isActive ? (
                    <IconButton disabled={!props.canDelete} color="error" onClick={() => props.onDelete(employee.id)}>
                      <Delete />
                    </IconButton>
                  ) : (
                    <IconButton disabled={!props.canManage} color="success" onClick={() => props.onRestore(employee.id)}>
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
