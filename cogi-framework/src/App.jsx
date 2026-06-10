import { BrowserRouter } from 'react-router-dom'
import AuthContextProvider from './contexts/AuthContext'
import TenantContextProvider from './contexts/TenantContext'
import FeatureProvider from './contexts/FeatureContext'
import AppRouter from './router/AppRouter'

export default function App() {
  return (
    <div className='notranslate' translate='no'>
      <AuthContextProvider>
        <TenantContextProvider>
          <FeatureProvider>
            <BrowserRouter>
              <AppRouter />
            </BrowserRouter>
          </FeatureProvider>
        </TenantContextProvider>
      </AuthContextProvider>
    </div>
  )
}
