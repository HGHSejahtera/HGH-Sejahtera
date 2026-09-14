import { useState, useEffect, useCallback } from 'react';

import { UserPlus, Shield, Check, X, Users, KeyRound, Loader2, Trash2, Edit2 } from 'lucide-react';
import { DataTable } from '@/Components/Common/DataTable';
import { Button } from '@/Components/UI/Button';
import { Input } from '@/Components/UI/Input';
import { Label } from '@/Components/UI/Label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/Components/UI/Dialog';
import { supabase } from '@/Lib/Supabase';
import { useTranslation } from '@/Hooks/UseTranslation';
import { useAuthStore } from '@/Hooks/UseAuth';
import { toast } from 'sonner';

import { SettingsPage } from './SettingsPage';

function DeveloperPinDirectory({ pins, isLoading, onResetPin, onClearPin }) {
    if (isLoading) {
        return (
            <div className="bg-white text-gray-900 rounded-2xl p-6 border border-gray-200 flex items-center justify-center min-h-[120px]">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mr-3" />
                <span className="text-sm font-medium text-gray-600">Loading Developer PIN Directory...</span>
            </div>
        );
    }

    return (
        <div className="bg-white text-gray-900 rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-gray-100 bg-gray-50/50 flex flex-wrap gap-3 items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <KeyRound className="w-5 h-5 text-primary" />
                        Developer PIN Directory
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                        Exclusively accessible to Developer role. View exact 4-digit terminal PIN codes or clear forgotten PINs instantly.
                    </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-primary/10 text-primary border border-primary/10">
                    Developer Vault
                </span>
            </div>

            <div className="p-6">
                {pins.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-6">No users found in PIN directory.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pins.map((user) => {
                            const isSet = user.DecodedPIN && user.DecodedPIN !== 'Not Set';
                            return (
                                <div 
                                    key={user.UserID}
                                    className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex flex-col justify-between gap-3"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-900 text-sm">{user.DisplayName}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs font-mono text-gray-500">{user.StaffID || 'No Staff ID'}</span>
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600 uppercase">
                                                    {user.Role}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-slate-700/60 mt-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">PIN:</span>
                                            <span className={`font-mono font-bold text-sm px-2 py-0.5 rounded ${isSet ? 'bg-amber-400/10 text-amber-300 border border-amber-400/30 tracking-widest' : 'bg-gray-100/50 text-slate-500 italic'}`}>
                                                {user.DecodedPIN}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => onResetPin(user)}
                                                className="h-7 px-2.5 text-xs bg-gray-100 hover:bg-slate-600 text-slate-200"
                                                title="Set new PIN"
                                            >
                                                <Edit2 className="w-3 h-3 mr-1" /> Set
                                            </Button>
                                            {isSet && (
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => onClearPin(user)}
                                                    className="h-7 px-2.5 text-xs bg-red-600/80 hover:bg-red-600 text-white"
                                                    title="Clear PIN"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

function PendingUserCard({ user, onApprove, onReject }) {
    const [SelectedRole, setSelectedRole] = useState('Agent');

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-orange-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900">{user.DisplayName}</p>
                    {user.Nickname && <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">{user.Nickname}</span>}
                </div>
                <p className="text-sm text-gray-500">{user.Email} | @{user.Username}</p>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
                <select 
                    className="flex h-10 w-full md:w-32 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                    value={SelectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                >
                    <option value="Agent">Agent</option>
                    <option value="Staff">Staff</option>
                </select>
                <Button 
                    onClick={() => onApprove(user.UserID, SelectedRole)}
                    className="bg-green-600 hover:bg-green-700"
                >
                    <Check className="w-4 h-4 mr-1" /> Approve
                </Button>
                <Button variant="destructive" onClick={() => onReject(user)}>
                    <X className="w-4 h-4 mr-1" /> Reject
                </Button>
            </div>
        </div>
    );
}

export function UserManagement() {
    const { t } = useTranslation();
    const { user } = useAuthStore();
    const currentUserRole = user?.role || 'Staff';
    const [ActiveUsers, setActiveUsers] = useState([]);
    const [PendingUsers, setPendingUsers] = useState([]);
    const [UsersLoading, SetUsersLoading] = useState(true);
    const [UsersError, SetUsersError] = useState(false);
    const [DeveloperPins, setDeveloperPins] = useState([]);
    const [IsLoadingPins, setIsLoadingPins] = useState(false);

    const [rejectTarget, setRejectTarget] = useState(null);
    const [resetPinTarget, setResetPinTarget] = useState(null);
    const [clearPinTarget, setClearPinTarget] = useState(null);
    const [newPinInput, setNewPinInput] = useState('');
    const [isActionLoading, setIsActionLoading] = useState(false);

    const fetchDeveloperPins = useCallback(async () => {
        if (currentUserRole !== 'Developer') return;
        setIsLoadingPins(true);
        const { data, error } = await supabase.rpc('developer_get_user_pins');
        if (error) {
            console.error('Error fetching developer PINs:', error);
        } else if (data) {
            setDeveloperPins(data);
        }
        setIsLoadingPins(false);
    }, [currentUserRole]);

    const fetchUsers = useCallback(async () => {
        SetUsersLoading(true);
        SetUsersError(false);
        const { data, error } = await supabase
            .from('Users')
            .select('*')
            .order('CreatedAt', { ascending: false });
            
        if (error) {
            console.error('Error fetching users:', error);
            SetUsersError(true);
        } else {
            let active = data.filter(u => u.Role !== 'Pending' && u.Role !== 'Rejected');
            
            // Hide Developer role from Founder and Manager
            if (currentUserRole === 'Founder' || currentUserRole === 'Manager') {
                active = active.filter(u => u.Role !== 'Developer');
            }
            
            setActiveUsers(active);
            setPendingUsers(data.filter(u => u.Role === 'Pending'));
        }

        SetUsersLoading(false);
        if (currentUserRole === 'Developer') {
            fetchDeveloperPins();
        }
    }, [currentUserRole, fetchDeveloperPins]);

    useEffect(() => {
        fetchUsers(); // eslint-disable-line react-hooks/set-state-in-effect
    }, [fetchUsers]);

    const handleApprove = async (userId, selectedRole) => {
        if (!selectedRole || selectedRole === 'Pending') return;
        
        const prefix = selectedRole === 'Agent' ? 'AGT' : 'STF';
        
        // Find highest StaffID for this prefix
        const { data: MaxIdData } = await supabase
            .from('Users')
            .select('StaffID')
            .like('StaffID', `${prefix}%`)
            .order('StaffID', { ascending: false })
            .limit(1);
            
        let NextNumber = 1;
        if (MaxIdData && MaxIdData.length > 0 && MaxIdData[0].StaffID) {
            const CurrentMax = parseInt(MaxIdData[0].StaffID.replace(prefix, ''), 10);
            if (!isNaN(CurrentMax)) {
                NextNumber = CurrentMax + 1;
            }
        }
        
        const NewStaffID = `${prefix}${NextNumber.toString().padStart(3, '0')}`;
        
        const { error } = await supabase
            .from('Users')
            .update({ Role: selectedRole, StaffID: NewStaffID, IsActive: true })
            .eq('UserID', userId);
            
        if (error) {
            console.error('Error approving user:', error);
            toast.error('Failed to approve user');
        } else {
            toast.success(`User Approved (${NewStaffID})`);
            fetchUsers();
        }
    };

    const handleReject = (targetUser) => {
        setRejectTarget(targetUser);
    };

    const executeReject = async () => {
        if (!rejectTarget) return;
        setIsActionLoading(true);
        const userId = typeof rejectTarget === 'string' ? rejectTarget : rejectTarget.UserID;
        const { error } = await supabase
            .from('Users')
            .update({ Role: 'Rejected', IsActive: false })
            .eq('UserID', userId);
            
        setIsActionLoading(false);
        if (error) {
            console.error('Error rejecting user:', error);
            toast.error('Failed to reject user');
        } else {
            toast.success('User Rejected');
            setRejectTarget(null);
            fetchUsers();
        }
    };

    const toggleUserStatus = async (userId, currentStatus) => {
        const NewStatus = !currentStatus;
        const { error } = await supabase
            .from('Users')
            .update({ IsActive: NewStatus })
            .eq('UserID', userId);
            
        if (!error) {
            fetchUsers();
        }
    };

    const handleResetPin = (targetUser) => {
        setResetPinTarget(targetUser);
        setNewPinInput('');
    };

    const executeResetPin = async () => {
        if (!resetPinTarget) return;
        if (newPinInput.trim().length !== 4 || isNaN(newPinInput.trim())) {
            toast.error('PIN must be exactly 4 numeric digits');
            return;
        }

        setIsActionLoading(true);
        const { error } = await supabase.rpc('developer_reset_user_pin', {
            target_user_id: resetPinTarget.UserID,
            new_pin: newPinInput.trim()
        });
        setIsActionLoading(false);

        if (error) {
            console.error('Error resetting PIN:', error);
            toast.error('Failed to reset user PIN');
        } else {
            toast.success(`PIN updated to ${newPinInput.trim()} for ${resetPinTarget.DisplayName}`);
            setResetPinTarget(null);
            setNewPinInput('');
            fetchDeveloperPins();
        }
    };

    const handleClearPin = (targetUser) => {
        setClearPinTarget(targetUser);
    };

    const executeClearPin = async () => {
        if (!clearPinTarget) return;
        setIsActionLoading(true);
        const { error } = await supabase.rpc('developer_reset_user_pin', {
            target_user_id: clearPinTarget.UserID,
            new_pin: null
        });
        setIsActionLoading(false);

        if (error) {
            console.error('Error clearing PIN:', error);
            toast.error('Failed to clear user PIN');
        } else {
            toast.success(`PIN cleared for ${clearPinTarget.DisplayName}`);
            setClearPinTarget(null);
            fetchDeveloperPins();
        }
    };

    const columns = [
        { header: 'ID', accessorKey: 'StaffID', cell: ({row}) => <span className="text-gray-500 font-mono text-xs">{row.original.StaffID}</span> },
        { 
            header: 'Name', 
            accessorKey: 'DisplayName', 
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">{row.original.DisplayName}</span>
                    {row.original.Nickname && <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">{row.original.Nickname}</span>}
                </div>
            ) 
        },
        { header: 'Username', accessorKey: 'Username', cell: ({row}) => <span className="text-gray-500">@{row.original.Username}</span> },
        { header: 'Email', accessorKey: 'Email' },
        { 
            header: 'Role', 
            accessorKey: 'Role',
            cell: ({ row }) => {
                let BadgeColor = 'bg-gray-100 text-gray-800';
                if (row.original.Role === 'Founder') BadgeColor = 'bg-indigo-100 text-indigo-800';
                else if (row.original.Role === 'Manager') BadgeColor = 'bg-violet-100 text-violet-800';
                else if (row.original.Role === 'Developer') BadgeColor = 'bg-blue-100 text-blue-800';
                else if (row.original.Role === 'Agent') BadgeColor = 'bg-emerald-100 text-emerald-800';
                
                return (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center w-fit ${BadgeColor}`}>
                        {row.original.Role === 'Founder' && <Shield className="w-3 h-3 mr-1" />}
                        {row.original.Role}
                    </span>
                );
            }
        },
        { 
            header: 'Status', 
            accessorKey: 'IsActive',
            cell: ({ row }) => {
                const IsActive = row.original.IsActive;
                return (
                    <button 
                        onClick={() => toggleUserStatus(row.original.UserID, IsActive)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${IsActive ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-red-100 text-red-800 hover:bg-red-200'}`}
                        title="Click to toggle status"
                    >
                        {IsActive ? 'Active' : 'Inactive'}
                    </button>
                );
            }
        }
    ];

    return (
        <SettingsPage Title="User Management" Description="Manage users, roles and access.">
            {currentUserRole === 'Developer' && (
                <DeveloperPinDirectory
                    pins={DeveloperPins}
                    isLoading={IsLoadingPins}
                    onResetPin={handleResetPin}
                    onClearPin={handleClearPin}
                />
            )}

            {PendingUsers.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-orange-800 mb-4 flex items-center">
                        <UserPlus className="w-5 h-5 mr-2" />
                        Pending Approvals ({PendingUsers.length})
                    </h3>
                    <div className="space-y-4">
                        {PendingUsers.map(user => (
                            <PendingUserCard 
                                key={user.UserID} 
                                user={user} 
                                onApprove={handleApprove} 
                                onReject={handleReject} 
                            />
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
                {UsersLoading ? <p role="status" className="py-6 text-sm text-gray-500">Loading users…</p> : UsersError ? <div className="space-y-3"><p role="alert" className="text-sm text-red-700">Unable to load users. Try again.</p><Button variant="outline" onClick={fetchUsers}>Retry</Button></div> : ActiveUsers.length === 0 && PendingUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                        <Users className="w-12 h-12 mb-4" />
                        <p className="text-lg font-medium">{t('settingsUsers.emptyTitle')}</p>
                        <p className="text-sm mt-1">{t('settingsUsers.emptyDescription')}</p>
                    </div>
                ) : (
                    <div className="relative min-w-0">
                        <div className="min-w-0">
                            <DataTable 
                                columns={columns} 
                                data={ActiveUsers} 
                                searchPlaceholder="Search" 
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Reject User Confirmation Modal */}
            <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
                <DialogContent className="max-w-md rounded-2xl p-6 border border-gray-200/80 shadow-2xl bg-white overflow-hidden">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-gray-900">
                            Reject User Registration
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-gray-600 py-2">
                        Are you sure you want to reject this user registration?
                    </p>
                    <DialogFooter className="pt-2 flex justify-end gap-2.5">
                        <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={isActionLoading} className="text-xs font-semibold px-4 h-9">
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={executeReject} disabled={isActionLoading} className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-5 h-9">
                            {isActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                            Confirm Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Set PIN Modal */}
            <Dialog open={!!resetPinTarget} onOpenChange={(open) => !open && setResetPinTarget(null)}>
                <DialogContent className="max-w-xl rounded-2xl p-6 border border-gray-200 shadow-2xl bg-slate-900 text-white overflow-hidden">
                    <DialogHeader className="space-y-3 pb-2">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center text-primary shrink-0 shadow-sm">
                                <KeyRound className="w-6 h-6" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold text-white tracking-tight">
                                    Set POS Terminal PIN
                                </DialogTitle>
                                <DialogDescription className="text-xs text-gray-500 font-medium mt-0.5">
                                    Set a 4-digit numeric PIN for quick unlock
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-600 flex items-center justify-between">
                            <span>Target Account</span>
                            <span className="font-mono font-bold text-amber-300 bg-slate-950 px-2.5 py-1 rounded border border-slate-700">
                                {resetPinTarget?.DisplayName} (@{resetPinTarget?.Username})
                            </span>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="newPinInput" className="text-xs font-semibold text-slate-200">
                                Enter 4-Digit Numeric PIN
                            </Label>
                            <Input
                                id="newPinInput"
                                type="text"
                                maxLength={4}
                                value={newPinInput}
                                onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                className="h-11 bg-slate-950 border-slate-700 text-white font-mono text-center text-lg tracking-widest rounded-xl focus-visible:ring-amber-400"
                            />
                        </div>
                    </div>
                    <DialogFooter className="pt-4 border-t border-slate-800 flex justify-end gap-2.5">
                        <Button variant="ghost" onClick={() => setResetPinTarget(null)} disabled={isActionLoading} className="text-xs font-semibold px-4 h-9 text-gray-600 hover:bg-slate-800">
                            Cancel
                        </Button>
                        <Button onClick={executeResetPin} disabled={isActionLoading || newPinInput.length !== 4} className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold px-5 h-9">
                            {isActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                            Save PIN
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Clear PIN Modal */}
            <Dialog open={!!clearPinTarget} onOpenChange={(open) => !open && setClearPinTarget(null)}>
                <DialogContent className="max-w-md rounded-2xl p-6 border border-gray-200 shadow-2xl bg-slate-900 text-white overflow-hidden">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-gray-900">
                            Clear POS Terminal PIN
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-gray-600 py-2">
                        Are you sure you want to clear and remove the PIN for <strong className="text-white">{clearPinTarget?.DisplayName}</strong>?
                    </p>
                    <DialogFooter className="pt-2 flex justify-end gap-2.5">
                        <Button variant="ghost" onClick={() => setClearPinTarget(null)} disabled={isActionLoading} className="text-xs font-semibold px-4 h-9 text-gray-600 hover:bg-slate-800">
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={executeClearPin} disabled={isActionLoading} className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-5 h-9">
                            {isActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                            Confirm Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </SettingsPage>
    );
}


