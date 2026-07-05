import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { SidebarProvider } from './SidebarContext';

export function PageLayout() {
    const location = useLocation();
    const isPOS = location.pathname.toLowerCase().includes('/pos');

    return (
        <SidebarProvider>
            <div className="fixed inset-0 flex bg-background overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
                    <Header />
                    <main className={`flex-1 ${isPOS ? 'p-0 overflow-hidden flex flex-col' : 'overflow-y-auto p-4 md:p-6'}`}>
                        <Outlet />
                    </main>
                </div>
            </div>
        </SidebarProvider>
    );
}
