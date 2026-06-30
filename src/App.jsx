import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PageLayout } from './components/layout/PageLayout';
import { useAuthStore } from './hooks/useAuth';

import { ProductBulkImport } from './pages/Products/ProductBulkImport';
import { BarcodeGenerator } from './pages/Products/Barcode';
import { Login } from './pages/Auth/Login';
import { Registration } from './pages/Auth/Registration';
import { AccountActivation } from './pages/Auth/AccountActivation';
import { PendingApproval } from './pages/Auth/PendingApproval';
import ResetPassword from './pages/Auth/ResetPassword';
import { PINUnlock } from './pages/Auth/PINUnlock';
import { POS } from './pages/POS/POS';
import { PickPack } from './pages/Orders/PickPack';
import { PackOrder } from './pages/Orders/PackOrder';
import { useIdleTimeout } from './hooks/useIdleTimeout';
import { usePreferences } from './hooks/usePreferences';

import { AgentOrderCreate } from './pages/AgentPortal/AgentOrderCreate';
import { AgentMyOrders } from './pages/AgentPortal/AgentMyOrders';
import { AgentMyLedger } from './pages/AgentPortal/AgentMyLedger';
import { AgentList } from './pages/Agents/AgentList';
import { AgentDetails } from './pages/Agents/AgentDetails';
import { AgentStatement } from './pages/Agents/AgentStatement';
import { Settings } from './pages/Settings/Settings';
import { UserManagement } from './pages/Settings/UserManagement';
import { AccountSettings } from './pages/Settings/AccountSettings';
import { InventoryDashboard } from './pages/Inventory/InventoryDashboard';
import { StockIn } from './pages/Inventory/StockIn';
import { PriceSetup } from './pages/Products/PriceSetup';

import { Dashboard } from './pages/Dashboard/Dashboard';
import { ReportDashboard } from './pages/Reports/ReportDashboard';
export default function App() {
    const { isAuthenticated, isLoading, lockApp } = useAuthStore();
    const { pinTimeout } = usePreferences();

    // Auto-lock the POS when idle based on pinTimeout
    useIdleTimeout(() => {
        if (isAuthenticated) {
            lockApp();
        }
    }, pinTimeout);

    useEffect(() => {
        useAuthStore.getState().initialize();
    }, []);

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    }

    return (
        <BrowserRouter>
            <PINUnlock />
            <Routes>
                {/* Public Routes */}
                <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/Dashboard" />} />
                <Route path="/HGH/Registration" element={<Registration />} />
                <Route path="/activation" element={<AccountActivation />} />
                <Route path="/pending-approval" element={<PendingApproval />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                
                {/* Protected Routes inside Layout */}
                {isAuthenticated ? (
                    <>
                        <Route element={<PageLayout />}>
                            <Route path="/" element={<Navigate to="/Dashboard" replace />} />
                            <Route path="/Dashboard" element={<Dashboard />} />
                            <Route path="/POS" element={<POS />} />
                            <Route path="/pick-pack" element={<PickPack />} />
                            <Route path="/pack-order/:orderId" element={<PackOrder />} />
                            <Route path="/inventory/import" element={<ProductBulkImport />} />
                            <Route path="/barcode" element={<BarcodeGenerator />} />
                            <Route path="/Price/Setup" element={<PriceSetup />} />
                            <Route path="/Inventory" element={<InventoryDashboard />} />
                            <Route path="/inventory/stock-in" element={<StockIn />} />
                            <Route path="/reports" element={<ReportDashboard />} />
                            <Route path="/agents" element={<AgentList />} />
                            <Route path="/agents/:id" element={<AgentDetails />} />
                            <Route path="/agents/:id/statement" element={<AgentStatement />} />
                            <Route path="/Settings/General" element={<Settings />} />
                            <Route path="/Settings/Users" element={<UserManagement />} />
                            <Route path="/Settings/Account" element={<AccountSettings />} />
                            <Route path="/Settings" element={<Navigate to="/Settings/Account" replace />} />
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
