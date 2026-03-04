'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getProducts, updateProduct, addProduct, getUser, hasAnyRole } from '@/lib/api';
import { IconPlus, IconX, IconCedis } from '@/lib/icons';

export default function ProductsPage() {
    const router = useRouter();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUserState] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [filterType, setFilterType] = useState('All');
    const [editingItem, setEditingItem] = useState(null);
    const [formLoading, setFormLoading] = useState(false);

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

    function openCreate() {
        setEditingItem({
            isNew: true,
            item_id: 'new',
            item_name: '',
            rate: '',
            description: '',
            product_type: 'Goods',
            status: 'Active'
        });
        setMessage({ type: '', text: '' });
        setShowModal(true);
    }

    async function handleEditSubmit(e) {
        e.preventDefault();
        setFormLoading(true);
        setMessage({ type: '', text: '' });

        try {
            let res;
            if (editingItem.isNew) {
                if (!editingItem.item_name || !editingItem.rate) {
                    setMessage({ type: 'error', text: 'Name and Rate are required.' });
                    setFormLoading(false);
                    return;
                }
                res = await addProduct({
                    item_name: editingItem.item_name,
                    rate: Number(editingItem.rate),
                    description: editingItem.description || '',
                    product_type: editingItem.product_type,
                    status: editingItem.status
                });
            } else {
                res = await updateProduct(editingItem.item_id, {
                    item_name: editingItem.item_name,
                    rate: Number(editingItem.rate),
                    description: editingItem.description || '',
                    product_type: editingItem.product_type,
                    status: editingItem.status
                });
            }

            if (res.success) {
                setMessage({ type: 'success', text: editingItem.isNew ? 'Product created successfully' : 'Product updated successfully' });
                setShowModal(false);
                await loadProducts();
            } else {
                setMessage({ type: 'error', text: res.error || 'Failed to save product' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Network failure. Please try again.' });
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

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', alignItems: 'stretch' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ width: '180px', height: '28px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)', animation: 'pulse 1.5s infinite' }} />
                            <div style={{ width: '250px', height: '16px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)', animation: 'pulse 1.5s infinite' }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: 'var(--space-md)', opacity: 0.6, animation: 'pulse 1.5s infinite' }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} style={{ width: '80px', height: '32px', background: 'var(--color-bg-secondary)', borderRadius: '20px' }} />
                        ))}
                    </div>

                    <div className="product-grid">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="job-card" style={{ opacity: 0.7, animation: 'pulse 1.5s infinite', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '120px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ width: '120px', height: '20px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }} />
                                    <div style={{ width: '40px', height: '20px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }} />
                                </div>
                                <div style={{ width: '100%', height: '14px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }} />
                                <div style={{ width: '80%', height: '14px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }} />
                                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ width: '70px', height: '24px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }} />
                                    <div style={{ width: '100px', height: '32px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

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
                    {canEdit && (
                        <button className="btn btn-primary" onClick={openCreate} style={{ gap: '6px' }}>
                            <IconPlus size={16} /> Add Product
                        </button>
                    )}
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
                                ) : filteredItems.map(item => {
                                    const isActive = (item.status || 'Active') !== 'Inactive';
                                    return (
                                        <tr key={item.item_id} style={{ opacity: isActive ? 1 : 0.5 }}>
                                            <td>
                                                <div style={{ fontWeight: 500 }}>{item.item_name}</div>
                                                {item.description && (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {item.description}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <span className="badge" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                                                        {item.product_type}
                                                    </span>
                                                    {!isActive && (
                                                        <span className="badge badge-pending" style={{ fontSize: '0.65rem' }}>Inactive</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ fontWeight: 600 }}>
                                                {'\u20B5'} {Number(item.rate).toFixed(2)}
                                            </td>
                                            <td>
                                                <button
                                                    className="btn"
                                                    style={{ fontSize: '0.75rem', padding: '4px 8px', backgroundColor: isActive ? 'var(--brand-primary)' : 'var(--color-bg-secondary)', color: isActive ? 'white' : 'var(--color-text-muted)', cursor: isActive ? 'pointer' : 'not-allowed' }}
                                                    onClick={() => isActive && addToQuote(item)}
                                                    disabled={!isActive}
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
                                    );
                                })}
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
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2>{editingItem.isNew ? 'New Product/Service' : 'Edit Item'}</h2>
                            <button className="btn-icon" onClick={() => setShowModal(false)}><IconX size={20} /></button>
                        </div>
                        <div className="modal-body">
                            {message.text && (
                                <div className={`alert alert-${message.type}`} style={{ marginBottom: 'var(--space-md)' }}>
                                    {message.text}
                                </div>
                            )}
                            <form onSubmit={handleEditSubmit}>
                                {editingItem.isNew ? (
                                    <>
                                        <div className="form-group">
                                            <label>Item Name</label>
                                            <input
                                                type="text"
                                                required
                                                className="form-input"
                                                value={editingItem.item_name}
                                                onChange={(e) => setEditingItem({ ...editingItem, item_name: e.target.value })}
                                                placeholder="e.g. A4 Flyers"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Item Type</label>
                                            <select
                                                className="form-input"
                                                value={editingItem.product_type}
                                                onChange={(e) => setEditingItem({ ...editingItem, product_type: e.target.value })}
                                            >
                                                <option value="Goods">Product (Goods)</option>
                                                <option value="Service">Service</option>
                                            </select>
                                        </div>
                                    </>
                                ) : (
                                    <div className="form-group">
                                        <label>Item Name</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={editingItem.item_name}
                                            disabled
                                            style={{ backgroundColor: 'var(--color-surface)', cursor: 'not-allowed' }}
                                        />
                                        <small className="form-hint">Item identity cannot be mutated after creation.</small>
                                    </div>
                                )}

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
                                        placeholder="Optional details..."
                                    />
                                </div>

                                {!editingItem.isNew && (
                                    <div className="form-group">
                                        <label>Status</label>
                                        <select
                                            className="form-input"
                                            value={editingItem.status || 'Active'}
                                            onChange={(e) => setEditingItem({ ...editingItem, status: e.target.value })}
                                        >
                                            <option value="Active">Active</option>
                                            <option value="Inactive">Inactive (Disabled)</option>
                                        </select>
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)', marginTop: 'var(--space-xl)' }}>
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
