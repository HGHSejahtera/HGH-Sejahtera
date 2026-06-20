import { useState, useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { UserPlus, Shield, Check, X, Users, Settings } from 'lucide-react';
import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

const SETTINGS_TABS = [
    { name: 'General', path: '/settings/general', icon: Settings },
    { name: 'User Management', path: '/settings/users', icon: Users },
];

function SettingsTabs() {
    return (
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
            {SETTINGS_TABS.map(tab => (
                <NavLink
                    key={tab.path}
                    to={tab.path}
                    className={({ isActive }) =>
                        `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            isActive
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                        }`
                    }
                >
                    <tab.icon className="w-4 h-4" />
                    {tab.name}
                </NavLink>
            ))}
        </div>
    );
}

function PendingUserCard({ user, onApprove, onReject }) {
    const [SelectedRole, setSelectedRole] = useState('Agent');

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-orange-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <p className="font-bold text-gray-900">{user.DisplayName}</p>
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
                <Button variant="destructive" onClick={() => onReject(user.UserID)}>
                    <X className="w-4 h-4 mr-1" /> Reject
                </Button>
            </div>
        </div>
    );
}

export function UserManagement() {
    const [ActiveUsers, setActiveUsers] = useState([]);
    const [PendingUsers, setPendingUsers] = useState([]);

    const fetchUsers = useCallback(async () => {
        const { data, error } = await supabase
            .from('Users')
            .select('*')
            .order('CreatedAt', { ascending: false });
            
        if (error) {
            console.error('Error fetching users:', error);
        } else {
            setActiveUsers(data.filter(u => u.Role !== 'Pending' && u.Role !== 'Rejected'));
            setPendingUsers(data.filter(u => u.Role === 'Pending'));
        }
    }, []);

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
            alert('Gagal approve user.');
        } else {
            fetchUsers();
        }
    };

    const handleReject = async (userId) => {
        if (window.confirm('Adakah anda pasti mahu menolak (reject) pengguna ini? Mereka tidak akan dapat login.')) {
            const { error } = await supabase
                .from('Users')
                .update({ Role: 'Rejected', IsActive: false })
                .eq('UserID', userId);
                
            if (error) {
                console.error('Error rejecting user:', error);
                alert('Gagal reject user.');
            } else {
                fetchUsers();
            }
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

    const columns = [
        { header: 'ID', accessorKey: 'StaffID', cell: ({row}) => <span className="text-gray-500 font-mono text-xs">{row.original.StaffID}</span> },
        { header: 'Name', accessorKey: 'DisplayName', cell: ({ row }) => <span className="font-bold text-gray-900">{row.original.DisplayName}</span> },
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
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">User Management</h1>
                </div>
            </div>

            <SettingsTabs />

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

            <div className="bg-white rounded-xl shadow-sm border p-4">
                {ActiveUsers.length === 0 && PendingUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                        <Users className="w-12 h-12 mb-4" />
                        <p className="text-lg font-medium">Tiada pengguna lagi</p>
                        <p className="text-sm mt-1">Pengguna baru yang mendaftar akan muncul di sini.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <div className="min-w-[760px]">
                            <DataTable 
                                columns={columns} 
                                data={ActiveUsers} 
                                searchPlaceholder="Search by name, email, or role..." 
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
