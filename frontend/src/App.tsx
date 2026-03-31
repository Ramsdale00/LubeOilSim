import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/modules/dashboard/DashboardPage'
import { BlendPage } from '@/modules/blend/BlendPage'
import { TanksPage } from '@/modules/tanks/TanksPage'
import { RecipePage } from '@/modules/recipe/RecipePage'
import { QualityPage } from '@/modules/quality/QualityPage'
import { SupplyPage } from '@/modules/supply/SupplyPage'
import { AIPage } from '@/modules/ai/AIPage'
import { DocumentAssistantPage } from '@/modules/docs/DocumentAssistantPage'
import LoginPage from '@/components/auth/LoginPage'

interface AuthUser {
  email: string
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null)

  if (!user) {
    return <LoginPage onLogin={setUser} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/blend" element={<BlendPage />} />
          <Route path="/tanks" element={<TanksPage />} />
          <Route path="/recipe" element={<RecipePage />} />
          <Route path="/quality" element={<QualityPage />} />
          <Route path="/supply" element={<SupplyPage />} />
          <Route path="/ai" element={<AIPage />} />
          <Route path="/docs" element={<DocumentAssistantPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
