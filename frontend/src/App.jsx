import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import AppLayout from './layouts/AppLayout';
import DashboardPage from './pages/DashboardPage';
import ChatPage from './pages/ChatPage';
import MateriPage from './pages/MateriPage';
import SubjectsPage from './pages/SubjectsPage';
import SubjectDetailPage from './pages/SubjectDetailPage';
import NotebookPage from './pages/NotebookPage';
import FlashcardPage from './pages/FlashcardPage';
import QuizPage from './pages/QuizPage';
import ExamAnalyzerPage from './pages/ExamAnalyzerPage';
import ExamHistoryPage from './pages/ExamHistoryPage';

// Placeholders for other pages
const AnalyticsPage = () => <div className="p-10 text-text">Analytics Page (WIP)</div>;
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
            <Route path="subjects/:id" element={<SubjectDetailPage />} />
            <Route path="materi" element={<MateriPage />} />
            <Route path="notebook" element={<NotebookPage />} />
            <Route path="flashcard" element={<FlashcardPage />} />
            <Route path="quiz" element={<QuizPage />} />
            <Route path="exam-analyzer" element={<ExamAnalyzerPage />} />
            <Route path="exam-history"  element={<ExamHistoryPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
