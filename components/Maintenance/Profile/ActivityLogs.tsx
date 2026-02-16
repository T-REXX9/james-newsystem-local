import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { Search, Filter, RefreshCw, User, Activity } from 'lucide-react';

interface ActivityLog {
    id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    details: any;
    created_at: string;
    user_id: string;
    profiles?: {
        first_name: string;
        last_name: string;
    };
}

export default function ActivityLogs() {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchLogs = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('activity_logs' as any)
            .select(`
                *,
                profiles (
                    first_name,
                    last_name
                )
            `)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) {
            console.error('Error fetching logs:', error);
        } else {
            setLogs(data as any || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const filteredLogs = logs.filter(log =>
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.entity_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.profiles?.first_name + ' ' + log.profiles?.last_name).toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Activity className="text-blue-600" />
                        Activity Logs
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">System audit trail (Last 100 events)</p>
                </div>
                <button
                    onClick={fetchLogs}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    title="Refresh Logs"
                >
                    <RefreshCw size={20} />
                </button>
            </div>

            {/* Content */}
            <div className="p-6 flex-1 overflow-hidden flex flex-col">
                <div className="mb-4 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search logs by action, user, or entity..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                </div>

                <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-sm sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3 font-medium">Timestamp</th>
                                <th className="px-6 py-3 font-medium">User</th>
                                <th className="px-6 py-3 font-medium">Action</th>
                                <th className="px-6 py-3 font-medium">Entity</th>
                                <th className="px-6 py-3 font-medium">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                            {filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        No logs found.
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-sm">
                                        <td className="px-6 py-3 text-gray-500 whitespace-nowrap">
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold">
                                                    <User size={12} />
                                                </div>
                                                <span className="font-medium text-gray-900 dark:text-white">
                                                    {log.profiles ? `${log.profiles.first_name} ${log.profiles.last_name}` : 'Unknown'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${log.action.includes('DELETE') ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' :
                                                log.action.includes('CREATE') ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' :
                                                    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                                                }`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-gray-700 dark:text-gray-300">
                                            {log.entity_type} {log.entity_id ? `(#${log.entity_id.substring(0, 8)}...)` : ''}
                                        </td>
                                        <td className="px-6 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs max-w-xs truncate" title={JSON.stringify(log.details, null, 2)}>
                                            {log.details ? JSON.stringify(log.details) : '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
