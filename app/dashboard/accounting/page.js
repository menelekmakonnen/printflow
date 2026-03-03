'use client';

import { useEffect, useState, useMemo } from 'react';
import { getJobs, hasAnyRole } from '@/lib/api';
import { IconScroll, IconCheckCircle, IconXCircle, IconClipboard } from '@/lib/icons';

export default function AccountingPage() {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterDate, setFilterDate] = useState('all'); // all, this_month, last_month, this_year

    useEffect(() => {
        async function loadData() {
            const res = await getJobs();
            if (res.success) {
                setJobs(res.data);
            }
            setLoading(false);
        }
        loadData();
    }, []);

    const filteredJobs = useMemo(() => {
        const now = new Date();
        return jobs.filter(job => {
            if (!job.created_at) return false;
            const jobDate = new Date(job.created_at);

            if (filterDate === 'this_month') {
                return jobDate.getMonth() === now.getMonth() && jobDate.getFullYear() === now.getFullYear();
            }
            if (filterDate === 'last_month') {
                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                return jobDate.getMonth() === lastMonth.getMonth() && jobDate.getFullYear() === lastMonth.getFullYear();
            }
            if (filterDate === 'this_year') {
                return jobDate.getFullYear() === now.getFullYear();
            }
            return true;
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }, [jobs, filterDate]);

    // Calculate Summaries
    const totalInvoiced = filteredJobs.reduce((sum, j) => sum + Number(j.total_amount || 0), 0);
    const paidJobs = filteredJobs.filter(j => j.payment_status === 'paid');
    const unpaidJobs = filteredJobs.filter(j => j.payment_status !== 'paid');
    const totalPaid = paidJobs.reduce((sum, j) => sum + Number(j.total_amount || 0), 0);
    const totalOutstanding = unpaidJobs.reduce((sum, j) => sum + Number(j.total_amount || 0), 0);

    // Approximate 5% VAT or similar (just for display in auditting)
    const estimatedTax = totalPaid * 0.05;

    if (!hasAnyRole(['admin', 'super_admin'])) {
        return <div className="loading-center">Unauthorized</div>;
    }

    if (loading) return <div className="loading-center"><div className="spinner"></div></div>;

    return (
        <div style={{ paddingBottom: 'var(--space-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Accounting & Audit</h2>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Financial summaries and transaction records</p>
                </div>
                <div>
                    <select
                        className="form-input"
                        value={filterDate}
                        onChange={e => setFilterDate(e.target.value)}
                        style={{ padding: '8px 16px', borderRadius: 'var(--radius-full)' }}
                    >
                        <option value="all">All Time</option>
                        <option value="this_month">This Month</option>
                        <option value="last_month">Last Month</option>
                        <option value="this_year">This Year</option>
                    </select>
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
                        <div style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Est. Tax (5%)</div>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>
                        {'\u20B5'}{estimatedTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        Calculated on Paid amount
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
                                <th>Amount</th>
                                <th>Payment Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredJobs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-muted)' }}>
                                        No financial records found for this period.
                                    </td>
                                </tr>
                            ) : filteredJobs.map(job => (
                                <tr key={job.job_id}>
                                    <td style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                                        {new Date(job.created_at).toLocaleDateString()}
                                    </td>
                                    <td style={{ fontWeight: 500 }}>
                                        <a href={`/dashboard/jobs/${job.job_id}`} style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>
                                            {job.job_id}
                                        </a>
                                    </td>
                                    <td>{job.client_name}</td>
                                    <td style={{ fontWeight: 600 }}>
                                        {'\u20B5'}{Number(job.total_amount || 0).toFixed(2)}
                                    </td>
                                    <td>
                                        <span className={`badge ${job.payment_status === 'paid' ? 'badge-completed' : 'badge-pending'}`}>
                                            {job.payment_status === 'paid' ? 'Paid' : 'Pending'}
                                        </span>
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
