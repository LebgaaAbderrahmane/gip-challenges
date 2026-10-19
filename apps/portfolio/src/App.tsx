import { Routes, Route } from 'react-router-dom';

import SiteShell from '@/layouts/SiteShell';
import LandingPage from '@/pages/LandingPage';
import TasksOverviewPage from '@/pages/TasksOverviewPage';
import TaskPage from '@/pages/TaskPage';
import AboutPage from '@/pages/AboutPage';
import NotFoundPage from '@/pages/NotFoundPage';

export default function App() {
  return (
    <SiteShell>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/tasks" element={<TasksOverviewPage />} />
        {/* Task detail routes are generated from the task table in data/tasks.ts,
            so a new task cannot exist without a working route. */}
        <Route path="/tasks/:slug" element={<TaskPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </SiteShell>
  );
}