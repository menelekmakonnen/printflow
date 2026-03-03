'use client';

import { useEffect, useState } from 'react';
import { getNotifications } from '@/lib/api';
import { IconSearch, IconBell, IconMail, IconCalendar } from '@/lib/icons';

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');

    useEffect(() => { loadNotifications(); }, []);

    async function loadNotifications() {
        setLoading(true);
        const res = await getNotifications();
        if (res.success) setNotifications(res.data);
        setLoading(false);
    }

    const filtered = filter
        ? notifications.filter(n =>
            n.job_id?.toLowerCase().includes(filter.toLowerCase()) ||
            n.recipient?.toLowerCase().includes(filter.toLowerCase()) ||
            n.notification_type?.toLowerCase().includes(filter.toLowerCase())
        )
        : notifications;

    if (loading) {
        return <div className="loading-center"><div className="spinner"></div></div>;
    }

    const channelIcon = (ch) => {
        if (ch === 'email') return <IconMail size={14} />;
        if (ch === 'calendar') return <IconCalendar size={14} />;
        return <IconBell size={14} />;
    };

    return (
        <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-lg)' }}>
                Notification Log
            </h2>

            <div className="filter-bar">
                <div className="search-wrapper">
                    <span className="search-icon"><IconSearch size={14} /></span>
                    <input type="text" className="search-input" placeholder="Search by Job ID, recipient, or type..."
                        value={filter} onChange={e => setFilter(e.target.value)} />
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon"><IconBell size={40} color="var(--color-text-muted)" /></div>
                        <div className="empty-state-title">No notifications</div>
                        <p>Notifications will appear here when status changes trigger them.</p>
                    </div>
                </div>
            ) : (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Job ID</th>
                                <th>Channel</th>
                                <th>Type</th>
                                <th>Recipient</th>
                                <th>Status</th>
                                <th>Sent At</th>
                                <th>Error</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((n, i) => (
                                <tr key={i}>
                                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                        <a href={`/dashboard/jobs/${n.job_id}`} style={{ color: 'var(--color-accent)' }}>{n.job_id}</a>
                                    </td>
                                    <td>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textTransform: 'capitalize' }}>
                                            {channelIcon(n.channel)} {n.channel}
                                        </span>
                                    </td>
                                    <td style={{ textTransform: 'capitalize' }}>{(n.notification_type || '').replace(/_/g, ' ')}</td>
                                    <td style={{ color: 'var(--color-text-muted)' }}>{n.recipient || '\u2014'}</td>
                                    <td>
                                        <span className={`badge ${n.status === 'sent' ? 'badge-completed' : n.status === 'failed' ? 'badge-pending' : 'badge-approved'}`}>
                                            {n.status}
                                        </span>
                                    </td>
                                    <td style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                                        {n.sent_at ? new Date(n.sent_at).toLocaleString() : '\u2014'}
                                    </td>
                                    <td style={{ color: 'var(--color-pending)', fontSize: '0.75rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {n.error_message || '\u2014'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div style={{ marginTop: 'var(--space-md)', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                Showing {filtered.length} notifications
            </div>
        </div>
    );
}
