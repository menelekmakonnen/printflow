'use client';

import { useEffect, useState } from 'react';
import { getJobs } from '@/lib/api';
import { IconPlusCircle, IconSearch, IconInbox } from '@/lib/icons';
import Link from 'next/link';

const STATUS_CONFIG = {
    pending_payment: { label: 'Pending', badge: 'badge-pending' },
    approved: { label: 'Approved', badge: 'badge-approved' },
    in_progress: { label: 'In Progress', badge: 'badge-progress' },
    finishing: { label: 'Finishing', badge: 'badge-finishing' },
    completed: { label: 'Completed', badge: 'badge-completed' }
};

const FILTER_TABS = [
    { key: 'all', label: 'All' },
    { key: 'pending_payment', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'finishing', label: 'Finishing' },
    { key: 'completed', label: 'Completed' }
];

export default function JobsPage() {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');

    useEffect(() => {
        loadJobs();
    }, []);

    async function loadJobs() {
        setLoading(true);
        const res = await getJobs();
        if (res.success) setJobs(res.data);
        setLoading(false);
    }

    const filtered = jobs.filter(j => {
        if (filter !== 'all' && j.status !== filter) return false;
        if (search) {
            const s = search.toLowerCase();
            return (
                (j.job_id || '').toLowerCase().includes(s) ||
                (j.client_name || '').toLowerCase().includes(s) ||
                (j.job_type || '').toLowerCase().includes(s)
            );
        }
        return true;
    });

    if (loading) {
        return <div className="loading-center"><div className="spinner"></div></div>;
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>All Jobs</h2>
                <Link href="/dashboard/jobs/new" className="btn btn-primary" style={{ gap: '6px' }}>
                    <IconPlusCircle size={16} /> New Job
                </Link>
            </div>

            <div className="filter-bar">
                <div className="filter-tabs">
                    {FILTER_TABS.map(tab => (
                        <button
                            key={tab.key}
                            className={`filter-tab ${filter === tab.key ? 'active' : ''}`}
                            onClick={() => setFilter(tab.key)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="search-wrapper">
                    <span className="search-icon"><IconSearch size={14} /></span>
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search jobs..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon"><IconInbox size={40} color="var(--color-text-muted)" /></div>
                        <div className="empty-state-title">No jobs found</div>
                        <p>
                            {search ? 'Try a different search term.' : 'No jobs match the selected filter.'}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="job-list">
                    {filtered.map(job => {
                        const cfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending_payment;
                        return (
                            <Link
                                key={job.job_id}
                                href={`/dashboard/jobs/${job.job_id}`}
                                style={{ textDecoration: 'none', color: 'inherit' }}
                            >
                                <div className="job-card">
                                    <div>
                                        <div className="job-card-id">{job.job_id}</div>
                                        {job.client_name && <div className="job-card-client">{job.client_name}</div>}
                                        <div className="job-card-meta">
                                            <span>{(job.job_type || '').replace(/_/g, ' ')}</span>
                                            {job.created_at && (
                                                <span>{new Date(job.created_at).toLocaleDateString()}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="job-card-right">
                                        <span className={`badge ${cfg.badge}`}>{cfg.label}</span>
                                        {job.total_amount !== undefined && (
                                            <div className="job-card-amount">{'\u20B5'}{Number(job.total_amount).toLocaleString()}</div>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}

            <div style={{ marginTop: 'var(--space-lg)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                Showing {filtered.length} of {jobs.length} jobs
            </div>
        </div>
    );
}
