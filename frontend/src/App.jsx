import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import AppLayout from './layouts/AppLayout';
import DashboardPage from './pages/DashboardPage';
import ChatPage from './pages/ChatPage';
import MateriPage from './pages/MateriPage';
import SubjectsPage from './pages/SubjectsPage';
import SubjectDashboardPage from './pages/SubjectDashboardPage';
import NotebookPage from './pages/NotebookPage';
import FlashcardPage from './pages/FlashcardPage';
import FlashcardReviewPage from './pages/FlashcardReviewPage';
import QuizPage from './pages/QuizPage';
import ExamAnalyzerPage from './pages/ExamAnalyzerPage';
import StudyPlanPage from './pages/StudyPlanPage';

// Placeholders for other pages
const SettingsPage = () => <div className="p-10 text-text">Settings Page (WIP)</div>;

// Isolasi error per-halaman: satu halaman crash tidak mematikan seluruh UI (B6)
const PageBoundary = ({ children }) => <ErrorBoundary>{children}</ErrorBoundary>;

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
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
      </ToastProvider>
    </BrowserRouter>
  );
}
