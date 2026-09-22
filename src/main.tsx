import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'

document.title = 'boot:imports-ok'
try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
  setTimeout(() => {
    document.title = 'boot:rendered len=' + (document.getElementById('root')?.innerHTML.length ?? -1)
  }, 1000)
} catch (e) {
  document.body.innerHTML = '<pre style="color:red;padding:20px">启动失败: ' + String(e) + '</pre>'
}
