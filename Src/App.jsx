import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PageLayout } from './Components/Layout/PageLayout';
import { useAuthStore } from './Hooks/UseAuth';
import { Toaster } from 'sonner';

import { ProductBulkImport } from './Pages/Products/ProductBulkImport';
import { BarcodeGenerator } from './Pages/Products/Barcode';
import { Login } from './Pages/Auth/Login';
import { Registration } from './Pages/Auth/Registration';
import { AccountActivation } from './Pages/Auth/AccountActivation';
import { PendingApproval } from './Pages/Auth/PendingApproval';
import ResetPassword from './Pages/Auth/ResetPassword';
import { PINUnlock } from './Pages/Auth/PINUnlock';
import { POS } from './Pages/POS/POS';
import { ProductMatcher } from './Pages/Orders/ProductMatcher';
import { AllOrders } from './Pages/Orders/AllOrders';
import { useIdleTimeout } from './Hooks/UseIdleTimeout';
import { usePreferences } from './Hooks/UsePreferences';
import { GlobalAwbPrintModal } from './Components/Common/GlobalAWBPrintModal';
import { SyncAwbModal } from './Components/Common/SyncAWBModal';

import { AgentOrderCreate } from './Pages/AgentPortal/AgentOrderCreate';
import { AgentMyOrders } from './Pages/AgentPortal/AgentMyOrders';
import { AgentList } from './Pages/Agents/AgentList';
import { AgentDetails } from './Pages/Agents/AgentDetails';
import { AgentStatement } from './Pages/Agents/AgentStatement';
import { AgentRecords } from './Pages/Agents/AgentRecords';
import { Settings } from './Pages/Settings/Settings';
import { UserManagement } from './Pages/Settings/UserManagement';
import { AccountSettings } from './Pages/Settings/AccountSettings';
import { APIConnection } from './Pages/Settings/APIConnection';
import { InventoryDashboard } from './Pages/Inventory/InventoryDashboard';
import { StockIn } from './Pages/Inventory/StockIn';

import { Dashboard } from './Pages/Dashboard/Dashboard';
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
            <SyncAwbModal />
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
                                    <Route path="/Inventory/Import" element={<ProductBulkImport />} />
                                    <Route path="/Barcode" element={<BarcodeGenerator />} />
                                    <Route path="/Inventory" element={<InventoryDashboard />} caseSensitive />
                                    <Route path="/inventory" element={<Navigate to="/Inventory" replace />} caseSensitive />
                                    <Route path="/Inventory/Stock-In" element={<StockIn />} />
                                    <Route path="/Agent-Management" element={<AgentList />} />
                                    <Route path="/Agent-Management/:id" element={<AgentDetails />} />
                                    <Route path="/Agent-Management/:id/Statement" element={<AgentStatement />} />
                                    <Route path="/Agent-Management/:id/Records" element={<AgentRecords />} />
                                    <Route path="/Settings/General" element={<Settings />} />
                                    <Route path="/Settings/APIConnection" element={<APIConnection />} />
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
            <Toaster position="top-center" richColors duration={2500} />
        </BrowserRouter>
    );
}
