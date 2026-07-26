import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import CommandSearch from '@/components/search/CommandSearch';
import { useAppStore } from '@/store';

export default function AppLayout() {
  const { searchOpen } = useAppStore();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        <Outlet />
      </main>
      {searchOpen && <CommandSearch />}
    </div>
  );
}
