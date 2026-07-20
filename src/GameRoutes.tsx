import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'

const AppShell = lazy(() =>
  import('@/components/AppShell').then((m) => ({ default: m.AppShell })),
)
const PortalPage = lazy(() =>
  import('@/pages/PortalPage').then((m) => ({ default: m.PortalPage })),
)
const SquadPage = lazy(() =>
  import('@/pages/SquadPage').then((m) => ({ default: m.SquadPage })),
)
const TacticsPage = lazy(() =>
  import('@/pages/TacticsPage').then((m) => ({ default: m.TacticsPage })),
)
const TrainingPage = lazy(() =>
  import('@/pages/TrainingPage').then((m) => ({ default: m.TrainingPage })),
)
const MedicalPage = lazy(() =>
  import('@/pages/MedicalPage').then((m) => ({ default: m.MedicalPage })),
)
const YouthPage = lazy(() =>
  import('@/pages/YouthPage').then((m) => ({ default: m.YouthPage })),
)
const StaffPage = lazy(() =>
  import('@/pages/StaffPage').then((m) => ({ default: m.StaffPage })),
)
const DataHubPage = lazy(() =>
  import('@/pages/DataHubPage').then((m) => ({ default: m.DataHubPage })),
)
const DevelopmentPage = lazy(() =>
  import('@/pages/DevelopmentPage').then((m) => ({ default: m.DevelopmentPage })),
)
const CompetitionsPage = lazy(() =>
  import('@/pages/CompetitionsPage').then((m) => ({ default: m.CompetitionsPage })),
)
const MatchPage = lazy(() =>
  import('@/pages/MatchPage').then((m) => ({ default: m.MatchPage })),
)
const LiveMatchPage = lazy(() =>
  import('@/pages/LiveMatchPage').then((m) => ({ default: m.LiveMatchPage })),
)
const TablePage = lazy(() =>
  import('@/pages/TablePage').then((m) => ({ default: m.TablePage })),
)
const ScoutingPage = lazy(() =>
  import('@/pages/ScoutingPage').then((m) => ({ default: m.ScoutingPage })),
)
const TransfersPage = lazy(() =>
  import('@/pages/TransfersPage').then((m) => ({ default: m.TransfersPage })),
)
const FinancePage = lazy(() =>
  import('@/pages/FinancePage').then((m) => ({ default: m.FinancePage })),
)
const MediaPage = lazy(() =>
  import('@/pages/MediaPage').then((m) => ({ default: m.MediaPage })),
)
const AwardsPage = lazy(() =>
  import('@/pages/AwardsPage').then((m) => ({ default: m.AwardsPage })),
)
const HistoryPage = lazy(() =>
  import('@/pages/HistoryPage').then((m) => ({ default: m.HistoryPage })),
)
const MeetingsPage = lazy(() =>
  import('@/pages/MeetingsPage').then((m) => ({ default: m.MeetingsPage })),
)
const ClubVisionPage = lazy(() =>
  import('@/pages/ClubVisionPage').then((m) => ({ default: m.ClubVisionPage })),
)
const SavePage = lazy(() =>
  import('@/pages/SavePage').then((m) => ({ default: m.SavePage })),
)
const PreSeasonPage = lazy(() =>
  import('@/pages/PreSeasonPage').then((m) => ({ default: m.PreSeasonPage })),
)
const CalendarPage = lazy(() =>
  import('@/pages/CalendarPage').then((m) => ({ default: m.CalendarPage })),
)

function RequireSave({ children }: { children: ReactNode }) {
  const save = useGameStore((s) => s.save)
  if (!save) return <Navigate to="/" replace />
  return children
}

function PageFallback() {
  return (
    <div className="flex min-h-[40vh] w-full items-center justify-center text-sm text-slate-500">
      กำลังโหลด…
    </div>
  )
}

/** โหลดหลังกดเริ่ม/โหลดเกม — ไม่ปนกับหน้า Home */
export default function GameRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
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
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/preseason" element={<PreSeasonPage />} />
          <Route path="/media" element={<MediaPage />} />
          <Route path="/awards" element={<AwardsPage />} />
          <Route path="/history" element={<HistoryPage />} />
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
    </Suspense>
  )
}
