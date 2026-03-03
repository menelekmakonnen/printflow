'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getJobs, getUser, receiveJob, processingComplete, completeJob, hasAnyRole, getUserRoles } from '@/lib/api';
import { IconWrench, IconScissors, IconTrophy, IconInbox, IconCheckCircle } from '@/lib/icons';

const STATUS_CONFIG = {
    approved: { label: 'Approved \u2014 Waiting', badge: 'badge-approved' },
    in_progress: { label: 'In Progress', badge: 'badge-progress' },
    finishing: { label: 'Finishing', badge: 'badge-finishing' }
};

export default function QueuePage() {
    const router = useRouter();
    const [jobs, setJobs] = useState([]);
    const [user, setUserState] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        setUserState(getUser());
        loadJobs();
    }, []);

    async function loadJobs() {
        setLoading(true);
        const res = await getJobs();
        if (res.success) setJobs(res.data);
        setLoading(false);
    }

    async function handleAction(jobId, actionFn, actionName) {
        if (!confirm(`${actionName}?`)) return;
        setActionLoading(jobId);
        setMessage({ type: '', text: '' });

        const res = await actionFn(jobId);
        if (res.success) {
            setMessage({ type: 'success', text: res.data.message });
            await loadJobs();
        } else {
            setMessage({ type: 'error', text: res.error });
        }
        setActionLoading(null);
    }

    if (loading) {
        return <div className="loading-center"><div className="spinner"></div></div>;
    }

    const roles = getUserRoles();
    const isAdmin = hasAnyRole(['admin', 'super_admin']);

    let queueJobs = jobs;
    if (hasAnyRole(['designer']) && !isAdmin) {
        queueJobs = jobs.filter(j => ['approved', 'in_progress'].includes(j.status));
    } else if (hasAnyRole(['finisher']) && !isAdmin) {
        queueJobs = jobs.filter(j => j.status === 'finishing');
    } else if (isAdmin) {
        queueJobs = jobs.filter(j => ['approved', 'in_progress', 'finishing'].includes(j.status));
    }

    const approvedJobs = queueJobs.filter(j => j.status === 'approved');
    const inProgressJobs = queueJobs.filter(j => j.status === 'in_progress');
    const finishingJobs = queueJobs.filter(j => j.status === 'finishing');

    function renderJobQueue(title, IconComponent, jobList, buttonConfig) {
        return (
            <div style={{ marginBottom: 'var(--space-xl)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <IconComponent size={18} /> {title}
                    <span style={{
                        background: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-full)',
                        padding: '2px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--color-text-muted)'
                    }}>{jobList.length}</span>
                </h3>

                {jobList.length === 0 ? (
                    <div className="card">
                        <div className="empty-state" style={{ padding: 'var(--space-lg)' }}>
                            <p style={{ color: 'var(--color-text-muted)' }}>No jobs in this queue</p>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        {jobList.map(job => {
                            const cfg = STATUS_CONFIG[job.status];
                            return (
                                <div key={job.job_id} className="card" style={{ padding: 'var(--space-lg)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                                        <div>
                                            <div className="job-card-id">{job.job_id}</div>
                                            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px', textTransform: 'capitalize' }}>
                                                {(job.job_type || '').replace(/_/g, ' ')}
                                            </div>
                                        </div>
                                        {cfg && <span className={`badge ${cfg.badge}`}>{cfg.label}</span>}
                                    </div>

                                    {job.job_description && (
                                        <p style={{
                                            color: 'var(--color-text-secondary)',
                                            fontSize: '0.875rem',
                                            marginBottom: 'var(--space-md)',
                                            lineHeight: 1.6,
                                            maxHeight: '60px',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}>
                                            {job.job_description}
                                        </p>
                                    )}

                                    <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                                        <button
                                            className="btn btn-ghost"
                                            onClick={() => router.push(`/dashboard/jobs/${job.job_id}`)}
                                            style={{ fontSize: '0.8125rem' }}
                                        >
                                            View Details
                                        </button>

                                        {buttonConfig && buttonConfig.showFor.includes(job.status) && (
                                            <button
                                                className={`big-btn ${buttonConfig.className}`}
                                                style={{ flex: 1, fontSize: '1rem', padding: '14px' }}
                                                onClick={() => handleAction(job.job_id, buttonConfig.action, buttonConfig.confirmText)}
                                                disabled={actionLoading === job.job_id}
                                            >
                                                {buttonConfig.icon}
                                                {actionLoading === job.job_id ? 'Processing...' : buttonConfig.label}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-lg)' }}>
                Production Queue
            </h2>

            {message.text && (
                <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                    {message.text}
                </div>
            )}

            {(hasAnyRole(['designer']) || isAdmin) && renderJobQueue(
                'Waiting for Processing', IconCheckCircle, approvedJobs,
                { showFor: ['approved'], className: 'big-btn-receive', action: receiveJob, label: 'RECEIVE JOB', confirmText: 'Start processing this job', icon: <IconWrench size={18} style={{ marginRight: '8px' }} /> }
            )}

            {(hasAnyRole(['designer']) || isAdmin) && renderJobQueue(
                'Currently Processing', IconWrench, inProgressJobs,
                { showFor: ['in_progress'], className: 'big-btn-processing', action: processingComplete, label: 'PROCESSING COMPLETE', confirmText: 'Mark processing as complete', icon: <IconScissors size={18} style={{ marginRight: '8px' }} /> }
            )}

            {(hasAnyRole(['finisher']) || isAdmin) && renderJobQueue(
                'Finishing Stage', IconScissors, finishingJobs,
                { showFor: ['finishing'], className: 'big-btn-complete', action: completeJob, label: 'MARK COMPLETED', confirmText: 'Mark this job as completed', icon: <IconTrophy size={18} style={{ marginRight: '8px' }} /> }
            )}

            {queueJobs.length === 0 && (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon"><IconInbox size={40} color="var(--color-text-muted)" /></div>
                        <div className="empty-state-title">Queue is clear!</div>
                        <p>No jobs need your attention right now.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
