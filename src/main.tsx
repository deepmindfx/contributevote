
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './styles/theme.css' // Import theme styles with Tailwind directives
import './index.css' // Import custom styles with additional Tailwind directives
import { AppProvider } from './contexts/AppContext'
import { Toaster } from './components/ui/toaster.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
        <Toaster />
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
