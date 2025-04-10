
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/theme.css' // Import theme styles with Tailwind directives
import './index.css' // Import custom styles with additional Tailwind directives
import './patches/toast-patch.ts' // Import the toast patch for backward compatibility

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
