'use client';

import { useEffect, useState, useCallback } from 'react';
import { getInventory, addInventoryItem, updateInventoryItem, deleteInventoryItem, getUser, hasAnyRole } from '@/lib/api';
import { IconPlus, IconX } from '@/lib/icons';

export default function InventoryPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUserState] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formLoading, setFormLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [filterCategory, setFilterCategory] = useState('all');

    const [form, setForm] = useState({
        item_name: '',
        category: 'Paper',
        quantity_in_stock: 0,
        unit: 'sheets',
        min_threshold: 0,
        unit_cost: 0
    });

    const CATEGORIES = ['Paper', 'Ink/Toner', 'Binding Supplies', 'Lamination', 'Packaging', 'Other'];
    const UNITS = ['sheets', 'ream', 'roll', 'cartridge', 'pack', 'box', 'pieces', 'meters'];

    const loadInventory = useCallback(async () => {
        setLoading(true);
        const res = await getInventory(filterCategory);
        if (res.success) setItems(res.data);
        setLoading(false);
    }, [filterCategory]);

    useEffect(() => {
        const u = getUser();
        setUserState(u);
        loadInventory();
    }, [loadInventory]);

    function openCreate() {
        setEditingItem(null);
        setForm({
            item_name: '',
            category: 'Paper',
            quantity_in_stock: 0,
            unit: 'sheets',
            min_threshold: 100,
            unit_cost: 0
        });
        setMessage({ type: '', text: '' });
        setShowModal(true);
    }

    function openEdit(item) {
        setEditingItem(item);
        setForm({
            item_name: item.item_name,
            category: item.category || 'Paper',
            quantity_in_stock: item.quantity_in_stock || 0,
            unit: item.unit || 'sheets',
            min_threshold: item.min_threshold || 0,
            unit_cost: item.unit_cost || 0
        });
        setMessage({ type: '', text: '' });
        setShowModal(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setFormLoading(true);
        setMessage({ type: '', text: '' });

        try {
            let res;
            if (editingItem) {
                res = await updateInventoryItem({
                    item_id: editingItem.item_id,
                    ...form
                });
            } else {
                res = await addInventoryItem(form);
            }

            if (res.success) {
                setMessage({ type: 'success', text: editingItem ? 'Item updated' : 'Item added' });
                setShowModal(false);
                await loadInventory();
            } else {
                setMessage({ type: 'error', text: res.error });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Connection failed — please try again.' });
        } finally {
            setFormLoading(false);
        }
    }

    async function handleDelete(item) {
        if (!confirm(`Are you sure you want to delete "${item.item_name}"? This cannot be undone.`)) return;

        const res = await deleteInventoryItem(item.item_id);
        if (res.success) {
            await loadInventory();
        } else {
            alert(res.error || 'Failed to delete item');
        }
    }

    if (loading) return <div className="loading-center"><div className="spinner"></div></div>;

    const canEdit = hasAnyRole(['admin', 'super_admin']);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Stock & Inventory</h2>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Manage materials and stock levels</p>
                </div>
                {canEdit && (
                    <button className="btn btn-primary" onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <IconPlus size={18} /> Add New Item
                    </button>
                )}
            </div>

            <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-sm) var(--space-md)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Category Filter:</span>
                    <select
                        className="form-input"
                        style={{ width: 'auto', padding: '6px 12px' }}
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                    >
                        <option value="all">All Categories</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Item Name</th>
                                <th>Category</th>
                                <th>Stock Level</th>
                                <th>Status</th>
                                <th>Cost ({'\u20B5'})</th>
                                {canEdit && <th>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={canEdit ? 6 : 5} style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-muted)' }}>
                                        No inventory items found.
                                    </td>
                                </tr>
                            ) : items.map(item => {
                                const isLowStock = Number(item.quantity_in_stock) <= Number(item.min_threshold);
                                return (
                                    <tr key={item.item_id}>
                                        <td style={{ fontWeight: 600 }}>{item.item_name}</td>
                                        <td>{item.category}</td>
                                        <td style={{ fontWeight: 500, color: isLowStock ? 'var(--color-danger)' : 'inherit' }}>
                                            {item.quantity_in_stock} <span style={{ opacity: 0.6, fontSize: '0.8125rem' }}>{item.unit}</span>
                                        </td>
                                        <td>
                                            {isLowStock ? (
                                                <span className="badge badge-error">Low Stock</span>
                                            ) : (
                                                <span className="badge badge-success">In Stock</span>
                                            )}
                                        </td>
                                        <td>{Number(item.unit_cost || 0).toFixed(2)}</td>
                                        {canEdit && (
                                            <td>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => openEdit(item)}>
                                                        Edit
                                                    </button>
                                                    <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--color-danger)' }} onClick={() => handleDelete(item)}>
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editingItem ? 'Edit Item' : 'Add New Item'}</h3>
                            <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowModal(false)}>
                                <IconX size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            {message.text && (
                                <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 'var(--space-md)' }}>
                                    {message.text}
                                </div>
                            )}

                            <form onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label className="form-label">Item Name</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={form.item_name}
                                        onChange={e => setForm({ ...form, item_name: e.target.value })}
                                        required
                                        placeholder="e.g. A4 Glossy Paper 150gsm"
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Category</label>
                                        <select
                                            className="form-input"
                                            value={form.category}
                                            onChange={e => setForm({ ...form, category: e.target.value })}
                                        >
                                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Unit of Measure</label>
                                        <select
                                            className="form-input"
                                            value={form.unit}
                                            onChange={e => setForm({ ...form, unit: e.target.value })}
                                        >
                                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Quantity</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={form.quantity_in_stock}
                                            onChange={e => setForm({ ...form, quantity_in_stock: Number(e.target.value) })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Low Stock AT</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={form.min_threshold}
                                            onChange={e => setForm({ ...form, min_threshold: Number(e.target.value) })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Unit Cost</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-input"
                                            value={form.unit_cost}
                                            onChange={e => setForm({ ...form, unit_cost: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: 'var(--space-xl)' }}>
                                    <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)} disabled={formLoading}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={formLoading}>
                                        {formLoading ? 'Saving...' : 'Save Item'}
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
