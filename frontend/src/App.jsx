import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import AppLayout from './layouts/AppLayout';

// Lazy-load halaman: chunk per-halaman dimuat on-demand (kurangi bundle awal)
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const MateriPage = lazy(() => import('./pages/MateriPage'));
const SubjectsPage = lazy(() => import('./pages/SubjectsPage'));
const SubjectDashboardPage = lazy(() => import('./pages/SubjectDashboardPage'));
const NotebookPage = lazy(() => import('./pages/NotebookPage'));
const FlashcardPage = lazy(() => import('./pages/FlashcardPage'));
const FlashcardReviewPage = lazy(() => import('./pages/FlashcardReviewPage'));
const QuizPage = lazy(() => import('./pages/QuizPage'));
const ExamAnalyzerPage = lazy(() => import('./pages/ExamAnalyzerPage'));
const StudyPlanPage = lazy(() => import('./pages/StudyPlanPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

// Isolasi error per-halaman: satu halaman crash tidak mematikan seluruh UI (B6)
const PageBoundary = ({ children }) => <ErrorBoundary>{children}</ErrorBoundary>;

// Fallback singkat saat chunk halaman sedang dimuat
const PageFallback = () => (
    <div className="flex min-h-[60vh] items-center justify-center text-muted">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<PageBoundary><DashboardPage /></PageBoundary>} />
              <Route path="chat" element={<PageBoundary><ChatPage /></PageBoundary>} />
              <Route path="subjects" element={<PageBoundary><SubjectsPage /></PageBoundary>} />
              <Route path="subjects/:id" element={<PageBoundary><SubjectDashboardPage /></PageBoundary>} />
              <Route path="materi" element={<PageBoundary><MateriPage /></PageBoundary>} />
              <Route path="notebook" element={<PageBoundary><NotebookPage /></PageBoundary>} />
              <Route path="flashcard" element={<PageBoundary><FlashcardPage /></PageBoundary>} />
              <Route path="flashcard/review" element={<PageBoundary><FlashcardReviewPage /></PageBoundary>} />
              <Route path="quiz" element={<PageBoundary><QuizPage /></PageBoundary>} />
              <Route path="exam-analyzer" element={<PageBoundary><ExamAnalyzerPage /></PageBoundary>} />
              <Route path="study-plan" element={<PageBoundary><StudyPlanPage /></PageBoundary>} />
              <Route path="settings" element={<PageBoundary><SettingsPage /></PageBoundary>} />
            </Route>
          </Routes>
        </Suspense>
      </ToastProvider>
    </BrowserRouter>
  );
}