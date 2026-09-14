import { Menu, Lock } from 'lucide-react';
import { Button } from '@/Components/UI/Button';
import { useSidebar } from './SidebarContext';
import { useLocation } from 'react-router-dom';
import { useTranslation } from '@/Hooks/UseTranslation';
import 'flag-icons/css/flag-icons.min.css';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/Components/UI/DropdownMenu";
import { useSecretMode } from '@/Hooks/UseSecretMode';
import { useAuthStore } from '@/Hooks/UseAuth';
import { Tooltip } from 'radix-ui';

export function Header({ ShowMenu = true } = {}) {
    const { toggleSidebar } = useSidebar();
    const location = useLocation();
    const { t, language, setLanguage } = useTranslation();
    const { isHGHMode, toggleHGHMode } = useSecretMode();
    const { user, lockApp } = useAuthStore();


    // Generate dynamic title based on path
    const getPageTitle = () => {
        const path = location.pathname.toLowerCase();
        if (path.includes('/dashboard')) return t('header.dashboard');
        if (path.toLowerCase().includes('/pos')) return 'POS';
        if (path.includes('/pick-queue')) return t('header.pickPack');
        if (path.includes('/pack-order')) return t('header.packOrder');
        if (path.includes('/orders/upload')) return t('header.orderUpload');
        if (path.includes('/products/barcodes')) return t('header.barcodes');
        if (path.includes('/products')) return t('header.products');
        if (path.toLowerCase().includes('/inventory')) return t('header.inventory');
        if (path.includes('/agent-management')) return t('header.agents');
        if (path.toLowerCase().includes('/price')) return t('header.pricing');
        if (path.toLowerCase().includes('/settings')) return t('header.settings');
        if (path.toLowerCase().includes('/orders/product-matcher')) return 'Product Matcher';
        if (path.toLowerCase().includes('/orders') && !path.includes('/upload')) return 'Orders';
        if (path.toLowerCase().includes('/agent/upload')) return 'Upload AWB';
        if (path.toLowerCase().includes('/agent/orders')) return 'Orders';
        if (path.toLowerCase().includes('/agent')) return 'Agent Workspace';
        return t('header.workspace');
    };

    return (
        <header className="h-16 shrink-0 bg-white/80 backdrop-blur-md border-b border-gray-200/50 flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
            <div className="flex items-center">
                {ShowMenu && <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden mr-2 -ml-2"
                    onClick={toggleSidebar}
                    aria-label="Open menu"
                >
                    <Menu className="h-5 w-5 text-gray-700" />
                </Button>}
                <p className="text-lg md:text-xl font-bold text-gray-900 tracking-tight">
                    {getPageTitle()}
                </p>
            </div>

            <div className="flex items-center space-x-2 md:space-x-4">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="px-2 w-9 h-9 hover:bg-gray-100/80 transition-colors focus-visible:ring-2" aria-label="Language">
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

                {user?.hasPin && (
                    <Tooltip.Provider delayDuration={250}><Tooltip.Root><Tooltip.Trigger asChild><Button
                        variant="ghost"
                        size="icon"
                        className="relative hover:bg-gray-100/80 transition-colors"
                        aria-label="Lock"
                        onClick={lockApp}
                    >
                        <Lock className="h-5 w-5 text-gray-600" />
                    </Button></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content sideOffset={8} className="z-[100] rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white shadow-lg">Lock<Tooltip.Arrow className="fill-gray-900"/></Tooltip.Content></Tooltip.Portal></Tooltip.Root></Tooltip.Provider>
                )}
            </div>
        </header>
    );
}
