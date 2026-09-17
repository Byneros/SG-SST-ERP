import { Delete, Edit, OpenInNew, RestoreFromTrash } from '@mui/icons-material'
import {
  Chip,
  Button,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from '@mui/material'
import type { ReportFormat } from '../../api/client'
import { ActiveChip, ActiveCompanyBanner, Pager, TableControls, TableHeader } from '../../components/TablePieces'
import { documentCategoryLabels, documentStatusLabels } from '../../constants/catalogs'
import type { PageMeta, SgsstDocument, TableState } from '../../types'

export function DocumentsPage(props: {
  documents: SgsstDocument[]
  meta: PageMeta
  tableState: TableState
  canManage: boolean
  onTableChange: (state: TableState) => void
  onCreate: () => void
  onPreloadCreate?: () => void
  onEdit: (item: SgsstDocument) => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
  onDownload: (document: SgsstDocument) => void
  onDownloadReport: (format: ReportFormat) => void
  onScheduleReport: (format: ReportFormat) => void
  activeCompanyName?: string
}) {
  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <TableHeader title="Documentos y evidencias" canCreate={props.canManage} onCreate={props.onCreate} onPreloadCreate={props.onPreloadCreate} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end" sx={{ mb: 2 }}>
        <Button variant="outlined" onClick={() => props.onDownloadReport('pdf')}>
          Vencidos PDF
        </Button>
        <Button variant="outlined" onClick={() => props.onDownloadReport('csv')}>
          Vencidos CSV
        </Button>
        <Button variant="contained" onClick={() => props.onScheduleReport('pdf')}>
          Programar PDF
        </Button>
      </Stack>
      <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar por documento, archivo o empresa" />
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Documento</TableCell>
              <TableCell>Empresa</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Version</TableCell>
              <TableCell>Vence</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.documents.map((document) => (
              <TableRow key={document.id} hover>
                <TableCell>
                  {document.name}
                  {document.fileName ? <Chip size="small" label={document.fileName} sx={{ ml: 1 }} /> : null}
                </TableCell>
                <TableCell>{document.company?.name ?? '-'}</TableCell>
                <TableCell>{documentCategoryLabels[document.category]}</TableCell>
                <TableCell>v{document.version}</TableCell>
                <TableCell>{document.expiresAt ? document.expiresAt.slice(0, 10) : '-'}</TableCell>
                <TableCell>
                  <ActiveChip active={document.isActive} />{' '}
                  <Chip size="small" label={documentStatusLabels[document.status]} variant="outlined" />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Abrir archivo">
                    <span>
                      <IconButton onClick={() => props.onDownload(document)} disabled={!document.fileUrl}>
                        <OpenInNew />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <IconButton disabled={!props.canManage} onClick={() => props.onEdit(document)}>
                    <Edit />
                  </IconButton>
                  {document.isActive ? (
                    <IconButton disabled={!props.canManage} color="error" onClick={() => props.onDelete(document.id)}>
                      <Delete />
                    </IconButton>
                  ) : (
                    <IconButton disabled={!props.canManage} color="success" onClick={() => props.onRestore(document.id)}>
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
