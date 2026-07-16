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
import { ProductMatcher } from './pages/Orders/ProductMatcher';
import { AllOrders } from './pages/Orders/AllOrders';
import { useIdleTimeout } from './hooks/useIdleTimeout';
import { usePreferences } from './hooks/usePreferences';
import { GlobalAwbPrintModal } from './components/common/GlobalAwbPrintModal';

import { AgentOrderCreate } from './pages/AgentPortal/AgentOrderCreate';
import { AgentMyOrders } from './pages/AgentPortal/AgentMyOrders';
import { AgentList } from './pages/Agents/AgentList';
import { AgentDetails } from './pages/Agents/AgentDetails';
import { AgentStatement } from './pages/Agents/AgentStatement';
import { AgentRecords } from './pages/Agents/AgentRecords';
import { Settings } from './pages/Settings/Settings';
import { UserManagement } from './pages/Settings/UserManagement';
import { AccountSettings } from './pages/Settings/AccountSettings';
import { InventoryDashboard } from './pages/Inventory/InventoryDashboard';
import { StockIn } from './pages/Inventory/StockIn';
import { PriceSetup } from './pages/Products/PriceSetup';

import { Dashboard } from './pages/Dashboard/Dashboard';
export default function App() {
    const { user, isAuthenticated, isLoading, lockApp } = useAuthStore();
    const isAgent = user?.role === 'Agent';
    const { pinTimeout } = usePreferences();

    // Auto-lock the POS when idle based on pinTimeout
    useIdleTimeout(() => {
        if (isAuthenticated && user?.hasPin) {
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
            <GlobalAwbPrintModal />
            <Routes>
                {/* Public Routes */}
                <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to={isAgent ? "/Agent/Upload" : "/Dashboard"} replace />} />
                <Route path="/HGH/Register" element={<Registration />} />
                <Route path="/HGH/Registration" element={<Navigate to="/HGH/Register" replace />} />
                <Route path="/activation" element={<AccountActivation />} />
                <Route path="/pending-approval" element={<PendingApproval />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                
                {/* Protected Routes inside Layout */}
                {isAuthenticated ? (
                    <>
                        <Route element={<PageLayout />}>
                            {isAgent ? (
                                <>
                                    <Route path="/" element={<Navigate to="/Agent/Upload" replace />} />
                                    <Route path="/Agent" element={<Navigate to="/Agent/Upload" replace />} />
                                    <Route path="/Agent/Upload" element={<AgentOrderCreate />} />
                                    <Route path="/Agent/Orders" element={<AgentMyOrders />} />
                                    <Route path="/Settings/Account" element={<AccountSettings />} />
                                    <Route path="/Settings" element={<Navigate to="/Settings/Account" replace />} />
                                    <Route path="*" element={<Navigate to="/Agent/Upload" replace />} />
                                </>
                            ) : (
                                <>
                                    <Route path="/" element={<Navigate to="/Dashboard" replace />} />
                                    <Route path="/Dashboard" element={<Dashboard />} />
                                    <Route path="/POS" element={<POS />} />
                                    <Route path="/Orders" element={<AllOrders />} />
                                    <Route path="/Orders/Product-Matcher" element={<ProductMatcher />} />
                                    <Route path="/inventory/import" element={<ProductBulkImport />} />
                                    <Route path="/barcode" element={<BarcodeGenerator />} />
                                    <Route path="/Price/Setup" element={<PriceSetup />} />
                                    <Route path="/Inventory" element={<InventoryDashboard />} />
                                    <Route path="/inventory/stock-in" element={<StockIn />} />
                                    <Route path="/Agent-Management" element={<AgentList />} />
                                    <Route path="/Agent-Management/:id" element={<AgentDetails />} />
                                    <Route path="/Agent-Management/:id/Statement" element={<AgentStatement />} />
                                    <Route path="/Agent-Management/:id/Records" element={<AgentRecords />} />
                                    <Route path="/Settings/General" element={<Settings />} />
                                    <Route path="/Settings/Users" element={<UserManagement />} />
                                    <Route path="/Settings/Account" element={<AccountSettings />} />
                                    <Route path="/Settings" element={<Navigate to="/Settings/Account" replace />} />
                                    <Route path="*" element={<Navigate to="/Dashboard" replace />} />
                                </>
                            )}
                        </Route>
                    </>
                ) : (
                    <Route path="*" element={<Navigate to="/login" replace />} />
                )}
            </Routes>
        </BrowserRouter>
    );
}
