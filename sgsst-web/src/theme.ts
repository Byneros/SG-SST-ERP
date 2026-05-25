import { createTheme } from '@mui/material'

export const theme = createTheme({
  palette: {
    primary: { main: '#1d4f5f', dark: '#143944' },
    secondary: { main: '#6f7d3c' },
    background: { default: '#f4f7f8', paper: '#ffffff' },
    text: { primary: '#1d2939', secondary: '#667085' },
    success: { main: '#1f7a4d' },
    warning: { main: '#b76e00' },
    error: { main: '#b42318' },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    button: { textTransform: 'none', fontWeight: 700 },
    h5: { fontWeight: 800, letterSpacing: 0 },
    h6: { fontWeight: 760, letterSpacing: 0 },
  },
  components: {
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiButton: { defaultProps: { disableElevation: true } },
  },
})
