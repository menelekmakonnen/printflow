'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    getJob, getUser, approveJob, cancelJob, receiveJob,
    processingComplete, completeJob, getNotifications, hasAnyRole,
    getInventory, deductInventory, sendDesignReview
} from '@/lib/api';
import {
    IconArrowLeft, IconTicket, IconCheckCircle, IconWrench,
    IconScissors, IconTrophy, IconFolder, IconExternalLink,
    IconXCircle, IconPrinter, IconFileText, IconCopy
} from '@/lib/icons';

const STATUS_CONFIG = {
    pending_payment: { label: 'Pending Payment', badge: 'badge-pending', color: 'var(--color-pending)' },
    approved: { label: 'Approved', badge: 'badge-approved', color: 'var(--color-approved)' },
    in_progress: { label: 'In Progress', badge: 'badge-progress', color: 'var(--color-progress)' },
    pending_design_approval: { label: 'Pending Design Approval', badge: 'badge-pending', color: '#f59e0b' },
    approved_for_print: { label: 'Approved for Print', badge: 'badge-approved', color: '#3b82f6' },
    design_rejected: { label: 'Design Rejected', badge: 'badge-error', color: '#ef4444' },
    finishing: { label: 'Finishing', badge: 'badge-finishing', color: 'var(--color-finishing)' },
    completed: { label: 'Completed', badge: 'badge-completed', color: 'var(--color-completed)' }
};

const TIMELINE_STEPS = [
    { key: 'created_at', label: 'Job Created', status: 'pending_payment' },
    { key: 'approved_at', label: 'Payment Confirmed & Approved', status: 'approved' },
    { key: 'processing_started_at', label: 'Processing Started', status: 'in_progress' },
    { key: 'finishing_started_at', label: 'Sent to Finishing', status: 'finishing' },
    { key: 'completed_at', label: 'Job Completed', status: 'completed' }
];

