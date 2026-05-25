import { Add } from '@mui/icons-material'
import {
  Box,
  Button,
  Chip,
  MenuItem,
  Stack,
  TablePagination,
  TextField,
  Typography,
} from '@mui/material'
import type { PageMeta, TableState } from '../types'

export function TableHeader({
  title,
  canCreate,
  onCreate,
  onPreloadCreate,
}: {
  title: string
  canCreate: boolean
  onCreate: () => void
  onPreloadCreate?: () => void
}) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
      <Box>
        <Typography variant="h6">{title}</Typography>
        <Typography color="text.secondary">Operaciones protegidas por JWT y permisos de rol.</Typography>
      </Box>
      <Button
        startIcon={<Add />}
        variant="contained"
        disabled={!canCreate}
        onClick={onCreate}
        onFocus={onPreloadCreate}
        onMouseEnter={onPreloadCreate}
      >
        Nuevo
      </Button>
    </Stack>
  )
}

export function TableControls({
  state,
  onChange,
  placeholder,
}: {
  state: TableState
  onChange: (state: TableState) => void
  placeholder: string
}) {
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
      <TextField
        size="small"
        placeholder={placeholder}
        value={state.search}
        onChange={(event) => onChange({ ...state, page: 1, search: event.target.value })}
        sx={{ minWidth: { md: 320 } }}
      />
      <TextField
        select
        size="small"
        label="Estado"
        value={state.isActive}
        onChange={(event) =>
          onChange({
            ...state,
            page: 1,
            isActive: event.target.value as TableState['isActive'],
          })
        }
        sx={{ minWidth: 160 }}
      >
        <MenuItem value="all">Todos</MenuItem>
        <MenuItem value="active">Activos</MenuItem>
        <MenuItem value="inactive">Inactivos</MenuItem>
      </TextField>
    </Stack>
  )
}

export function Pager({
  meta,
  state,
  onChange,
}: {
  meta: PageMeta
  state: TableState
  onChange: (state: TableState) => void
}) {
  return (
    <TablePagination
      component="div"
      count={meta.total}
      page={Math.max(0, state.page - 1)}
      rowsPerPage={state.pageSize}
      rowsPerPageOptions={[5, 10, 25, 50]}
      labelRowsPerPage="Filas"
      onPageChange={(_, page) => onChange({ ...state, page: page + 1 })}
      onRowsPerPageChange={(event) =>
        onChange({ ...state, page: 1, pageSize: Number(event.target.value) })
      }
    />
  )
}

export function ActiveChip({ active }: { active: boolean }) {
  return (
    <Chip
      size="small"
      label={active ? 'Activo' : 'Inactivo'}
      color={active ? 'success' : 'default'}
      variant={active ? 'filled' : 'outlined'}
    />
  )
}
