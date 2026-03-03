'use client';

import { useState, useEffect } from 'react';
import { getExpenses, addExpense, updateExpense, deleteExpense, getConfig, getUser } from '@/lib/api';
import { IconPlus, IconClipboard, IconEdit, IconTrash } from '@/lib/icons';

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [user, setUser] = useState(() => typeof window !== 'undefined' ? getUser() : null);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
    const [modalError, setModalError] = useState('');
    const [saving, setSaving] = useState(false);

    // Form state
    const [form, setForm] = useState({
        expense_id: '',
        category: '',
        amount: '',
        description: '',
        payment_status: 'paid',
        payment_date: '',
        edit_memo: ''
    });

    // Move loadData above useEffect to fix hoisting lint
    async function loadData() {
        setLoading(true);
        try {
            const [confRes, expRes] = await Promise.all([getConfig(), getExpenses('all')]);
            if (confRes.success) {
                setCategories(confRes.data.expense_categories || []);
            }
            if (expRes.success) {
                setExpenses(expRes.data);
            } else {
                setError(expRes.error || 'Failed to load expenses');
            }
        } catch (e) {
            setError('Connection error loading expenses');
        }
        setLoading(false);
    }

    useEffect(() => {
        loadData();
    }, []);

    function openAddModal() {
        setForm({
            expense_id: '', category: categories[0] || '', amount: '', description: '',
            payment_status: 'paid', payment_date: new Date().toISOString().split('T')[0], edit_memo: ''
        });
        setModalMode('add');
        setModalError('');
        setIsModalOpen(true);
    }

    function openEditModal(expense) {
        setForm({
            expense_id: expense.expense_id,
            category: expense.category,
            amount: expense.amount,
            description: expense.description,
            payment_status: expense.payment_status,
            payment_date: expense.payment_date ? new Date(expense.payment_date).toISOString().split('T')[0] : '',
            edit_memo: ''
        });
        setModalMode('edit');
        setModalError('');
        setIsModalOpen(true);
    }

    async function handleSave(e) {
        e.preventDefault();
        setModalError('');

        if (!form.category || !form.amount) {
            setModalError('Category and amount are required');
            return;
        }

        if (modalMode === 'edit' && !form.edit_memo.trim()) {
            setModalError('Edit memo is required to document changes');
            return;
        }

        setSaving(true);
        let res;

        const payload = { ...form };
        if (modalMode === 'add') {
            res = await addExpense(payload);
        } else {
            res = await updateExpense(form.expense_id, payload, form.edit_memo);
        }

        if (res.success) {
            setIsModalOpen(false);
            loadData();
        } else {
            setModalError(res.error || 'Failed to save expense');
        }
        setSaving(false);
    }

    async function handleDelete(id) {
        const memo = prompt("Enter a memo documenting why you are deleting this expense:");
        if (!memo) return;

        if (confirm('Permanently delete this expense record?')) {
            const res = await deleteExpense(id, memo);
            if (res.success) {
                loadData();
            } else {
                alert(res.error || 'Failed to delete expense');
            }
        }
    }

    if (loading) return <div className="loading-center"><div className="spinner"></div></div>;

    const totalPaid = expenses.filter(e => e.payment_status === 'paid').reduce((sum, e) => sum + Number(e.amount), 0);
    const totalPending = expenses.filter(e => e.payment_status === 'pending').reduce((sum, e) => sum + Number(e.amount), 0);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
                <h1 className="page-title"><IconClipboard size={28} /> Expenses Tracking</h1>
                <button className="btn btn-primary" onClick={openAddModal} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IconPlus size={18} /> Log New Expense
                </button>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
                <div className="card stat-card">
                    <div className="stat-value" style={{ color: 'var(--color-text-primary)' }}>{expenses.length}</div>
                    <div className="stat-label">Total Entries</div>
                </div>
                <div className="card stat-card">
                    <div className="stat-value" style={{ color: 'var(--color-danger)' }}>{'\u20B5'}{totalPaid.toFixed(2)}</div>
                    <div className="stat-label">Total Outgoings (Paid)</div>
                </div>
                <div className="card stat-card">
                    <div className="stat-value" style={{ color: 'var(--color-warning)' }}>{'\u20B5'}{totalPending.toFixed(2)}</div>
                    <div className="stat-label">Pending Payments</div>
                </div>
            </div>

            <div className="card">
                <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Category</th>
                                <th>Description</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Logged By</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expenses.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-xl)' }}>
                                        No expenses recorded yet.
                                    </td>
                                </tr>
                            ) : (
                                expenses.map(e => (
                                    <tr key={e.expense_id}>
                                        <td>{new Date(e.date_logged).toLocaleDateString()}</td>
                                        <td><span className="badge badge-secondary">{e.category}</span></td>
                                        <td style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={e.description}>
                                            {e.description || '-'}
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{'\u20B5'}{Number(e.amount).toFixed(2)}</td>
                                        <td>
                                            <span className={`badge ${e.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                                                {e.payment_status}
                                            </span>
                                        </td>
                                        <td>{e.logged_by}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button className="btn btn-ghost" onClick={() => openEditModal(e)} style={{ padding: '4px 8px', minWidth: 'auto', marginRight: '4px' }}>
                                                <IconEdit size={16} />
                                            </button>
                                            {user?.roles?.includes('super_admin') && (
                                                <button className="btn btn-ghost" onClick={() => handleDelete(e.expense_id)} style={{ padding: '4px 8px', minWidth: 'auto', color: 'var(--color-danger)' }}>
                                                    <IconTrash size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Configurable Modal */}
            {isModalOpen && (
                <div className="modal-overlay" onClick={() => !saving && setIsModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2>{modalMode === 'add' ? 'Log New Expense' : 'Edit Expense'}</h2>
                        </div>
                        <div className="modal-body">
                            {modalError && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{modalError}</div>}
                            <form onSubmit={handleSave} id="expenseForm" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                                <div className="form-group">
                                    <label className="form-label">Category *</label>
                                    <select className="form-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} required>
                                        <option value="">Select Category...</option>
                                        {categories.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Amount ({'\u20B5'}) *</label>
                                    <input type="number" step="0.01" min="0" className="form-input" required
                                        value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Description</label>
                                    <input type="text" className="form-input" placeholder="What was this for?"
                                        value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Status</label>
                                        <select className="form-input" value={form.payment_status} onChange={e => setForm({ ...form, payment_status: e.target.value })}>
                                            <option value="paid">Paid</option>
                                            <option value="pending">Pending</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Payment Date</label>
                                        <input type="date" className="form-input"
                                            value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })} />
                                    </div>
                                </div>

                                {modalMode === 'edit' && (
                                    <div className="form-group" style={{ marginTop: '8px' }}>
                                        <label className="form-label" style={{ color: 'var(--color-danger)' }}>Edit Memo (Required) *</label>
                                        <input type="text" className="form-input" required placeholder="Reason for editing this record..."
                                            value={form.edit_memo} onChange={e => setForm({ ...form, edit_memo: e.target.value })} />
                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>This memo will be added to the audit trail.</p>
                                    </div>
                                )}
                            </form>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setIsModalOpen(false)} disabled={saving}>Cancel</button>
                            <button form="expenseForm" type="submit" className="btn btn-primary" disabled={saving}>
                                {saving ? 'Saving...' : 'Save Expense'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
