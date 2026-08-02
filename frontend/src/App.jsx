import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
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

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="subjects" element={<SubjectsPage />} />
            <Route path="subjects/:id" element={<SubjectDashboardPage />} />
            <Route path="materi" element={<MateriPage />} />
            <Route path="notebook" element={<NotebookPage />} />
            <Route path="flashcard" element={<FlashcardPage />} />
            <Route path="flashcard/review" element={<FlashcardReviewPage />} />
            <Route path="quiz" element={<QuizPage />} />
            <Route path="exam-analyzer" element={<ExamAnalyzerPage />} />
            <Route path="study-plan" element={<StudyPlanPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
