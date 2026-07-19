import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { HomePage } from '@/pages/HomePage'
import { PortalPage } from '@/pages/PortalPage'
import { SquadPage } from '@/pages/SquadPage'
import { TacticsPage } from '@/pages/TacticsPage'
import { TrainingPage } from '@/pages/TrainingPage'
import { MedicalPage } from '@/pages/MedicalPage'
import { YouthPage } from '@/pages/YouthPage'
import { StaffPage } from '@/pages/StaffPage'
import { DataHubPage } from '@/pages/DataHubPage'
import { DevelopmentPage } from '@/pages/DevelopmentPage'
import { CompetitionsPage } from '@/pages/CompetitionsPage'
import { MatchPage } from '@/pages/MatchPage'
import { LiveMatchPage } from '@/pages/LiveMatchPage'
import { TablePage } from '@/pages/TablePage'
import { ScoutingPage } from '@/pages/ScoutingPage'
import { TransfersPage } from '@/pages/TransfersPage'
import { FinancePage } from '@/pages/FinancePage'
import { MediaPage } from '@/pages/MediaPage'
import { MeetingsPage } from '@/pages/MeetingsPage'
import { ClubVisionPage } from '@/pages/ClubVisionPage'
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
        <Route path="/media" element={<MediaPage />} />
        <Route path="/squad" element={<SquadPage />} />
        <Route path="/meetings" element={<MeetingsPage />} />
        <Route path="/club-vision" element={<ClubVisionPage />} />
        <Route path="/tactics" element={<TacticsPage />} />
        <Route path="/training" element={<TrainingPage />} />
        <Route path="/medical" element={<MedicalPage />} />
        <Route path="/youth" element={<YouthPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/data" element={<DataHubPage />} />
        <Route path="/development" element={<DevelopmentPage />} />
        <Route path="/competitions" element={<CompetitionsPage />} />
        <Route path="/match" element={<MatchPage />} />
        <Route path="/table" element={<TablePage />} />
        <Route path="/transfers" element={<TransfersPage />} />
        <Route path="/scouting" element={<ScoutingPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/save" element={<SavePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
