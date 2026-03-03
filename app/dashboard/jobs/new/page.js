'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createJob, uploadFile } from '@/lib/api';
import { getProductsByCategory, getProductById } from '@/lib/products';
import { IconArrowLeft, IconPlus, IconMinus, IconX, IconPlusCircle, IconTrash } from '@/lib/icons';

export default function NewJobPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        client_name: '',
        client_email: '',
        client_phone: '',
        job_description: '',
        requires_design: false
    });
    const [files, setFiles] = useState([]);

    // Line items: { productId, name, rate, quantity, unit }
    const [lineItems, setLineItems] = useState([]);
    const [showProductPicker, setShowProductPicker] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const productGroups = getProductsByCategory();
    const total = lineItems.reduce((sum, item) => sum + (item.rate * item.quantity), 0);

    function addProduct(product) {
        // Check if already added
        const existing = lineItems.findIndex(li => li.productId === product.id);
        if (existing >= 0) {
            const updated = [...lineItems];
            updated[existing].quantity += 1;
            setLineItems(updated);
        } else {
            setLineItems([...lineItems, {
                productId: product.id,
                name: product.name,
                rate: product.rate,
                quantity: 1,
                unit: product.unit || 'pcs',
                description: product.description
            }]);
        }
        setShowProductPicker(false);
        setSearchTerm('');
    }

    function updateQuantity(index, delta) {
        const updated = [...lineItems];
        updated[index].quantity = Math.max(1, updated[index].quantity + delta);
        setLineItems(updated);
    }

    function setQuantity(index, value) {
        const updated = [...lineItems];
        updated[index].quantity = Math.max(1, parseInt(value) || 1);
        setLineItems(updated);
    }

    function handleFileChange(e) {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setFiles(prev => [...prev, ...newFiles]);
        }
    }

    function removeFile(index) {
        setFiles(files.filter((_, i) => i !== index));
    }

    function removeItem(index) {
        setLineItems(lineItems.filter((_, i) => i !== index));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!form.client_name.trim()) { setError('Client name is required'); return; }
        if (lineItems.length === 0) { setError('Add at least one product/service'); return; }
        if (form.requires_design && !form.job_description.trim()) {
            setError('Additional Notes are required when requesting Design Services');
            return;
        }

        setError('');
        setLoading(true);

        // Build the job payload
        const jobType = lineItems.map(li => li.name).join(', ');
        const description = lineItems.map(li =>
            `${li.quantity}x ${li.name} @ \u20B5${li.rate.toFixed(2)} = \u20B5${(li.rate * li.quantity).toFixed(2)}`
        ).join('\n') + (form.job_description ? '\n\nNotes: ' + form.job_description : '');

        const payload = {
            client_name: form.client_name,
            client_email: form.client_email,
            client_phone: form.client_phone,
            job_type: jobType.length > 100 ? jobType.substring(0, 97) + '...' : jobType,
            job_description: description,
            total_amount: total,
            requires_design: form.requires_design
        };

        try {
            // Pre-process files
            const base64Files = await Promise.all(files.map(file => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve({
                        name: file.name,
                        type: file.type || 'application/octet-stream',
                        base64: reader.result.split(',')[1] // Get base64 string
                    });
                    reader.onerror = error => reject(error);
                    reader.readAsDataURL(file);
                });
            }));

            const res = await createJob(payload);
            if (res.success) {
                // Upload files if any
                for (const fileData of base64Files) {
                    try {
                        await uploadFile(res.data.job_id, fileData.name, fileData.type, fileData.base64);
                    } catch (uploadErr) {
                        console.error('File upload failed:', uploadErr);
                    }
                }
                router.push(`/dashboard/jobs/${res.data.job_id}`);
            } else {
                setError(res.error || 'Failed to create job');
            }
        } catch (err) {
            setError('Connection error \u2014 please try again');
        } finally {
            setLoading(false);
        }
    }

    // Filter products by search
    const filteredGroups = {};
    if (searchTerm) {
        const s = searchTerm.toLowerCase();
        Object.entries(productGroups).forEach(([cat, products]) => {
            const filtered = products.filter(p =>
                p.name.toLowerCase().includes(s) || p.description.toLowerCase().includes(s)
            );
            if (filtered.length > 0) filteredGroups[cat] = filtered;
        });
    }
    const displayGroups = searchTerm ? filteredGroups : productGroups;

    return (
        <div>
            <button
                className="btn btn-ghost"
                onClick={() => router.back()}
                style={{ marginBottom: 'var(--space-lg)', gap: '6px' }}
            >
                <IconArrowLeft size={16} /> Back
            </button>

            <div className="card" style={{ maxWidth: '720px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-lg)' }}>
                    Create New Job
                </h2>

                {error && <div className="alert alert-error">{error}</div>}

                <form onSubmit={handleSubmit}>

                    {/* CLIENT INFO */}
                    <div style={{ marginBottom: 'var(--space-xl)' }}>
                        <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>Client Information</h3>
                        <div className="form-group">
                            <label className="form-label" htmlFor="client_name">Client Name *</label>
                            <input id="client_name" type="text" className="form-input" required
                                value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                                placeholder="e.g. John Mensah" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                            <div className="form-group">
                                <label className="form-label" htmlFor="client_email">Email</label>
                                <input id="client_email" type="email" className="form-input"
                                    value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))}
                                    placeholder="email@example.com" />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="client_phone">Phone</label>
                                <input id="client_phone" type="tel" className="form-input"
                                    value={form.client_phone} onChange={e => setForm(f => ({ ...f, client_phone: e.target.value }))}
                                    placeholder="024 XXX XXXX" />
                            </div>
                        </div>
                    </div>

                    {/* LINE ITEMS */}
                    <div style={{ marginBottom: 'var(--space-xl)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                            <h3 className="card-title">Products / Services</h3>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => setShowProductPicker(true)}
                                style={{ gap: '4px', fontSize: '0.8125rem' }}
                            >
                                <IconPlusCircle size={16} /> Add Item
                            </button>
                        </div>

                        {lineItems.length === 0 ? (
                            <div style={{
                                border: '2px dashed var(--color-border)',
                                borderRadius: 'var(--radius-lg)',
                                padding: 'var(--space-xl)',
                                textAlign: 'center',
                                color: 'var(--color-text-muted)'
                            }}>
                                <p style={{ marginBottom: 'var(--space-sm)' }}>No items added yet</p>
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={() => setShowProductPicker(true)}
                                    style={{ gap: '4px' }}
                                >
                                    <IconPlusCircle size={16} /> Browse Products
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                {lineItems.map((item, i) => (
                                    <div key={item.productId} style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr auto auto auto',
                                        gap: 'var(--space-md)',
                                        alignItems: 'center',
                                        padding: 'var(--space-md)',
                                        background: 'var(--color-bg-secondary)',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--color-border)'
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.name}</div>
                                            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                                                {'\u20B5'}{item.rate.toFixed(2)} / {item.unit}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <button type="button" className="btn btn-ghost" onClick={() => updateQuantity(i, -1)}
                                                style={{ padding: '4px 8px', minWidth: 'auto' }}>
                                                <IconMinus size={14} />
                                            </button>
                                            <input type="number" value={item.quantity} min="1"
                                                onChange={e => setQuantity(i, e.target.value)}
                                                style={{
                                                    width: '52px', textAlign: 'center', padding: '4px',
                                                    background: 'var(--color-bg-input)', border: '1px solid var(--color-border)',
                                                    borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)',
                                                    fontFamily: 'inherit', fontSize: '0.875rem'
                                                }}
                                            />
                                            <button type="button" className="btn btn-ghost" onClick={() => updateQuantity(i, 1)}
                                                style={{ padding: '4px 8px', minWidth: 'auto' }}>
                                                <IconPlus size={14} />
                                            </button>
                                        </div>

                                        <div style={{ fontWeight: 700, fontSize: '0.9375rem', whiteSpace: 'nowrap', minWidth: '80px', textAlign: 'right' }}>
                                            {'\u20B5'}{(item.rate * item.quantity).toFixed(2)}
                                        </div>

                                        <button type="button" onClick={() => removeItem(i)}
                                            style={{
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                color: 'var(--color-pending)', padding: '4px', display: 'flex'
                                            }}>
                                            <IconTrash size={16} />
                                        </button>
                                    </div>
                                ))}

                                {/* Total */}
                                <div style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: 'var(--space-md) var(--space-lg)',
                                    background: 'var(--color-accent)', borderRadius: 'var(--radius-md)',
                                    color: '#fff', fontWeight: 700
                                }}>
                                    <span>Total ({lineItems.length} item{lineItems.length !== 1 ? 's' : ''})</span>
                                    <span style={{ fontSize: '1.25rem' }}>{'\u20B5'}{total.toFixed(2)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* DESIGN & FILES */}
                    <div style={{ marginBottom: 'var(--space-xl)', padding: 'var(--space-md)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
                            <div>
                                <h3 className="card-title" style={{ margin: 0 }}>Design Services</h3>
                                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>Does this job require design work?</p>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={form.requires_design}
                                    onChange={e => setForm(f => ({ ...f, requires_design: e.target.checked }))}
                                    style={{ width: '20px', height: '20px', marginRight: '8px', cursor: 'pointer' }}
                                />
                                <span style={{ fontWeight: 600 }}>Yes, requires design</span>
                            </label>
                        </div>

                        {!form.requires_design && (
                            <div style={{ marginTop: 'var(--space-md)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-md)' }}>
                                <h4 style={{ fontSize: '0.9rem', marginBottom: '8px' }}>Client Files</h4>
                                <input
                                    type="file"
                                    multiple
                                    onChange={handleFileChange}
                                    style={{ marginBottom: '8px', display: 'block' }}
                                />
                                {files.length > 0 && (
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem' }}>
                                        {files.map((file, i) => (
                                            <li key={i} style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--color-bg-card)', padding: '6px 12px', marginBottom: '4px', borderRadius: '4px' }}>
                                                <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                                                <button type="button" onClick={() => removeFile(i)} style={{ background: 'none', border: 'none', color: 'var(--color-pending)', cursor: 'pointer' }}>
                                                    <IconX size={14} />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>

                    {/* NOTES */}
                    <div className="form-group">
                        <label className="form-label" htmlFor="notes">
                            Additional Notes {form.requires_design && <span style={{ color: 'var(--color-pending)', fontWeight: 'normal' }}>(Required for Design Services)</span>}
                        </label>
                        <textarea id="notes" className="form-input" rows={3}
                            required={form.requires_design}
                            value={form.job_description} onChange={e => setForm(f => ({ ...f, job_description: e.target.value }))}
                            placeholder="Special instructions, delivery details, etc." />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-full"
                        disabled={loading || !form.client_name || lineItems.length === 0}
                        style={{ padding: '14px', fontSize: '1rem', marginTop: 'var(--space-md)' }}
                    >
                        {loading ? 'Creating Job...' : `Create Job \u2014 \u20B5${total.toFixed(2)}`}
                    </button>
                </form>
            </div>

            {/* PRODUCT PICKER MODAL */}
            {showProductPicker && (
                <div className="modal-overlay" onClick={() => { setShowProductPicker(false); setSearchTerm(''); }}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Select Product / Service</h3>
                            <button className="modal-close" onClick={() => { setShowProductPicker(false); setSearchTerm(''); }}>
                                <IconX size={18} />
                            </button>
                        </div>

                        <div style={{ padding: '0 var(--space-lg)', marginBottom: 'var(--space-md)' }}>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Search products..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div style={{ overflowY: 'auto', flex: 1, padding: '0 var(--space-lg) var(--space-lg)' }}>
                            {Object.entries(displayGroups).map(([category, products]) => (
                                <div key={category} style={{ marginBottom: 'var(--space-lg)' }}>
                                    <div style={{
                                        fontSize: '0.6875rem', fontWeight: 700,
                                        color: 'var(--color-text-muted)', textTransform: 'uppercase',
                                        letterSpacing: '0.08em', marginBottom: 'var(--space-sm)',
                                        padding: '0 var(--space-xs)'
                                    }}>
                                        {category}
                                    </div>
                                    {products.map(product => {
                                        const alreadyAdded = lineItems.some(li => li.productId === product.id);
                                        return (
                                            <button
                                                key={product.id}
                                                type="button"
                                                onClick={() => addProduct(product)}
                                                style={{
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    width: '100%', padding: '10px 12px',
                                                    background: alreadyAdded ? 'var(--color-progress-bg)' : 'transparent',
                                                    border: 'none', borderRadius: 'var(--radius-sm)',
                                                    cursor: 'pointer', textAlign: 'left',
                                                    color: 'var(--color-text-primary)', fontFamily: 'inherit',
                                                    transition: 'background 150ms ease'
                                                }}
                                                onMouseEnter={e => { if (!alreadyAdded) e.target.style.background = 'var(--color-bg-card-hover)'; }}
                                                onMouseLeave={e => { if (!alreadyAdded) e.target.style.background = 'transparent'; }}
                                            >
                                                <div>
                                                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                                                        {product.name}
                                                        {alreadyAdded && <span style={{ color: 'var(--color-accent)', marginLeft: '8px', fontSize: '0.75rem' }}>Added</span>}
                                                    </div>
                                                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>
                                                        {product.description}
                                                    </div>
                                                </div>
                                                <div style={{ fontWeight: 700, fontSize: '0.875rem', whiteSpace: 'nowrap', marginLeft: 'var(--space-md)', color: 'var(--color-accent)' }}>
                                                    {'\u20B5'}{product.rate.toFixed(2)}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            ))}
                            {Object.keys(displayGroups).length === 0 && (
                                <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-muted)' }}>
                                    No products match &quot;{searchTerm}&quot;
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
