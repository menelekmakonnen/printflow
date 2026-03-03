'use client';

import { useEffect, useState, useMemo } from 'react';
import { getJobs, hasAnyRole } from '@/lib/api';
import { IconScroll, IconCheckCircle, IconXCircle, IconClipboard } from '@/lib/icons';

export default function AccountingPage() {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterDate, setFilterDate] = useState('month'); // day, week, month, custom
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    useEffect(() => {
        async function loadData() {
            const res = await getJobs();
            if (res.success) {
                setJobs(res.data);
            }
            setLoading(false);
        }
        loadData();

        // Default custom to today
        const today = new Date().toISOString().split('T')[0];
        setCustomStart(today);
        setCustomEnd(today);
    }, []);

    const filteredJobs = useMemo(() => {
        const now = new Date();
        now.setHours(23, 59, 59, 999);

        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);

        return jobs.filter(job => {
            if (!job.created_at) return false;
            const jobDate = new Date(job.created_at);

            if (filterDate === 'day') {
                return jobDate >= startOfDay && jobDate <= now;
            }
            if (filterDate === 'week') {
                const startOfWeek = new Date(startOfDay);
                startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday
                return jobDate >= startOfWeek && jobDate <= now;
            }
            if (filterDate === 'month') {
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                return jobDate >= startOfMonth && jobDate <= now;
            }
            if (filterDate === 'custom') {
                if (!customStart) return true;
                const s = new Date(customStart);
                s.setHours(0, 0, 0, 0);
                const e = customEnd ? new Date(customEnd) : new Date();
                e.setHours(23, 59, 59, 999);
                return jobDate >= s && jobDate <= e;
            }
            return true;
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }, [jobs, filterDate, customStart, customEnd]);

    // Calculate Summaries
    const totalInvoiced = filteredJobs.reduce((sum, j) => sum + Number(j.total_amount || 0), 0);
    const paidJobs = filteredJobs.filter(j => j.payment_status === 'paid');
    const unpaidJobs = filteredJobs.filter(j => j.payment_status !== 'paid');
    const totalPaid = paidJobs.reduce((sum, j) => sum + Number(j.total_amount || 0), 0);
    const totalOutstanding = unpaidJobs.reduce((sum, j) => sum + Number(j.total_amount || 0), 0);

    // Extract precise tax from Job Description if available, else fallback to 0
    let totalTaxExact = 0;
    paidJobs.forEach(j => {
        if (j.job_description) {
            const taxMatch = j.job_description.match(/Est\. Tax.*?:\s*\u20B5([\d.]+)/);
            if (taxMatch && taxMatch[1]) {
                totalTaxExact += parseFloat(taxMatch[1]);
            }
        }
    });

    if (!hasAnyRole(['admin', 'super_admin'])) {
        return <div className="loading-center">Unauthorized</div>;
    }

    if (loading) return <div className="loading-center"><div className="spinner"></div></div>;

    return (
        <div style={{ paddingBottom: 'var(--space-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xl)', flexWrap: 'wrap', gap: 'var(--space-lg)' }}>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Accounting & Audit</h2>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Financial summaries and transaction records</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>Range:</span>
                        <select
                            className="form-input"
                            value={filterDate}
                            onChange={e => setFilterDate(e.target.value)}
                            style={{ padding: '8px 16px', borderRadius: 'var(--radius-full)', width: 'auto' }}
                        >
                            <option value="day">Today</option>
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                            <option value="custom">Custom Range</option>
                        </select>
                    </div>

                    {filterDate === 'custom' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-bg-secondary)', padding: '4px 12px', borderRadius: 'var(--radius-full)' }}>
                            <input
                                type="date"
                                className="form-input"
                                style={{ padding: '4px 8px', height: 'auto', border: 'none', background: 'transparent' }}
                                value={customStart}
                                onChange={e => setCustomStart(e.target.value)}
                            />
                            <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                            <input
                                type="date"
                                className="form-input"
                                style={{ padding: '4px 8px', height: 'auto', border: 'none', background: 'transparent' }}
                                value={customEnd}
                                onChange={e => setCustomEnd(e.target.value)}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
                <div className="card" style={{ padding: 'var(--space-lg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'var(--color-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>
                            <IconScroll size={20} />
                        </div>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Gross Revenue</div>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>
                        {'\u20B5'}{totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        Total invoiced ({filteredJobs.length} jobs)
                    </div>
                </div>

                <div className="card" style={{ padding: 'var(--space-lg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-completed)' }}>
                            <IconCheckCircle size={20} />
                        </div>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Total Paid</div>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-completed)' }}>
                        {'\u20B5'}{totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        From {paidJobs.length} collected jobs
                    </div>
                </div>

                <div className="card" style={{ padding: 'var(--space-lg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-error)' }}>
                            <IconXCircle size={20} />
                        </div>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Outstanding</div>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-error)' }}>
                        {'\u20B5'}{totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        Pending from {unpaidJobs.length} jobs
                    </div>
                </div>

                <div className="card" style={{ padding: 'var(--space-lg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'var(--color-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                            <IconClipboard size={20} />
                        </div>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Tax Collected</div>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>
                        {'\u20B5'}{totalTaxExact.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        Extracted from Paid job data
                    </div>
                </div>
            </div>

            {/* Financial Ledger */}
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 'var(--space-md)' }}>Financial Ledger</h3>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Job ID</th>
                                <th>Client</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Payment</th>
                                <th style={{ textAlign: 'right' }}>Amount ({'\u20B5'})</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredJobs.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-muted)' }}>
                                        No jobs found for this period.
                                    </td>
                                </tr>
                            ) : filteredJobs.map(job => (
                                <tr key={job.job_id}>
                                    <td>{new Date(job.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <div style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                                            {job.job_id}
                                        </div>
                                    </td>
                                    <td style={{ fontWeight: 500 }}>{job.client_name}</td>
                                    <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {job.job_type}
                                    </td>
                                    <td>
                                        <span className={`badge badge-${job.status}`}>
                                            {job.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`badge ${job.payment_status === 'paid' ? 'badge-completed' : 'badge-pending'}`}>
                                            {job.payment_status}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                        {Number(job.total_amount).toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
