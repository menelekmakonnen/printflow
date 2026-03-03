'use client';

import { useEffect, useState } from 'react';
import { getActivityLog } from '@/lib/api';
import {
    IconSearch, IconScroll, IconCheckCircle, IconUser,
    IconEdit, IconPlusCircle, IconKey, IconGear, IconClipboard, IconTrash
} from '@/lib/icons';

const ACTION_ICONS = {
    login: IconKey,
    create_job: IconPlusCircle,
    update_job: IconEdit,
    approve_job: IconCheckCircle,
    receive_job: IconClipboard,
    processing_complete: IconGear,
    complete_job: IconCheckCircle,
    create_user: IconUser,
    update_user: IconEdit,
    delete_user: IconTrash,
    update_settings: IconGear
};

export default function ActivityPage() {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');

    useEffect(() => { loadActivity(); }, []);

    async function loadActivity() {
        setLoading(true);
        const res = await getActivityLog();
        if (res.success) setActivities(res.data);
        setLoading(false);
    }

    const filtered = filter
        ? activities.filter(a =>
            (a.action || '').toLowerCase().includes(filter.toLowerCase()) ||
            (a.performed_by || '').toLowerCase().includes(filter.toLowerCase()) ||
            (a.details || '').toLowerCase().includes(filter.toLowerCase())
        )
        : activities;

    if (loading) {
        return <div className="loading-center"><div className="spinner"></div></div>;
    }

    return (
        <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-lg)' }}>
                Activity Log
            </h2>

            <div className="filter-bar">
                <div className="search-wrapper">
                    <span className="search-icon"><IconSearch size={14} /></span>
                    <input type="text" className="search-input" placeholder="Search activity..."
                        value={filter} onChange={e => setFilter(e.target.value)} />
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon"><IconScroll size={40} color="var(--color-text-muted)" /></div>
                        <div className="empty-state-title">No activity yet</div>
                        <p>Activity will be logged here as actions are performed.</p>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    {filtered.map((a, i) => {
                        const ActionIcon = ACTION_ICONS[a.action] || IconGear;
                        return (
                            <div key={i} className="card" style={{ padding: 'var(--space-md) var(--space-lg)' }}>
                                <div style={{ display: 'flex', alignItems: 'start', gap: 'var(--space-md)' }}>
                                    <div style={{
                                        width: 36, height: 36,
                                        borderRadius: 'var(--radius-md)',
                                        background: 'var(--color-bg-secondary)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                        color: 'var(--color-accent)'
                                    }}>
                                        <ActionIcon size={18} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.875rem', textTransform: 'capitalize' }}>
                                                    {(a.action || '').replace(/_/g, ' ')}
                                                </div>
                                                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                                    by <strong>{a.performed_by || 'system'}</strong>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                                                {a.timestamp ? new Date(a.timestamp).toLocaleString() : '\u2014'}
                                            </div>
                                        </div>
                                        {a.details && (
                                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: 'var(--space-xs)', lineHeight: 1.5 }}>
                                                {a.details}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div style={{ marginTop: 'var(--space-md)', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                Showing {filtered.length} activities
            </div>
        </div>
    );
}
