import { NavLink } from 'react-router-dom';
import { Package, FileUp, Wallet } from 'lucide-react';
import { useAgentPortal } from '@/hooks/useAgentPortal';

const AGENT_TABS = [
    { name: 'Orders', path: '/Agent/Orders', icon: Package },
    { name: 'Upload AWB', path: '/Agent/Upload', icon: FileUp },
    { name: 'Commissions', path: '/Agent/Commissions', icon: Wallet },
    { name: 'TikTok Shop', path: '/Agent/TikTok-Shop', imgSrc: '/Logo/TikTok-Mono.svg' },
];

export function AgentTabs() {
    const { currentBalance } = useAgentPortal();

    return (
        <div className="flex justify-between items-center bg-gray-100 p-1 rounded-lg w-full mb-6 overflow-x-auto">
            <div className="flex gap-1">
                {AGENT_TABS.map(tab => (
                <NavLink
                    key={tab.path}
                    to={tab.path}
                    className={({ isActive }) =>
                        `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            (isActive || window.location.pathname.startsWith(tab.path))
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                        }`
                    }
                >
                    {({ isActive }) => (
                        <>
                            {tab.icon ? (
                                <tab.icon className="w-4 h-4" />
                            ) : (
                                <img src={tab.imgSrc} alt={tab.name} className={`w-4 h-4 ${!isActive ? 'opacity-70' : ''}`} />
                            )}
                            {tab.name}
                        </>
                    )}
                    </NavLink>
                ))}
            </div>
            
            <div className="hidden sm:flex items-center px-4 py-1.5 rounded-md bg-white shadow-sm border border-gray-200 text-gray-900 font-medium text-sm mr-1 shrink-0">
                <span className="text-gray-500 mr-2">Available Balance:</span>
                <span className={`font-bold ${currentBalance > 0 ? 'text-green-600' : 'text-gray-400'}`}>RM {currentBalance.toFixed(2)}</span>
            </div>
        </div>
    );
}
