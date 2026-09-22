import { Routes, Route } from 'react-router'
import Home from './pages/Home'
import DesktopFloat from './pages/DesktopFloat'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/desktop" element={<DesktopFloat />} />
    </Routes>
  )
}
