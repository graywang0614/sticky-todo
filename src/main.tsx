import { StrictMode, Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'

class ErrBoundary extends Component<{ children: ReactNode }, { msg: string }> {
  state = { msg: '' }
  static getDerivedStateFromError(e: any) { return { msg: String(e?.message || e) } }
  componentDidCatch(e: any) { document.title = 'RENDER-ERR:' + String(e?.message || e).slice(0, 120) }
  render() {
    if (this.state.msg) return <pre style={{ color: 'red', padding: 20 }}>渲染错误: {this.state.msg}</pre>
    return this.props.children
  }
}

document.title = 'boot:imports-ok'
window.addEventListener('unhandledrejection', (e) => {
  document.title = 'REJ:' + String((e.reason as any)?.message || e.reason).slice(0, 120)
})
try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrBoundary>
    </StrictMode>,
  )
  setTimeout(() => {
    document.title = 'boot:rendered len=' + (document.getElementById('root')?.innerHTML.length ?? -1)
  }, 1000)
} catch (e) {
  document.body.innerHTML = '<pre style="color:red;padding:20px">启动失败: ' + String(e) + '</pre>'
}
