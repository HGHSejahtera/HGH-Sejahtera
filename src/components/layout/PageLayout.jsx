import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { SidebarProvider } from './SidebarContext';

export function PageLayout() {
    return (
        <SidebarProvider>
            <div className="flex h-screen bg-background overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6">
                        <Outlet />
                    </main>
                </div>
            </div>
        </SidebarProvider>
    );
}
