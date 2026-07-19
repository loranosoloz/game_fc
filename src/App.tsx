import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { HomePage } from '@/pages/HomePage'
import { PortalPage } from '@/pages/PortalPage'
import { SquadPage } from '@/pages/SquadPage'
import { TacticsPage } from '@/pages/TacticsPage'
import { MatchPage } from '@/pages/MatchPage'
import { LiveMatchPage } from '@/pages/LiveMatchPage'
import { TablePage } from '@/pages/TablePage'
import { TransfersPage } from '@/pages/TransfersPage'
import { FinancePage } from '@/pages/FinancePage'
import { SavePage } from '@/pages/SavePage'
import { useGameStore } from '@/store/gameStore'

function RequireSave({ children }: { children: ReactNode }) {
  const save = useGameStore((s) => s.save)
  if (!save) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/match/live"
        element={
          <RequireSave>
            <LiveMatchPage />
          </RequireSave>
        }
      />
      <Route
        element={
          <RequireSave>
            <AppShell />
          </RequireSave>
        }
      >
        <Route path="/portal" element={<PortalPage />} />
        <Route path="/squad" element={<SquadPage />} />
        <Route path="/tactics" element={<TacticsPage />} />
        <Route path="/match" element={<MatchPage />} />
        <Route path="/table" element={<TablePage />} />
        <Route path="/transfers" element={<TransfersPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/save" element={<SavePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
