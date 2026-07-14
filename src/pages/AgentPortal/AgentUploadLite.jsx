import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/hooks/useAuth';
import { AgentTabs } from './AgentTabs';

import { DataTable } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AgentUploadLite() {
    const { user } = useAuthStore();

    const { data: uploadHistory, isLoading, refetch, isFetching } = useQuery({
        queryKey: ['pending_awb_history', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('PendingAWBUploads')
                .select('*')
                .eq('UserID', user?.id)
                .order('CreatedAt', { ascending: false })
                .limit(50);

            if (error) throw error;
            return data;
        },
        enabled: !!user?.id,
        refetchInterval: 10000 // Auto-refresh every 10 seconds to see updates
    });

    const columns = [
        {
            header: 'Date & Time',
            id: 'DateTime',
            cell: (row) => new Date(row.CreatedAt).toLocaleString('en-GB')
        },
        { header: 'File Name', accessorKey: 'FileName' },
        {
            header: 'Status',
            id: 'Status',
            cell: (row) => (
                <Badge variant={
                    row.Status === 'Processed' ? 'success' :
                        row.Status === 'Failed' ? 'destructive' :
                            'secondary'
                }>
                    {row.Status}
                </Badge>
            )
        }
    ];

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <AgentTabs />

            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Mobile Upload History</h1>
                <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <p className="text-gray-500">
                Files shared via Telegram Bot are processed automatically by the server. Monitor upload status below.
            </p>

            <div className="bg-white rounded-xl shadow-sm border p-6 mt-6">
                <h2 className="text-lg font-semibold mb-4">Upload History (Last 50)</h2>
                {isLoading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    </div>
                ) : (
                    <DataTable
                        data={uploadHistory || []}
                        columns={columns}
                        searchable={false}
                    />
                )}
            </div>
        </div>
    );
}
