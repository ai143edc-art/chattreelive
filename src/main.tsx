import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { LangProvider } from './lib/i18n.tsx'
import { DialogHost } from './lib/dialog.tsx'
import { initAnalytics } from './lib/analytics.ts'
import { watchForNewBuild } from './lib/appUpdate.ts'
// Vercel Web Analytics — cookieless, no consent banner; only reports data once
// Web Analytics is enabled for the project in the Vercel dashboard. Same-origin
// (/_vercel/insights/*), so the existing CSP already allows it.
import { Analytics } from '@vercel/analytics/react'

watchForNewBuild()
initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <LangProvider>
        <App />
        <DialogHost />
      </LangProvider>
    </ErrorBoundary>
    <Analytics />
  </StrictMode>,
)
