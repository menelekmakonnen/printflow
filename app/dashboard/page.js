'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, getDashboardStats, getJobs, hasAnyRole, getUserRoles } from '@/lib/api';
import {
    IconPlusCircle, IconClipboard, IconQueue, IconInbox,
    IconArrowRight, IconClock, IconDollarSign, IconTag
} from '@/lib/icons';
import Link from 'next/link';

const STATUS_CONFIG = {
    pending_payment: { label: 'Pending Payment', badge: 'badge-pending' },
    approved: { label: 'Approved', badge: 'badge-approved' },
    in_progress: { label: 'In Progress', badge: 'badge-progress' },
    finishing: { label: 'Finishing', badge: 'badge-finishing' },
    completed: { label: 'Completed', badge: 'badge-completed' },
    cancelled: { label: 'Cancelled', badge: 'badge-error' }
};

export default function DashboardHome() {
    const router = useRouter();
    const [user, setUserState] = useState(null);
    const [stats, setStats] = useState(null);
    const [recentJobs, setRecentJobs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const u = getUser();
        setUserState(u);
        loadData(u);
    }, []);

    async function loadData(u) {
        setLoading(true);
        try {
            const jobsRes = await getJobs();
            if (jobsRes.success) {
                setRecentJobs(jobsRes.data.slice(0, 5));
            }
            const uRoles = (u?.roles || u?.role || '').split(',').map(r => r.trim());
            if (u && uRoles.some(r => ['admin', 'super_admin'].includes(r))) {
                const statsRes = await getDashboardStats();
                if (statsRes.success) setStats(statsRes.data);
            }
        } catch (err) {
            console.error('Failed to load dashboard:', err);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return <div className="loading-center"><div className="spinner"></div></div>;
    }

    const roles = getUserRoles();
    const isAdmin = hasAnyRole(['admin', 'super_admin']);

    return (
        <div>
            <div style={{ marginBottom: 'var(--space-xl)' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 'var(--space-xs)' }}>
                    Welcome back, {user?.display_name}
                </h1>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                    {isAdmin ? 'Here\'s your operations overview.' : 'Here\'s what needs your attention.'}
                </p>
            </div>

            {isAdmin && stats && (
                <div className="stats-grid">
                    <div className="stat-card stat-pending">
                        <div className="stat-value">{stats.pending_payment}</div>
                        <div className="stat-label">Pending Payment</div>
                    </div>
                    <div className="stat-card stat-approved">
                        <div className="stat-value">{stats.approved}</div>
                        <div className="stat-label">Approved</div>
                    </div>
                    <div className="stat-card stat-progress">
                        <div className="stat-value">{stats.in_progress}</div>
                        <div className="stat-label">In Progress</div>
                    </div>
                    <div className="stat-card stat-finishing">
                        <div className="stat-value">{stats.finishing}</div>
                        <div className="stat-label">Finishing</div>
                    </div>
                    <div className="stat-card stat-completed">
                        <div className="stat-value">{stats.completed}</div>
                        <div className="stat-label">Completed</div>
                    </div>
                    <div className="stat-card stat-revenue">
                        <div className="stat-value">{'\u20B5'}{Number(stats.total_revenue).toLocaleString()}</div>
                        <div className="stat-label">Total Revenue</div>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
                {(roles.some(r => ['receptionist', 'admin', 'super_admin'].includes(r))) && (
                    <Link href="/dashboard/products" style={{ textDecoration: 'none' }}>
                        <div className="card card-hover" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                            <div style={{ marginBottom: 'var(--space-sm)', color: 'var(--color-accent)' }}><IconTag size={32} /></div>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>Products & Services</div>
                            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem', marginTop: 'var(--space-xs)' }}>
                                Browse catalog and build quotes
                            </div>
                        </div>
                    </Link>
                )}
                {(roles.some(r => ['receptionist', 'admin', 'super_admin'].includes(r))) && (
                    <Link href="/dashboard/jobs/new" style={{ textDecoration: 'none' }}>
                        <div className="card card-hover" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                            <div style={{ marginBottom: 'var(--space-sm)', color: 'var(--color-accent)' }}><IconPlusCircle size={32} /></div>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>Create New Job</div>
                            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem', marginTop: 'var(--space-xs)' }}>
                                Add a new print job ticket
                            </div>
                        </div>
                    </Link>
                )}
                {(roles.some(r => ['receptionist', 'admin', 'super_admin'].includes(r))) && (
                    <Link href="/dashboard/jobs" style={{ textDecoration: 'none' }}>
                        <div className="card card-hover" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                            <div style={{ marginBottom: 'var(--space-sm)', color: 'var(--color-accent)' }}><IconClipboard size={32} /></div>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>View All Jobs</div>
                            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem', marginTop: 'var(--space-xs)' }}>
                                Browse and manage all tickets
                            </div>
                        </div>
                    </Link>
                )}
                {(roles.some(r => ['designer', 'finisher', 'admin', 'super_admin'].includes(r))) && (
                    <Link href="/dashboard/queue" style={{ textDecoration: 'none' }}>
                        <div className="card card-hover" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                            <div style={{ marginBottom: 'var(--space-sm)', color: 'var(--color-accent)' }}><IconQueue size={32} /></div>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>Production Queue</div>
                            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem', marginTop: 'var(--space-xs)' }}>
                                Jobs waiting for your action
                            </div>
                        </div>
                    </Link>
                )}
            </div>

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Recent Jobs</h3>
                    <Link href="/dashboard/jobs" className="btn btn-ghost" style={{ fontSize: '0.8125rem', gap: '4px' }}>
                        View All <IconArrowRight size={14} />
                    </Link>
                </div>
                {recentJobs.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon"><IconInbox size={40} color="var(--color-text-muted)" /></div>
                        <div className="empty-state-title">No jobs yet</div>
                        <p>Jobs will appear here as they are created.</p>
                    </div>
                ) : (
                    <div className="job-list">
                        {recentJobs.map(job => {
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
                                                    <span>{new Date(job.created_at).getTime() ? new Date(job.created_at).toLocaleDateString() : job.created_at}</span>
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
            </div>
        </div>
    );
}
