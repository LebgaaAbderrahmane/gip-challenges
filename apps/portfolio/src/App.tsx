import { Route, Routes } from 'react-router-dom';

import SiteShell from '@/layouts/SiteShell';
import { SessionProvider } from '@/features/session/SessionContext';
import LandingPage from '@/pages/LandingPage';
import TasksOverviewPage from '@/pages/TasksOverviewPage';
import TaskPage from '@/pages/TaskPage';
import EvaluationMapPage from '@/pages/EvaluationMapPage';
import AboutPage from '@/pages/AboutPage';
import NotFoundPage from '@/pages/NotFoundPage';

export default function App() {
  /*
   * The portfolio's session.
   *
   * One token, held in memory, shared by every API on the site. The three
   * services share a signing secret, so a token issued by one is accepted by
   * the others — and the portfolio behaves the same way.
   */
  return (
    <SessionProvider>
      <SiteShell>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/tasks" element={<TasksOverviewPage />} />
          {/* Task detail routes are generated from the task table in
              data/tasks.ts, so a new task cannot exist without a working
              route. */}
          <Route path="/tasks/:slug" element={<TaskPage />} />
          <Route path="/evaluate" element={<EvaluationMapPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </SiteShell>
    </SessionProvider>
  );
}
