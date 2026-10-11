import { Archive, Delete, Edit, EventBusy, OpenInNew, Publish } from '@mui/icons-material'
import {
  Chip,
  Button,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
} from '@mui/material'
import type { ReportFormat } from '../../api/client'
import { ActiveCompanyBanner, ActiveSiteFilterChip, Pager, TableControls, TableHeader, ViewBreadcrumb } from '../../components/TablePieces'
import { ModuleAssistantButton } from '../../components/ModuleAssistantButton'
import { documentCategoryLabels, documentStatusLabels } from '../../constants/catalogs'
import type { PageMeta, SgsstDocument, Site, TableState, View } from '../../types'

export function DocumentsPage(props: {
  documents: SgsstDocument[]
  meta: PageMeta
  tableState: TableState
  canManage: boolean
  canApprove: boolean
  canExport: boolean
  sites: Site[]
  siteFilter: string
  onSiteFilterChange: (siteId: string) => void
  onTableChange: (state: TableState) => void
  onCreate: () => void
  onPreloadCreate?: () => void
  onEdit: (item: SgsstDocument) => void
  onDelete: (id: string) => void
  onApprove: (document: SgsstDocument) => void
  onExpire: (document: SgsstDocument) => void
  onArchive: (document: SgsstDocument) => void
  onDownload: (document: SgsstDocument) => void
  onDownloadReport: (format: ReportFormat) => void
  onScheduleReport: (format: ReportFormat) => void
  onOpenAssistant?: (view: View, assistantId: string) => void
  activeCompanyName?: string
}) {
  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <ViewBreadcrumb view="Documentos" />
      <TableHeader
        title="Documentos y evidencias"
        canCreate={props.canManage}
        onCreate={props.onCreate}
        onPreloadCreate={props.onPreloadCreate}
        assistant={props.onOpenAssistant && <ModuleAssistantButton assistantId="documents" onOpen={props.onOpenAssistant} />}
      />
      {props.siteFilter !== 'all' && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <ActiveSiteFilterChip
            siteName={props.sites.find((site) => site.id === props.siteFilter)?.name ?? (props.siteFilter === 'none' ? 'Sin sede asignada' : props.siteFilter)}
            onClear={() => props.onSiteFilterChange('all')}
          />
        </Stack>
      )}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          select
          size="small"
          label="Sede"
          value={props.siteFilter}
          onChange={(event) => props.onSiteFilterChange(event.target.value)}
          sx={{ minWidth: 240 }}
        >
          <MenuItem value="all">Todas las sedes</MenuItem>
          {props.sites.map((site) => (
            <MenuItem key={site.id} value={site.id}>
              {site.code ? `${site.name} (${site.code})` : site.name}
            </MenuItem>
          ))}
          <MenuItem value="none">Sin sede asignada</MenuItem>
        </TextField>
      </Stack>
      {props.canExport && (
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
      )}
      <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar por documento, archivo o empresa" />
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Documento</TableCell>
              <TableCell>Empresa</TableCell>
              <TableCell>Sede</TableCell>
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
                <TableCell>{document.site?.name ?? '-'}</TableCell>
                <TableCell>{documentCategoryLabels[document.category]}</TableCell>
                <TableCell>v{document.version}</TableCell>
                <TableCell>{document.expiresAt ? document.expiresAt.slice(0, 10) : '-'}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Chip size="small" label={documentStatusLabels[document.status]} variant="outlined" />
                    {document.approvals?.[0] && (
                      <Tooltip title={`Aprobado por ${document.approvals[0].approver?.name ?? 'administrador'} en v${document.approvals[0].version}`}>
                        <Chip size="small" color="success" label="Aprobado" />
                      </Tooltip>
                    )}
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Abrir archivo">
                    <span>
                      <IconButton onClick={() => props.onDownload(document)} disabled={!document.fileUrl}>
                        <OpenInNew />
                      </IconButton>
                    </span>
                  </Tooltip>
                  {props.canApprove && document.status === 'DRAFT' && (
                    <Tooltip title="Aprobar y publicar">
                      <IconButton color="success" onClick={() => props.onApprove(document)}>
                        <Publish />
                      </IconButton>
                    </Tooltip>
                  )}
                  {props.canManage && document.status === 'PUBLISHED' && document.expiresAt && new Date(document.expiresAt) <= new Date() && (
                    <Tooltip title="Marcar vencido">
                      <IconButton color="warning" onClick={() => props.onExpire(document)}>
                        <EventBusy />
                      </IconButton>
                    </Tooltip>
                  )}
                  {props.canManage && document.status !== 'ARCHIVED' && (
                    <Tooltip title="Archivar documento">
                      <IconButton onClick={() => props.onArchive(document)}>
                        <Archive />
                      </IconButton>
                    </Tooltip>
                  )}
                  <IconButton disabled={!props.canManage} onClick={() => props.onEdit(document)}>
                    <Edit />
                  </IconButton>
                  <IconButton disabled={!props.canManage} color="error" onClick={() => props.onDelete(document.id)}>
                    <Delete />
                  </IconButton>
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
