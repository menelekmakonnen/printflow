'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getProducts, updateProduct, getUser, hasAnyRole } from '@/lib/api';
import { IconPlus, IconX, IconCedis } from '@/lib/icons';

export default function ProductsPage() {
    const router = useRouter();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUserState] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [filterType, setFilterType] = useState('All');

    // Quote Cart State
    const [quoteItems, setQuoteItems] = useState([]);

    const loadProducts = useCallback(async () => {
        setLoading(true);
        const res = await getProducts();
        if (res.success) {
            setItems(res.data);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        const u = getUser();
        setUserState(u);
        loadProducts();
    }, [loadProducts]);

    function openEdit(item) {
        setEditingItem(item);
        setMessage({ type: '', text: '' });
        setShowModal(true);
    }

    async function handleEditSubmit(e) {
        e.preventDefault();
        setFormLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const res = await updateProduct(editingItem.item_id, {
                rate: editingItem.rate,
                description: editingItem.description
            });

            if (res.success) {
                setMessage({ type: 'success', text: 'Product updated successfully' });
                setShowModal(false);
                await loadProducts();
            } else {
                setMessage({ type: 'error', text: res.error });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Update failed. Please try again.' });
        } finally {
            setFormLoading(false);
        }
    }

    // Quote Cart Functions
    function addToQuote(item) {
        setQuoteItems(prev => {
            const existing = prev.find(q => q.item_id === item.item_id);
            if (existing) {
                return prev.map(q => q.item_id === item.item_id ? { ...q, qty: q.qty + 1 } : q);
            }
            return [...prev, { ...item, qty: 1 }];
        });
    }

    function removeQuoteItem(itemId) {
        setQuoteItems(prev => prev.filter(q => q.item_id !== itemId));
    }

    function updateQuoteQty(itemId, qty) {
        if (qty < 1) return;
        setQuoteItems(prev => prev.map(q => q.item_id === itemId ? { ...q, qty: parseInt(qty) } : q));
    }

    const quoteSubtotal = quoteItems.reduce((sum, item) => sum + (Number(item.rate) * item.qty), 0);

    function createJobFromQuote() {
        if (quoteItems.length === 0) return;

        // Save quote to localStorage specifically for the New Job page to pick up
        localStorage.setItem('printflow_draft_quote', JSON.stringify({
            items: quoteItems,
            subtotal: quoteSubtotal
        }));

        router.push('/dashboard/jobs/new');
    }

    if (loading) return <div className="loading-center"><div className="spinner"></div></div>;

    const canEdit = hasAnyRole(['admin', 'super_admin']);

    // Filter items based on selected tab
    const filteredItems = items.filter(item => {
        if (filterType === 'Products') {
            return String(item.product_type || '').toLowerCase() === 'goods';
        }
        if (filterType === 'Services') {
            return String(item.product_type || '').toLowerCase() === 'service';
        }
        return true;
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', alignItems: 'stretch' }}>
            {/* Main Products List */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
                    <div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Products & Services</h2>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Browse standard pricing and build quotes</p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: 'var(--space-md)' }}>
                    {['All', 'Products', 'Services'].map(type => (
                        <button
                            key={type}
                            className={`btn ${filterType === type ? 'btn-primary' : 'btn-secondary'}`}
                            style={{
                                padding: '6px 16px',
                                border: filterType === type ? 'none' : '1px solid var(--color-border)',
                                borderRadius: '20px',
                                fontSize: '0.875rem'
                            }}
                            onClick={() => setFilterType(type)}
                        >
                            {type}
                        </button>
                    ))}
                </div>

                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Item Name</th>
                                    <th>Product Type</th>
                                    <th>Rate</th>
                                    <th>Actions</th>
                                    {canEdit && <th>Manage</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={canEdit ? 5 : 4} style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-muted)' }}>
                                            No products found matching your filter.
                                        </td>
                                    </tr>
                                ) : filteredItems.map(item => (
                                    <tr key={item.item_id}>
                                        <td>
                                            <div style={{ fontWeight: 500 }}>{item.item_name}</div>
                                            {item.description && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {item.description}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <span className="badge" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                                                {item.product_type}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: 600 }}>
                                            {'\u20B5'} {Number(item.rate).toFixed(2)}
                                        </td>
                                        <td>
                                            <button
                                                className="btn"
                                                style={{ fontSize: '0.75rem', padding: '4px 8px', backgroundColor: 'var(--brand-primary)', color: 'white' }}
                                                onClick={() => addToQuote(item)}
                                            >
                                                + Add to Quote
                                            </button>
                                        </td>
                                        {canEdit && (
                                            <td>
                                                <button
                                                    className="btn btn-secondary"
                                                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                                    onClick={() => openEdit(item)}
                                                >
                                                    Edit
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Right Sidebar: Quote Calculator */}
            <div style={{ flex: '1 1 350px', maxWidth: '100%', position: 'sticky', top: '24px' }}>
                <div className="card" style={{ padding: 'var(--space-lg)' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--space-md)' }}>Quote Summary</h3>

                    {quoteItems.length === 0 ? (
                        <div style={{ padding: 'var(--space-xl) 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                            <p>Your quote is empty.</p>
                            <p style={{ marginTop: '4px' }}>Add items from the list to begin.</p>
                        </div>
                    ) : (
                        <div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
                                {quoteItems.map(q => (
                                    <div key={q.item_id} style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-start', paddingBottom: 'var(--space-sm)', borderBottom: '1px solid var(--color-border)' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.2 }}>{q.item_name}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                                    {'\u20B5'} {Number(q.rate).toFixed(2)} x
                                                </span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    className="form-input"
                                                    style={{ width: '60px', padding: '2px 6px', fontSize: '0.875rem', height: 'auto' }}
                                                    value={q.qty}
                                                    onChange={(e) => updateQuoteQty(q.item_id, e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                                                {'\u20B5'} {(Number(q.rate) * q.qty).toFixed(2)}
                                            </div>
                                            <button
                                                style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer', padding: '4px', marginTop: '4px', opacity: 0.7 }}
                                                onClick={() => removeQuoteItem(q.item_id)}
                                                title="Remove"
                                            >
                                                <IconX size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 'var(--space-md)', borderBottom: '1px solid var(--color-border)', marginBottom: 'var(--space-md)' }}>
                                <span style={{ fontWeight: 500 }}>Subtotal</span>
                                <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>{'\u20B5'} {quoteSubtotal.toFixed(2)}</span>
                            </div>

                            <button
                                className="btn btn-primary"
                                style={{ width: '100%', padding: '12px', fontSize: '1rem', display: 'flex', justifyContent: 'center', gap: '8px' }}
                                onClick={createJobFromQuote}
                            >
                                <IconPlus size={20} /> Convert to New Job
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Modal (Admin only) */}
            {showModal && editingItem && canEdit && (
                <div className="modal-overlay">
                    <div className="modal modal-content">
                        <div className="modal-header">
                            <h2>Edit Product</h2>
                            <button className="btn-icon" onClick={() => setShowModal(false)}><IconX size={20} /></button>
                        </div>
                        <div className="modal-body">
                            {message.text && (
                                <div className={`alert alert-${message.type}`} style={{ marginBottom: 'var(--space-md)' }}>
                                    {message.text}
                                </div>
                            )}
                            <form onSubmit={handleEditSubmit}>
                                <div className="form-group">
                                    <label>Item Name</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={editingItem.item_name}
                                        disabled
                                        style={{ backgroundColor: 'var(--color-surface)', cursor: 'not-allowed' }}
                                    />
                                    <small className="form-hint">Item names are locked to match backend data configurations.</small>
                                </div>
                                <div className="form-group">
                                    <label>Rate (GHS)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        required
                                        className="form-input"
                                        value={editingItem.rate}
                                        onChange={(e) => setEditingItem({ ...editingItem, rate: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Description</label>
                                    <textarea
                                        className="form-input"
                                        rows="3"
                                        value={editingItem.description}
                                        onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                                    />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)', marginTop: 'var(--space-lg)' }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={formLoading}>
                                        {formLoading ? 'Saving...' : 'Save Changes'}
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
