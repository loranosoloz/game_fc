import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'

const GameRoutes = lazy(() => import('@/GameRoutes'))
const BrowsePage = lazy(() =>
  import('@/pages/PlayerDatabasePage').then((m) => ({ default: m.PlayerDatabasePage })),
)
const MatchDemoPage = lazy(() =>
  import('@/pages/MatchDemoPage').then((m) => ({ default: m.MatchDemoPage })),
)
const MatchDemo3DPage = lazy(() =>
  import('@/pages/MatchDemo3DPage').then((m) => ({ default: m.MatchDemo3DPage })),
)

function PageFallback() {
  return (
    <div className="flex min-h-full w-full items-center justify-center text-sm text-slate-500">
      กำลังโหลด…
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/browse"
        element={
          <Suspense fallback={<PageFallback />}>
            <BrowsePage />
          </Suspense>
        }
      />
      <Route
        path="/match-demo"
        element={
          <Suspense fallback={<PageFallback />}>
            <MatchDemoPage />
          </Suspense>
        }
      />
      <Route
        path="/match-demo-3d"
        element={
          <Suspense fallback={<PageFallback />}>
            <MatchDemo3DPage />
          </Suspense>
        }
      />
      <Route
        path="/*"
        element={
          <Suspense fallback={<PageFallback />}>
            <GameRoutes />
          </Suspense>
        }
      />
    </Routes>
  )
}