export default function JobDetailPage() {
    const params = useParams();
    const router = useRouter();
    const jobId = params.id;

    const [job, setJob] = useState(null);
    const [user, setUserState] = useState(() => getUser());
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [showTicket, setShowTicket] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Inventory usage state
    const [inventory, setInventory] = useState([]);
    const [showMaterialModal, setShowMaterialModal] = useState(false);
    const [materialForm, setMaterialForm] = useState({ item_id: '', quantity: 1 });
    const [deductLoading, setDeductLoading] = useState(false);

    // Design Review state
    const [showDesignModal, setShowDesignModal] = useState(false);
    const [designForm, setDesignForm] = useState({ file: null, messageToClient: '' });
    const [sendDesignLoading, setSendDesignLoading] = useState(false);

    const loadJob = useCallback(async () => {
        setLoading(true);
        const res = await getJob(jobId);
        if (res.success) {
            setJob(res.data);
            const u = getUser();
            const uRoles = (u?.roles || u?.role || '').split(',').map(r => r.trim());
            if (uRoles.some(r => ['admin', 'super_admin'].includes(r))) {
                const notifRes = await getNotifications(jobId);
                if (notifRes.success) setNotifications(notifRes.data);
            }
        }
        setLoading(false);

        // Also fetch inventory if user can use materials
        const u = getUser();
        const uRoles = (u?.roles || u?.role || '').split(',').map(r => r.trim());
        if (uRoles.some(r => ['admin', 'super_admin', 'designer', 'finisher'].includes(r))) {
            const invRes = await getInventory('all');
            if (invRes.success) {
                // filter out ones with 0 stock or just show all? Let's show all so they can deduct into negatives
                setInventory(invRes.data);
            }
        }
    }, [jobId]);

    useEffect(() => {
        loadJob();
    }, [loadJob]);

    async function handleDeductMaterial(e) {
        e.preventDefault();
        if (!materialForm.item_id || materialForm.quantity < 1) return;

        setDeductLoading(true);
        setMessage({ type: '', text: '' });

        const res = await deductInventory(jobId, [{
            item_id: materialForm.item_id,
            quantity: materialForm.quantity
        }]);

        if (res.success) {
            setMessage({ type: 'success', text: 'Material usage recorded successfully.' });
            setShowMaterialModal(false);
            setMaterialForm({ item_id: '', quantity: 1 });
            // Optionally reload job if we want to show it in the log
            await loadJob();
        } else {
            setMessage({ type: 'error', text: res.error || 'Failed to record material usage' });
        }
        setDeductLoading(false);
    }

    async function handleSendDesign(e) {
        e.preventDefault();
        if (!designForm.file) return;

        setSendDesignLoading(true);
        setMessage({ type: '', text: '' });

        const reader = new FileReader();
        reader.onload = async () => {
            const base64Data = reader.result.split(',')[1];
            const res = await sendDesignReview(
                jobId,
                designForm.file.name,
                designForm.file.type || 'application/octet-stream',
                base64Data,
                designForm.messageToClient
            );

            if (res.success) {
                setMessage({ type: 'success', text: 'Design sent to client for review' });
                setShowDesignModal(false);
                setDesignForm({ file: null, messageToClient: '' });
                await loadJob();
            } else {
                setMessage({ type: 'error', text: res.error || 'Failed to send design' });
            }
            setSendDesignLoading(false);
        };
        reader.onerror = () => {
            setMessage({ type: 'error', text: 'Failed to read file' });
            setSendDesignLoading(false);
        };
        reader.readAsDataURL(designForm.file);
    }

    async function handleAction(actionFn, actionName) {
        if (!confirm(`Are you sure you want to ${actionName}?`)) return;
        setActionLoading(true);
        setMessage({ type: '', text: '' });

        const res = await actionFn(jobId);
        if (res.success) {
            setMessage({ type: 'success', text: res.data.message });
            await loadJob();
        } else {
            setMessage({ type: 'error', text: res.error || 'Action failed' });
        }
        setActionLoading(false);
    }

    function handleDuplicateJob() {
        if (!confirm('This will create a new draft quote pre-filled with this job\'s details. Proceed?')) return;

        const draftData = {
            form: {
                client_name: job.client_name || '',
                client_phone: job.client_phone || '',
                client_email: job.client_email || '',
                job_type: job.job_type || 'regular',
                requires_design: !!job.requires_design,
                design_sample_url: job.design_sample_url || ''
            },
            lineItems: (job.items || []).map(i => ({
                productId: i.item_id || 'CUSTOM-' + Math.random().toString(36).substr(2, 9),
                name: i.item_name || i.name || '',
                rate: Number(i.rate || 0),
                quantity: Number(i.quantity || i.qty || 1),
                discount: 0,
                unit: i.unit || 'pcs'
            }))
        };

        localStorage.setItem('printflow_draft_job', JSON.stringify(draftData));
        router.push('/dashboard/jobs/new');
    }

    if (loading) {
        return <div className="loading-center"><div className="spinner"></div></div>;
    }

    if (!job) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon"><IconXCircle size={40} color="var(--color-pending)" /></div>
                <div className="empty-state-title">Job not found</div>
                <button className="btn btn-primary" onClick={() => router.push('/dashboard/jobs')}>
                    Back to Jobs
                </button>
            </div>
        );
    }

    const cfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending_payment;
    const isAdmin = hasAnyRole(['admin', 'super_admin']);

    return (
        <div className="job-detail">
            <button
                className="btn btn-ghost"
                onClick={() => router.back()}
                style={{ marginBottom: 'var(--space-lg)', gap: '6px' }}
            >
                <IconArrowLeft size={16} /> Back
            </button>

            {message.text && (
                <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                    {message.text}
                </div>
            )}

            {/* Header */}
            <div className="job-detail-header">
                <div>
                    <div className="job-detail-id">{job.job_id}</div>
                    {job.client_name && <div className="job-detail-client">{job.client_name}</div>}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
                    <span className={`badge ${cfg.badge}`} style={{ fontSize: '0.875rem', padding: '6px 16px' }}>
                        {cfg.label}
                    </span>
                    <button className="btn btn-ghost" onClick={() => setShowTicket(!showTicket)} style={{ gap: '6px' }}>
                        <IconTicket size={16} /> {showTicket ? 'Hide' : 'View'} Ticket
                    </button>
                    {(isAdmin || hasAnyRole(['receptionist', 'designer'])) && (
                        <button className="btn btn-primary" onClick={handleDuplicateJob} style={{ gap: '6px' }}>
                            <IconCopy size={16} /> Duplicate Job
                        </button>
                    )}
                </div>
            </div>

            {/* BIG ACTION BUTTONS */}
            <div style={{ marginBottom: 'var(--space-xl)' }}>
                {job.status === 'pending_payment' && (hasAnyRole(['receptionist']) || isAdmin) && (
                    <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                        <button
                            className="big-btn big-btn-approve"
                            style={{ flex: 1 }}
                            onClick={() => handleAction(approveJob, 'approve this job')}
                            disabled={actionLoading}
                        >
                            <IconCheckCircle size={22} />
                            {actionLoading ? 'Processing...' : 'APPROVE \u2014 Payment Confirmed'}
                        </button>
                        <button
                            className="btn btn-ghost"
                            style={{ color: 'var(--color-error)', border: '1px solid var(--color-error)', padding: '0 24px' }}
                            onClick={() => handleAction(cancelJob, 'cancel this job')}
                            disabled={actionLoading}
                        >
                            Cancel Job
                        </button>
                    </div>
                )}

                {job.status === 'approved' && (hasAnyRole(['designer']) || isAdmin) && (
                    <button
                        className="big-btn big-btn-receive"
                        onClick={() => handleAction(receiveJob, 'start processing this job')}
                        disabled={actionLoading}
                    >
                        <IconWrench size={22} />
                        {actionLoading ? 'Processing...' : 'RECEIVE JOB \u2014 Start Processing'}
                    </button>
                )}

                {job.status === 'in_progress' && job.requires_design && (hasAnyRole(['designer']) || isAdmin) && (
                    <button
                        className="big-btn"
                        onClick={() => setShowDesignModal(true)}
                        style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
                        disabled={actionLoading}
                    >
                        <IconFolder size={22} />
                        SEND DESIGN FOR REVIEW \u2014 Email Client
                    </button>
                )}

                {(job.status === 'in_progress' || job.status === 'approved_for_print' || job.status === 'design_rejected') && (hasAnyRole(['designer']) || isAdmin) && (
                    <button
                        className="big-btn big-btn-processing"
                        onClick={() => handleAction(processingComplete, 'mark processing as complete')}
                        disabled={actionLoading}
                    >
                        <IconScissors size={22} />
                        {actionLoading ? 'Processing...' : 'PROCESSING COMPLETE \u2014 Send to Finishing'}
                    </button>
                )}

                {job.status === 'finishing' && (hasAnyRole(['finisher']) || isAdmin) && (
                    <button
                        className="big-btn big-btn-complete"
                        onClick={() => handleAction(completeJob, 'mark this job as completed')}
                        disabled={actionLoading}
                    >
                        <IconTrophy size={22} />
                        {actionLoading ? 'Processing...' : 'MARK COMPLETED \u2014 Ready for Pickup'}
                    </button>
                )}
            </div>

            {/* RECORD MATERIALS BUTTON */}
            {(job.status === 'in_progress' || job.status === 'finishing') && (hasAnyRole(['designer', 'finisher']) || isAdmin) && (
                <div style={{ marginBottom: 'var(--space-lg)' }}>
                    <button
                        className="btn btn-ghost"
                        onClick={() => setShowMaterialModal(true)}
                        style={{ gap: '6px', color: 'var(--color-accent)', fontWeight: 600, border: '1px solid var(--color-accent)', background: 'rgba(0,0,0,0.02)' }}
                    >
                        <IconScissors size={18} /> Record Material Usage
                    </button>
                </div>
            )}

            {/* Details Grid */}
            <div className="detail-grid">
                {job.client_email && (
                    <div className="detail-item">
                        <div className="detail-item-label">Email</div>
                        <div className="detail-item-value">{job.client_email}</div>
                    </div>
                )}
                {job.client_phone && (
                    <div className="detail-item">
                        <div className="detail-item-label">Phone</div>
                        <div className="detail-item-value">{job.client_phone}</div>
                    </div>
                )}
                {job.requires_design !== undefined && (
                    <div className="detail-item">
                        <div className="detail-item-label">Design Services</div>
                        <div className="detail-item-value">
                            {job.requires_design ? (
                                <span style={{ color: 'var(--color-pending)', fontWeight: 600 }}>Required</span>
                            ) : (
                                <span style={{ color: 'var(--color-text-muted)' }}>Not Required</span>
                            )}
                        </div>
                    </div>
                )}
                {job.design_sample_url && (
                    <div className="detail-item">
                        <div className="detail-item-label">Design Sample</div>
                        <div className="detail-item-value">
                            <a href={job.design_sample_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <IconFileText size={14} /> View Sample <IconExternalLink size={12} />
                            </a>
                        </div>
                    </div>
                )}
                <div className="detail-item">
                    <div className="detail-item-label">Job Type</div>
                    <div className="detail-item-value" style={{ textTransform: 'capitalize' }}>
                        {(job.job_type || '').replace(/_/g, ' ')}
                    </div>
                </div>
                {job.total_amount !== undefined && (
                    <div className="detail-item">
                        <div className="detail-item-label">Total Amount</div>
                        <div className="detail-item-value" style={{ fontSize: '1.25rem' }}>
                            {'\u20B5'}{Number(job.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                )}
                {job.payment_status && (
                    <div className="detail-item">
                        <div className="detail-item-label">Payment Status</div>
                        <div className="detail-item-value" style={{
                            color: job.payment_status === 'paid' ? 'var(--color-completed)' : 'var(--color-pending)'
                        }}>
                            {job.payment_status === 'paid' ? 'Paid' : 'Pending'}
                        </div>
                    </div>
                )}
                {job.case_folder_url && (
                    <div className="detail-item">
                        <div className="detail-item-label">Case Folder</div>
                        <div className="detail-item-value">
                            <a href={job.case_folder_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <IconFolder size={14} /> Open in Drive <IconExternalLink size={12} />
                            </a>
                        </div>
                    </div>
                )}
            </div>

            {/* Description */}
            {job.job_description && (
                <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-sm)' }}>Job Description</h3>
                    <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                        {job.job_description}
                    </p>
                </div>
            )}

            {/* Timeline */}
            <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
                <h3 className="card-title" style={{ marginBottom: 'var(--space-lg)' }}>Timeline</h3>
                <div className="timeline">
                    {TIMELINE_STEPS.map((step) => {
                        const timestamp = job[step.key];
                        const isDone = !!timestamp;
                        const isCurrent = job.status === step.status;
                        return (
                            <div key={step.key} className="timeline-item">
                                <div className={`timeline-dot ${isDone ? 'done' : ''} ${isCurrent ? 'active' : ''}`} />
                                <div className="timeline-title" style={{ color: isDone ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                                    {step.label}
                                </div>
                                {timestamp && (
                                    <div className="timeline-time">
                                        {new Date(timestamp).toLocaleString()}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Notification History */}
            {isAdmin && notifications.length > 0 && (
                <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>Notification History</h3>
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Channel</th>
                                    <th>Type</th>
                                    <th>Recipient</th>
                                    <th>Status</th>
                                    <th>Sent At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {notifications.map((n, i) => (
                                    <tr key={i}>
                                        <td style={{ textTransform: 'capitalize' }}>{n.channel}</td>
                                        <td style={{ textTransform: 'capitalize' }}>{(n.notification_type || '').replace(/_/g, ' ')}</td>
                                        <td>{n.recipient}</td>
                                        <td>
                                            <span className={`badge ${n.status === 'sent' ? 'badge-completed' : 'badge-pending'}`}>
                                                {n.status}
                                            </span>
                                        </td>
                                        <td>{n.sent_at ? new Date(n.sent_at).toLocaleString() : '\u2014'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Printable Job Ticket */}
            {showTicket && (
                <div className="job-ticket" id="job-ticket">
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                        <h2 style={{ margin: 0 }}>PopOut Studios</h2>
                        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Print Office Operations</p>
                    </div>
                    <hr style={{ border: 'none', borderTop: '2px solid #e5e7eb', margin: '16px 0' }} />
                    <h3 style={{ textAlign: 'center', marginBottom: '16px' }}>JOB TICKET</h3>
                    <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                        <tbody>
                            <tr><td style={{ padding: '8px 0', fontWeight: 600 }}>Ticket #:</td><td style={{ padding: '8px 0' }}>{job.job_id}</td></tr>
                            <tr><td style={{ padding: '8px 0', fontWeight: 600 }}>Client:</td><td style={{ padding: '8px 0' }}>{job.client_name}</td></tr>
                            <tr><td style={{ padding: '8px 0', fontWeight: 600 }}>Date:</td><td style={{ padding: '8px 0' }}>{job.created_at ? new Date(job.created_at).toLocaleDateString() : '\u2014'}</td></tr>
                            <tr><td style={{ padding: '8px 0', fontWeight: 600 }}>Job Type:</td><td style={{ padding: '8px 0', textTransform: 'capitalize' }}>{(job.job_type || '').replace(/_/g, ' ')}</td></tr>
                            {job.job_description && <tr><td style={{ padding: '8px 0', fontWeight: 600 }}>Description:</td><td style={{ padding: '8px 0' }}>{job.job_description}</td></tr>}
                            {job.total_amount !== undefined && <tr><td style={{ padding: '8px 0', fontWeight: 600 }}>Total:</td><td style={{ padding: '8px 0', fontSize: '1.125rem', fontWeight: 700 }}>{'\u20B5'}{Number(job.total_amount).toFixed(2)}</td></tr>}
                            {job.payment_status && <tr><td style={{ padding: '8px 0', fontWeight: 600 }}>Payment:</td><td style={{ padding: '8px 0' }}>{job.payment_status === 'paid' ? 'Paid' : 'Pending'}</td></tr>}
                            <tr><td style={{ padding: '8px 0', fontWeight: 600 }}>Status:</td><td style={{ padding: '8px 0' }}>{cfg.label}</td></tr>
                        </tbody>
                    </table>
                    <hr style={{ border: 'none', borderTop: '2px solid #e5e7eb', margin: '16px 0' }} />
                    <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.75rem' }}>
                        Thank you for choosing PopOut Studios
                    </p>
                    <div className="no-print" style={{ marginTop: '16px', textAlign: 'center' }}>
                        <button className="btn btn-primary" onClick={() => window.print()} style={{ gap: '6px' }}>
                            <IconPrinter size={16} /> Print Ticket
                        </button>
                    </div>
                </div>
            )}

            {/* Record Material Modal */}
            {showMaterialModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '450px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Record Material Usage</h3>
                            <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowMaterialModal(false)}>
                                <IconXCircle size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={handleDeductMaterial}>
                                <div className="form-group">
                                    <label className="form-label">Select Material</label>
                                    <select
                                        className="form-input"
                                        required
                                        value={materialForm.item_id}
                                        onChange={e => setMaterialForm(prev => ({ ...prev, item_id: e.target.value }))}
                                    >
                                        <option value="" disabled>Select an item...</option>
                                        {inventory.map(inv => (
                                            <option key={inv.item_id} value={inv.item_id}>
                                                {inv.item_name} ({inv.quantity_in_stock} {inv.unit} in stock)
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                                    <label className="form-label">Quantity Used</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        required
                                        min="0.01"
                                        step="0.01"
                                        value={materialForm.quantity}
                                        onChange={e => setMaterialForm(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                                    />
                                    <p style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                        This amount will be deducted from inventory.
                                    </p>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: 'var(--space-xl)' }}>
                                    <button type="button" className="btn btn-ghost" onClick={() => setShowMaterialModal(false)} disabled={deductLoading}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={deductLoading || !materialForm.item_id}>
                                        {deductLoading ? 'Recording...' : 'Deduct Material'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Design Review Modal */}
            {showDesignModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Send Design for Review</h3>
                            <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowDesignModal(false)}>
                                <IconXCircle size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={handleSendDesign}>
                                <div className="form-group">
                                    <label className="form-label">Upload Design Sample (Image/PDF)</label>
                                    <input
                                        type="file"
                                        className="form-input"
                                        required
                                        accept="image/*,application/pdf"
                                        onChange={e => {
                                            if (e.target.files && e.target.files[0]) {
                                                setDesignForm(prev => ({ ...prev, file: e.target.files[0] }));
                                            }
                                        }}
                                    />
                                </div>

                                <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                                    <label className="form-label">Message to Client (Optional)</label>
                                    <textarea
                                        className="form-input"
                                        rows="3"
                                        placeholder="E.g., Please review the attached design..."
                                        value={designForm.messageToClient}
                                        onChange={e => setDesignForm(prev => ({ ...prev, messageToClient: e.target.value }))}
                                    />
                                    <p style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                        This message will be included in the email sent to the client.
                                    </p>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: 'var(--space-xl)' }}>
                                    <button type="button" className="btn btn-ghost" onClick={() => setShowDesignModal(false)} disabled={sendDesignLoading}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={sendDesignLoading || !designForm.file}>
                                        {sendDesignLoading ? 'Sending...' : 'Send Review Link'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
