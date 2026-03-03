'use client';

import { useEffect, useState, useMemo } from 'react';
import { getJobs, getExpenses, hasAnyRole } from '@/lib/api';
import { IconScroll, IconCheckCircle, IconXCircle, IconClipboard, IconDownload, IconMinus } from '@/lib/icons';

export default function AccountingPage() {
    const [jobs, setJobs] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterDate, setFilterDate] = useState('month'); // day, week, month, quarter, year, custom

    // Lazy initialize to avoid useEffect cascaded renders
    const [customStart, setCustomStart] = useState(() => {
        if (typeof window !== 'undefined') {
            return new Date().toISOString().split('T')[0];
        }
        return '';
    });
    const [customEnd, setCustomEnd] = useState(() => {
        if (typeof window !== 'undefined') {
            return new Date().toISOString().split('T')[0];
        }
        return '';
    });

    useEffect(() => {
        async function loadData() {
            const [jobsRes, expRes] = await Promise.all([getJobs(), getExpenses('all')]);
            if (jobsRes.success) setJobs(jobsRes.data);
            if (expRes.success) setExpenses(expRes.data);
            setLoading(false);
        }
        loadData();
    }, []);

    const filteredJobs = useMemo(() => {
        const _now = new Date();
        const now = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate(), 23, 59, 59, 999);
        const startOfDay = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate(), 0, 0, 0, 0);

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
            if (filterDate === 'quarter') {
                const quarter = Math.floor(now.getMonth() / 3);
                const startOfQuarter = new Date(now.getFullYear(), quarter * 3, 1);
                return jobDate >= startOfQuarter && jobDate <= now;
            }
            if (filterDate === 'year') {
                const startOfYear = new Date(now.getFullYear(), 0, 1);
                return jobDate >= startOfYear && jobDate <= now;
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

    const filteredExpenses = useMemo(() => {
        const _now = new Date();
        const now = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate(), 23, 59, 59, 999);
        const startOfDay = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate(), 0, 0, 0, 0);

        return expenses.filter(exp => {
            if (!exp.date_logged) return false;
            const expDate = new Date(exp.date_logged);

            if (filterDate === 'day') return expDate >= startOfDay && expDate <= now;
            if (filterDate === 'week') {
                const dt = new Date(startOfDay);
                dt.setDate(dt.getDate() - dt.getDay());
                return expDate >= dt && expDate <= now;
            }
            if (filterDate === 'month') return expDate >= new Date(now.getFullYear(), now.getMonth(), 1) && expDate <= now;
            if (filterDate === 'quarter') return expDate >= new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1) && expDate <= now;
            if (filterDate === 'year') return expDate >= new Date(now.getFullYear(), 0, 1) && expDate <= now;
            if (filterDate === 'custom') {
                if (!customStart) return true;
                const s = new Date(customStart); s.setHours(0, 0, 0, 0);
                const e = customEnd ? new Date(customEnd) : new Date(); e.setHours(23, 59, 59, 999);
                return expDate >= s && expDate <= e;
            }
            return true;
        });
    }, [expenses, filterDate, customStart, customEnd]);

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

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    function exportToCsv() {
        if (filteredJobs.length === 0) return alert('No data to export.');
        const headers = ['Date', 'Job ID', 'Client', 'Type', 'Status', 'Payment', 'Amount'];
        const csvRows = [headers.join(',')];
        filteredJobs.forEach(job => {
            const row = [
                new Date(job.created_at).toLocaleDateString(),
                job.job_id,
                `"${(job.client_name || '').replace(/"/g, '""')}"`,
                `"${(job.job_type || '').replace(/"/g, '""')}"`,
                job.status,
                job.payment_status,
                job.total_amount
            ];
            csvRows.push(row.join(','));
        });
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PrintFlow_Accounting_${filterDate}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

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
                            <option value="quarter">This Quarter</option>
                            <option value="year">This Year</option>
                            <option value="custom">Custom Range</option>
                        </select>
                        <button className="btn btn-secondary" onClick={exportToCsv} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <IconDownload size={16} /> Export
                        </button>
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

                <div className="card" style={{ padding: 'var(--space-lg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'var(--color-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                            <IconMinus size={20} />
                        </div>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Expenses</div>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>
                        {'\u20B5'}{totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        From {filteredExpenses.length} expense entries
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
