import { Menu, Bell, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from './SidebarContext';
import { useLocation } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import 'flag-icons/css/flag-icons.min.css';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSecretMode } from '@/hooks/useSecretMode';
import { useAuthStore } from '@/hooks/useAuth';
import { usePreferences } from '@/hooks/usePreferences';

export function Header() {
    const { toggleSidebar } = useSidebar();
    const location = useLocation();
    const { t, language, setLanguage } = useTranslation();
    const { isHGHMode, toggleHGHMode } = useSecretMode();
    const { user, lockApp } = useAuthStore();
    const { pinTimeout } = usePreferences();

    // Generate dynamic title based on path
    const getPageTitle = () => {
        const path = location.pathname;
        if (path.includes('/dashboard')) return t('header.dashboard');
        if (path.toLowerCase().includes('/pos')) return 'POS';
        if (path.includes('/pick-queue')) return t('header.pickPack');
        if (path.includes('/pack-order')) return t('header.packOrder');
        if (path.includes('/orders/upload')) return t('header.orderUpload');
        if (path.includes('/products/barcodes')) return t('header.barcodes');
        if (path.includes('/products')) return t('header.products');
        if (path.toLowerCase().includes('/inventory')) return t('header.inventory');
        if (path.includes('/Agent-Management')) return t('header.agents');
        if (path.toLowerCase().includes('/price')) return t('header.pricing');
        if (path.toLowerCase().includes('/settings')) return t('header.settings');
        if (path.toLowerCase().includes('/agent')) return 'Agent Workspace';
        return t('header.workspace');
    };

    return (
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-gray-200/50 flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
            <div className="flex items-center">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="md:hidden mr-2 -ml-2"
                    onClick={toggleSidebar}
                >
                    <Menu className="h-5 w-5 text-gray-700" />
                </Button>
                <h1 className="text-lg md:text-xl font-bold text-gray-900 tracking-tight">
                    {getPageTitle()}
                </h1>
            </div>
            
            <div className="flex items-center space-x-2 md:space-x-4">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="px-2 w-9 h-9 hover:bg-gray-100/80 transition-colors focus-visible:ring-0">
                            <span className={`fi fi-${language === 'en' ? 'gb' : 'my'} text-lg rounded-sm overflow-hidden`}></span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 p-1.5 rounded-xl border border-gray-100 shadow-sm">
                        <DropdownMenuItem 
                            onClick={() => setLanguage('en')} 
                            className={`flex items-center gap-3 cursor-pointer py-2.5 px-3 rounded-lg transition-colors outline-none ${language === 'en' ? 'bg-indigo-50/80 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50 focus:bg-gray-50'}`}
                        >
                            <span className="fi fi-gb text-lg rounded-sm overflow-hidden shadow-sm shrink-0"></span> 
                            <span>English</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                            onClick={() => setLanguage('my')} 
                            className={`flex items-center gap-3 cursor-pointer py-2.5 px-3 rounded-lg transition-colors outline-none ${language === 'my' ? 'bg-indigo-50/80 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50 focus:bg-gray-50'}`}
                        >
                            <span className="fi fi-my text-lg rounded-sm overflow-hidden shadow-sm shrink-0"></span> 
                            <span>Bahasa Melayu</span>
                        </DropdownMenuItem>
                        

                        <DropdownMenuSeparator className="my-1" />
                        
                        <DropdownMenuItem 
                            onClick={() => toggleHGHMode()} 
                            className="flex items-center justify-between cursor-pointer py-2.5 px-3 rounded-lg transition-colors outline-none text-gray-600 hover:bg-gray-50 focus:bg-gray-50"
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-lg rounded-sm overflow-hidden shadow-sm shrink-0 bg-gradient-to-br from-indigo-500 to-violet-600" style={{ width: '1.333333em', height: '1em', display: 'inline-block' }}></span>
                                <span>HGH</span>
                            </div>
                            {isHGHMode && (
                                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                            )}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {user?.hasPin && pinTimeout > 0 && (
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="relative hover:bg-gray-100/80 transition-colors"
                        title="Lock Screen"
                        onClick={lockApp}
                    >
                        <Lock className="h-5 w-5 text-gray-600" />
                    </Button>
                )}

                <Button variant="ghost" size="icon" className="relative cursor-not-allowed opacity-40 hover:bg-transparent">
                    <Bell className="h-5 w-5 text-zinc-400" />
                </Button>
            </div>
        </header>
    );
}
