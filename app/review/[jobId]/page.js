'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getJobPublic, submitDesignFeedback } from '@/lib/api';
import { IconCheckCircle, IconXCircle } from '@/lib/icons';

export default function PublicReviewPage() {
    const params = useParams();
    const jobId = params.jobId;

    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        async function fetchJob() {
            setLoading(true);
            const res = await getJobPublic(jobId);
            if (res.success) {
                setJob(res.data);
            } else {
                setError(res.error || 'Failed to load design review');
            }
            setLoading(false);
        }
        if (jobId) fetchJob();
    }, [jobId]);

    const handleFeedback = async (approved) => {
        if (!approved && !feedback.trim()) {
            setError('Please provide feedback on what changes are needed.');
            return;
        }

        if (confirm(`Are you sure you want to ${approved ? 'approve' : 'reject'} this design?`)) {
            setSubmitting(true);
            setError('');
            const res = await submitDesignFeedback(jobId, approved, feedback);
            if (res.success) {
                setSuccessMsg(`Thank you! Your feedback has been submitted. The design is now ${approved ? 'approved for print' : 'returned to the designer'}.`);
                setJob(prev => ({ ...prev, status: res.data.status }));
            } else {
                setError(res.error || 'Failed to submit feedback.');
            }
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--color-bg-base)' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    if (error && !job) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--color-bg-base)', padding: '20px' }}>
                <div className="card" style={{ maxWidth: '500px', textAlign: 'center' }}>
                    <div style={{ color: 'var(--color-error)', marginBottom: '16px' }}><IconXCircle size={48} /></div>
                    <h2 style={{ marginBottom: '8px' }}>Error Loading Review</h2>
                    <p style={{ color: 'var(--color-text-muted)' }}>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', padding: 'var(--space-xl)', background: 'var(--color-bg-base)', display: 'flex', justifyContent: 'center' }}>
            <div style={{ maxWidth: '800px', width: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
                    <h1 style={{ fontWeight: 800, fontSize: '1.75rem', marginBottom: '8px' }}>PopOut Studios</h1>
                    <p style={{ color: 'var(--color-text-muted)' }}>Design Review for Job <strong>{job.job_id}</strong></p>
                </div>

                {successMsg ? (
                    <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                        <div style={{ color: 'var(--color-approved)', marginBottom: '16px' }}><IconCheckCircle size={64} /></div>
                        <h2>Feedback Received</h2>
                        <p style={{ color: 'var(--color-text-muted)', marginTop: '8px' }}>{successMsg}</p>
                    </div>
                ) : (
                    <div className="card">
                        <div style={{ marginBottom: 'var(--space-lg)' }}>
                            <h2 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>{job.client_name}</h2>
                            <p style={{ color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>{(job.job_type || '').replace(/_/g, ' ')}</p>
                        </div>

                        {job.status === 'pending_design_approval' ? (
                            <>
                                <div style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-xl)', textAlign: 'center' }}>
                                    {job.design_sample_url ? (
                                        <a href={job.design_sample_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ display: 'inline-flex', gap: '8px', color: 'var(--color-accent)' }}>
                                            <IconCheckCircle size={18} /> Click here to View Downloadable Design Sample File
                                        </a>
                                    ) : (
                                        <p style={{ color: 'var(--color-text-muted)' }}>No design sample provided.</p>
                                    )}
                                </div>

                                {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-lg)' }}>{error}</div>}

                                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-xl)' }}>
                                    <h3 style={{ fontSize: '1.125rem', marginBottom: 'var(--space-md)' }}>Provide Feedback</h3>

                                    <div className="form-group">
                                        <label className="form-label">Notes for Designer (Required if requesting changes)</label>
                                        <textarea
                                            className="form-input"
                                            rows="4"
                                            placeholder="Please describe any changes you would like to see, or add a note of approval..."
                                            value={feedback}
                                            onChange={e => setFeedback(e.target.value)}
                                        ></textarea>
                                    </div>

                                    <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
                                        <button
                                            className="btn btn-primary"
                                            style={{ flex: 1, padding: '14px', fontSize: '1rem', background: 'var(--color-error)', border: 'none' }}
                                            onClick={() => handleFeedback(false)}
                                            disabled={submitting}
                                        >
                                            {submitting ? 'Submitting...' : 'Request Changes'}
                                        </button>
                                        <button
                                            className="btn btn-primary"
                                            style={{ flex: 1, padding: '14px', fontSize: '1rem', background: 'var(--color-approved)' }}
                                            onClick={() => handleFeedback(true)}
                                            disabled={submitting}
                                        >
                                            {submitting ? 'Submitting...' : 'Approve Design'}
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', padding: 'var(--space-xl) 0' }}>
                                <div style={{ display: 'inline-flex', background: 'var(--color-bg-secondary)', padding: '12px 24px', borderRadius: '30px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                    Current Status: {(job.status || '').replace(/_/g, ' ')}
                                </div>
                                <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-md)' }}>This design is no longer pending your approval.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
