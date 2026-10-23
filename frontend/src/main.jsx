import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary';
import { TooltipProvider } from './components/ui/Tooltip';
import '@fontsource-variable/inter';
import '@fontsource-variable/plus-jakarta-sans';
import './i18n';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);