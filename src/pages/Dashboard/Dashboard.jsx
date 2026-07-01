import { useState } from 'react';
import { TrendingUp, Users, Package, AlertCircle, ShoppingCart, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useDashboardMetrics } from '@/hooks/useDashboard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function Dashboard() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [timeframe, setTimeframe] = useState('this_month');

    const { data: metrics, isLoading } = useDashboardMetrics(timeframe);

    const stats = [
        { title: t('dashboard.totalSales'), value: isLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : `RM ${Number(metrics?.totalSales || 0).toLocaleString('ms-MY', {minimumFractionDigits: 2})}`, trend: '', icon: TrendingUp, color: 'from-emerald-400 to-emerald-600' },
        { title: t('dashboard.totalOrders'), value: isLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : metrics?.totalOrders || 0, trend: '', icon: ShoppingCart, color: 'from-blue-400 to-blue-600' },
        { title: t('dashboard.lowStockItems'), value: isLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : metrics?.lowStockItems || 0, trend: '', icon: AlertCircle, color: 'from-amber-400 to-amber-600' },
        { title: t('dashboard.activeAgents'), value: isLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : metrics?.activeAgents || 0, trend: '', icon: Users, color: 'from-violet-400 to-violet-600' },
    ];

    const quickActions = [
        { title: t('dashboard.startPOS'), icon: ShoppingCart, action: () => navigate('/POS') },
        { title: 'Manage Inventory', icon: Package, action: () => navigate('/Inventory') },
        { title: t('dashboard.agentList'), icon: Users, action: () => navigate('/Agent-Management') },
    ];

    const recentOrders = metrics?.recentOrders || [];

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('dashboard.overview')}</h1>
                </div>
                <div className="flex items-center space-x-2 bg-white rounded-xl shadow-sm border border-gray-100 p-1">
                    <Select value={timeframe} onValueChange={setTimeframe}>
                        <SelectTrigger className="w-[160px] border-0 shadow-none focus:ring-0 bg-transparent font-medium text-gray-700">
                            <SelectValue placeholder="Select timeframe" />
                        </SelectTrigger>
                        <SelectContent align="end">
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="this_week">This Week</SelectItem>
                            <SelectItem value="this_month">This Month</SelectItem>
                            <SelectItem value="all_time">All Time</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, index) => (
                    <div key={index} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-shadow">
                        <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${stat.color} rounded-bl-full opacity-10 group-hover:opacity-20 transition-opacity -mr-4 -mt-4 z-0`}></div>
                        <div className="relative z-10 flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                                <h3 className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</h3>
                            </div>
                            <div className={`p-2 rounded-xl bg-gradient-to-br ${stat.color} text-white shadow-sm`}>
                                <stat.icon className="w-5 h-5" />
                            </div>
                        </div>
                        <p className="text-sm text-gray-600 mt-4 font-medium">{stat.trend}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Orders Table */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-gray-900">{t('dashboard.recentOrders')}</h2>
                        <Button variant="ghost" size="sm" onClick={() => navigate('/pick-queue')} className="text-indigo-600 hover:text-indigo-700">
                            {t('dashboard.viewAll')} <ArrowRight className="ml-2 w-4 h-4" />
                        </Button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50/50 text-gray-500 font-medium">
                                <tr>
                                    <th className="px-6 py-4">{t('dashboard.orderId')}</th>
                                    <th className="px-6 py-4">{t('dashboard.agent')}</th>
                                    <th className="px-6 py-4 text-center">Items</th>
                                    <th className="px-6 py-4 text-right">{t('dashboard.amount')}</th>
                                    <th className="px-6 py-4 text-center">{t('dashboard.status')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {recentOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                            No recent orders found.
                                        </td>
                                    </tr>
                                ) : (
                                    recentOrders.map((order, i) => (
                                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900">{order.id}</td>
                                            <td className="px-6 py-4 text-gray-600">{order.customer}</td>
                                            <td className="px-6 py-4 text-center text-gray-600">{order.items}</td>
                                            <td className="px-6 py-4 text-right font-medium text-gray-900">{order.total}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold
                                                    ${order.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 
                                                    order.status === 'Packing' ? 'bg-blue-100 text-blue-700' : 
                                                    'bg-amber-100 text-amber-700'}`}>
                                                    {order.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">{t('dashboard.quickActions')}</h2>
                    <div className="space-y-3">
                        {quickActions.map((action, i) => (
                            <div 
                                key={i}
                                onClick={action.action}
                                className="group p-4 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 cursor-pointer transition-all flex items-center"
                            >
                                <div className="p-2.5 rounded-lg bg-gray-50 group-hover:bg-indigo-100 group-hover:text-indigo-600 text-gray-500 transition-colors mr-4">
                                    <action.icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">{action.title}</h4>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
