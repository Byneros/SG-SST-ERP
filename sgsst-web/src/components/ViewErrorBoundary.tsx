import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

/**
 * Aisla fallos de render de las vistas perezosas: sin esto, un error en una
 * vista desmonta todo el arbol de la app en silencio (en produccion).
 */
export class ViewErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('ViewErrorBoundary:', error.message, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" style={{ padding: 16 }}>
          <h3>Error al mostrar esta vista</h3>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#b91c1c' }}>{this.state.error.message}</pre>
        </div>
      )
    }
    return this.props.children
  }
}
