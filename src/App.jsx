import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PageLayout } from './components/layout/PageLayout';
import { useAuthStore } from './hooks/useAuth';

import { ProductBulkImport } from './pages/Products/ProductBulkImport';
import { BarcodeGenerator } from './pages/Products/Barcode';
import { Login } from './pages/Auth/Login';
import { Registration } from './pages/Auth/Registration';
import { POS } from './pages/POS/POS';
import { PickPack } from './pages/Orders/PickPack';
import { PackOrder } from './pages/Orders/PackOrder';

import { AgentOrderCreate } from './pages/AgentPortal/AgentOrderCreate';
import { AgentMyOrders } from './pages/AgentPortal/AgentMyOrders';
import { AgentMyLedger } from './pages/AgentPortal/AgentMyLedger';
import { AgentList } from './pages/Agents/AgentList';
import { AgentDetails } from './pages/Agents/AgentDetails';
import { Settings } from './pages/Settings/Settings';
import { UserManagement } from './pages/Settings/UserManagement';
import { InventoryDashboard } from './pages/Inventory/InventoryDashboard';
import { StockIn } from './pages/Inventory/StockIn';

import { Dashboard } from './pages/Dashboard/Dashboard';

export default function App() {
    const { isAuthenticated, isLoading } = useAuthStore();

    useEffect(() => {
        useAuthStore.getState().initialize();
    }, []);

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    }

    return (
        <BrowserRouter>
            <Routes>
                {/* Public Routes */}
                <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />} />
                <Route path="/HGH/Registration" element={<Registration />} />
                
                {/* Protected Routes inside Layout */}
                {isAuthenticated ? (
                    <>
                        <Route element={<PageLayout />}>
                            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/pos" element={<POS />} />
                            <Route path="/pick-pack" element={<PickPack />} />
                            <Route path="/pack-order/:orderId" element={<PackOrder />} />
                            <Route path="/inventory/import" element={<ProductBulkImport />} />
                            <Route path="/barcode" element={<BarcodeGenerator />} />
                            <Route path="/inventory" element={<InventoryDashboard />} />
                            <Route path="/inventory/stock-in" element={<StockIn />} />
                            <Route path="/agents" element={<AgentList />} />
                            <Route path="/agents/:id" element={<AgentDetails />} />
                            <Route path="/settings/general" element={<Settings />} />
                            <Route path="/settings/users" element={<UserManagement />} />
                            <Route path="/settings" element={<Navigate to="/settings/general" replace />} />
                            <Route path="/agent" element={<Navigate to="/agent/orders/new" replace />} />
                            <Route path="/agent/orders/new" element={<AgentOrderCreate />} />
                            <Route path="/agent/orders" element={<AgentMyOrders />} />
                            <Route path="/agent/ledger" element={<AgentMyLedger />} />
                        </Route>
                    </>
                ) : (
                    <Route path="*" element={<Navigate to="/login" replace />} />
                )}
            </Routes>
        </BrowserRouter>
    );
}
