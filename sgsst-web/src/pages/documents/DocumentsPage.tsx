import { Delete, Edit, OpenInNew, RestoreFromTrash } from '@mui/icons-material'
import {
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from '@mui/material'
import { ActiveChip, Pager, TableControls, TableHeader } from '../../components/TablePieces'
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
}) {
  return (
    <Paper className="panel" variant="outlined">
      <TableHeader title="Documentos y evidencias" canCreate={props.canManage} onCreate={props.onCreate} onPreloadCreate={props.onPreloadCreate} />
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
                      <IconButton href={document.fileUrl} target="_blank" rel="noreferrer" disabled={!document.fileUrl}>
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
