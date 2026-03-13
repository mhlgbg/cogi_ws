import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './theme/brand.css'
import './theme/components.css'
import App from './App.jsx'
import '@coreui/coreui/dist/css/coreui.min.css'  // <-- thêm dòng này


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
