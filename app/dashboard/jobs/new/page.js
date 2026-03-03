'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createJob, uploadFile, getProducts, getConfig } from '@/lib/api';
import { IconArrowLeft, IconPlus, IconMinus, IconX, IconPlusCircle, IconTrash } from '@/lib/icons';

export default function NewJobPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const [form, setForm] = useState({
        client_name: '',
        client_email: '',
        client_phone: '',
        client_phone: '',
        job_description: '',
        requires_design: false,
        requires_delivery: false,
        delivery_fee: 0
    });

    const [files, setFiles] = useState([]);

    // Line items: { productId, name, rate, quantity, discount, unit }
    const [lineItems, setLineItems] = useState([]);
    const [globalDiscount, setGlobalDiscount] = useState(0);
    const [estTaxRate, setEstTaxRate] = useState(0);

    const [productGroups, setProductGroups] = useState({});
    const [showProductPicker, setShowProductPicker] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Load Initial Data
    useEffect(() => {
        async function loadInitialData() {
            // First load config
            const conf = await getConfig();
            let defaultTax = 0;
            if (conf.success && conf.data && conf.data.default_est_tax) {
                defaultTax = Number(conf.data.default_est_tax) || 0;
            }

            // Check localStorage
            const draftQuote = localStorage.getItem('printflow_draft_quote');
            const draftJob = localStorage.getItem('printflow_draft_job');

            if (draftQuote) {
                try {
                    const quote = JSON.parse(draftQuote);
                    setLineItems(quote.items.map(q => ({
                        productId: q.item_id,
                        name: q.item_name,
                        rate: Number(q.rate),
                        quantity: q.qty,
                        discount: 0,
                        unit: q.unit || 'pcs'
                    })));
                    localStorage.removeItem('printflow_draft_quote');
                    setEstTaxRate(defaultTax);
                } catch (e) { }
            } else if (draftJob) {
                try {
                    const parsed = JSON.parse(draftJob);
                    if (parsed.form) setForm(parsed.form);
                    if (parsed.lineItems) setLineItems(parsed.lineItems);
                    if (parsed.globalDiscount !== undefined) setGlobalDiscount(parsed.globalDiscount);
                    if (parsed.estTaxRate !== undefined) {
                        setEstTaxRate(parsed.estTaxRate);
                    } else {
                        setEstTaxRate(defaultTax);
                    }
                } catch (e) { }
            } else {
                setEstTaxRate(defaultTax);
            }

            // Fetch products
            const res = await getProducts('Active');
            if (res.success) {
                const groups = {};
                res.data.forEach(p => {
                    const t = p.product_type || 'Other';
                    if (!groups[t]) groups[t] = [];
                    groups[t].push({
                        id: p.item_id,
                        name: p.item_name,
                        rate: Number(p.rate),
                        unit: p.usage_unit || p.unit_name || 'pcs',
                        description: p.description
                    });
                });
                setProductGroups(groups);
            }

            setLoading(false);
        }
        loadInitialData();
    }, []);

    // Save Draft to LocalStorage
    useEffect(() => {
        if (!loading && (lineItems.length > 0 || form.client_name)) {
            localStorage.setItem('printflow_draft_job', JSON.stringify({
                form,
                lineItems,
                globalDiscount,
                estTaxRate
            }));
        }
    }, [form, lineItems, globalDiscount, estTaxRate, loading]);


    // Calculations
    const subtotal = lineItems.reduce((sum, item) => sum + ((item.rate * item.quantity) - (Number(item.discount) || 0)), 0);
    const afterGlobalDiscount = Math.max(0, subtotal - (Number(globalDiscount) || 0));
    const taxAmount = afterGlobalDiscount * (Number(estTaxRate) / 100);
    const deliveryDelta = (form.requires_delivery && form.delivery_fee) ? Number(form.delivery_fee) : 0;
    const finalTotal = afterGlobalDiscount + taxAmount + deliveryDelta;

    function addProduct(product) {
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
                discount: 0,
                unit: product.unit || 'pcs'
            }]);
        }
        setShowProductPicker(false);
        setSearchTerm('');
    }

    function updateItemField(index, field, value) {
        const updated = [...lineItems];
        if (field === 'quantity') {
            updated[index].quantity = Math.max(1, parseInt(value) || 1);
        } else if (field === 'discount') {
            updated[index].discount = Math.max(0, parseFloat(value) || 0);
        }
        setLineItems(updated);
    }

    function updateQuantityDelta(index, delta) {
        const updated = [...lineItems];
        updated[index].quantity = Math.max(1, updated[index].quantity + delta);
        setLineItems(updated);
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
        setSubmitting(true);

        const jobType = lineItems.map(li => li.name).join(', ');

        let detailedDescription = '--- QUOTE BREAKDOWN ---\n';
        lineItems.forEach(li => {
            detailedDescription += `${li.quantity}x ${li.name} @ \u20B5${li.rate.toFixed(2)}`;
            if (li.discount > 0) detailedDescription += ` (Discount: -\u20B5${Number(li.discount).toFixed(2)})`;
            detailedDescription += ` = \u20B5${((li.rate * li.quantity) - li.discount).toFixed(2)}\n`;
        });

        if (globalDiscount > 0) {
            detailedDescription += `\nSubtotal: \u20B5${subtotal.toFixed(2)}`;
            detailedDescription += `\nGlobal Discount: -\u20B5${Number(globalDiscount).toFixed(2)}`;
            detailedDescription += `\nAfter Discount: \u20B5${afterGlobalDiscount.toFixed(2)}`;
        }

        if (estTaxRate > 0) {
            detailedDescription += `\nEst. Tax (${estTaxRate}%): \u20B5${taxAmount.toFixed(2)}`;
        }

        if (form.requires_delivery && form.delivery_fee > 0) {
            detailedDescription += `\nDelivery Fee: \u20B5${Number(form.delivery_fee).toFixed(2)}`;
        }

        detailedDescription += `\n\nFINAL TOTAL: \u20B5${finalTotal.toFixed(2)}`;

        if (form.job_description) {
            detailedDescription += '\n\n--- NOTES ---\n' + form.job_description;
        }

        const payload = {
            client_name: form.client_name,
            client_email: form.client_email,
            client_phone: form.client_phone,
            job_type: jobType.length > 100 ? jobType.substring(0, 97) + '...' : jobType,
            job_description: detailedDescription,
            total_amount: finalTotal,
            requires_design: form.requires_design,
            requires_delivery: form.requires_delivery,
            delivery_fee: form.requires_delivery ? Number(form.delivery_fee) : 0,
            delivery_status: form.requires_delivery ? 'pending' : 'none',
            tax_percentage: estTaxRate, // pass tax rate to back-end for email mapping
            items: lineItems // pass line items to back-end for invoice generation
        };

        try {
            // Process files concurrently
            const base64Files = await Promise.all(files.map(file => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve({
                        name: file.name,
                        type: file.type || 'application/octet-stream',
                        base64: reader.result.split(',')[1]
                    });
                    reader.onerror = error => reject(error);
                    reader.readAsDataURL(file);
                });
            }));

            const res = await createJob(payload);
            if (res.success) {
                // Upload files to the created job folder
                for (const fileData of base64Files) {
                    try {
                        await uploadFile(res.data.job_id, fileData.name, fileData.type, fileData.base64);
                    } catch (uploadErr) {
                        console.error('File upload failed:', uploadErr);
                    }
                }

                // Clear draft on success
                localStorage.removeItem('printflow_draft_job');
                router.push(`/dashboard/jobs/${res.data.job_id}`);
            } else {
                setError(res.error || 'Failed to create job');
                setSubmitting(false);
            }
        } catch (err) {
            setError('Connection error \u2014 please try again');
            setSubmitting(false);
        }
    }

    const filteredGroups = {};
    if (searchTerm) {
        const s = searchTerm.toLowerCase();
        Object.entries(productGroups).forEach(([cat, products]) => {
            const filtered = products.filter(p =>
                p.name.toLowerCase().includes(s) || (p.description && p.description.toLowerCase().includes(s))
            );
            if (filtered.length > 0) filteredGroups[cat] = filtered;
        });
    }
    const displayGroups = searchTerm ? filteredGroups : productGroups;

    if (loading) return <div className="loading-center"><div className="spinner"></div></div>;

    return (
        <div>
            <button
                className="btn btn-ghost"
                onClick={() => router.back()}
                style={{ marginBottom: 'var(--space-lg)', gap: '6px' }}
            >
                <IconArrowLeft size={16} /> Back
            </button>

            <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Create New Job</h2>
                    <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                        onClick={() => {
                            if (confirm('Clear all draft data?')) {
                                localStorage.removeItem('printflow_draft_job');
                                window.location.reload();
                            }
                        }}
                    >
                        Clear Draft
                    </button>
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                <form onSubmit={handleSubmit}>

                    {/* CLIENT INFO */}
                    <div style={{ marginBottom: 'var(--space-xl)' }}>
                        <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>Client Information</h3>
                        <div className="form-group">
                            <label className="form-label">Client Name *</label>
                            <input type="text" className="form-input" required
                                value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                                placeholder="e.g. John Mensah" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input type="email" className="form-input"
                                    value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))}
                                    placeholder="email@example.com" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phone</label>
                                <input type="tel" className="form-input"
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
                                border: '2px dashed var(--color-border)', borderRadius: 'var(--radius-lg)',
                                padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--color-text-muted)'
                            }}>
                                <p style={{ marginBottom: 'var(--space-sm)' }}>No items added yet</p>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowProductPicker(true)} style={{ gap: '4px' }}>
                                    <IconPlusCircle size={16} /> Browse Products
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                {lineItems.map((item, i) => (
                                    <div key={`${item.productId}-${i}`} style={{
                                        display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) auto auto auto auto', gap: 'var(--space-md)',
                                        alignItems: 'center', padding: 'var(--space-md)', background: 'var(--color-bg-secondary)',
                                        borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)'
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.name}</div>
                                            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                                                {'\u20B5'}{item.rate.toFixed(2)} / {item.unit}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg-card)', padding: '2px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                                            <button type="button" className="btn btn-ghost" onClick={() => updateQuantityDelta(i, -1)} style={{ padding: '4px 6px', minWidth: 'auto', border: 'none' }}>
                                                <IconMinus size={14} />
                                            </button>
                                            <input type="number" value={item.quantity} min="1" onChange={e => updateItemField(i, 'quantity', e.target.value)}
                                                style={{ width: '40px', textAlign: 'center', background: 'transparent', border: 'none', color: 'var(--color-text-primary)' }} />
                                            <button type="button" className="btn btn-ghost" onClick={() => updateQuantityDelta(i, 1)} style={{ padding: '4px 6px', minWidth: 'auto', border: 'none' }}>
                                                <IconPlus size={14} />
                                            </button>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Disc: {'\u20B5'}</span>
                                            <input type="number" value={item.discount} min="0" step="0.01" onChange={e => updateItemField(i, 'discount', e.target.value)}
                                                style={{ width: '60px', padding: '4px 8px', background: 'var(--color-bg-input)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)' }} />
                                        </div>

                                        <div style={{ fontWeight: 700, fontSize: '0.9375rem', whiteSpace: 'nowrap', minWidth: '80px', textAlign: 'right' }}>
                                            {'\u20B5'}{((item.rate * item.quantity) - item.discount).toFixed(2)}
                                        </div>

                                        <button type="button" onClick={() => removeItem(i)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-pending)', padding: '4px', display: 'flex' }}>
                                            <IconTrash size={16} />
                                        </button>
                                    </div>
                                ))}

                                {/* Order Totals Section */}
                                <div style={{
                                    marginTop: 'var(--space-md)', padding: 'var(--space-md) var(--space-lg)',
                                    background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '8px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--space-lg)' }}>
                                        <span style={{ color: 'var(--color-text-muted)' }}>Subtotal:</span>
                                        <span style={{ fontWeight: 600, fontSize: '1rem', width: '100px', textAlign: 'right' }}>{'\u20B5'}{subtotal.toFixed(2)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--space-lg)' }}>
                                        <span style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            Overall Discount: {'\u20B5'}
                                            <input type="number" value={globalDiscount} min="0" step="0.01" onChange={e => setGlobalDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                                                style={{ width: '80px', padding: '4px 8px', background: 'var(--color-bg-input)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)' }} />
                                        </span>
                                        <span style={{ fontWeight: 600, fontSize: '1rem', width: '100px', textAlign: 'right', color: 'var(--color-pending)' }}>
                                            -{'\u20B5'}{Number(globalDiscount).toFixed(2)}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--space-lg)' }}>
                                        <span style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            Est. Tax: %
                                            <input type="number" value={estTaxRate} min="0" step="0.1" onChange={e => setEstTaxRate(Math.max(0, parseFloat(e.target.value) || 0))}
                                                style={{ width: '60px', padding: '4px 8px', background: 'var(--color-bg-input)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)' }} />
                                        </span>
                                        <span style={{ fontWeight: 600, fontSize: '1rem', width: '100px', textAlign: 'right' }}>
                                            {'\u20B5'}{taxAmount.toFixed(2)}
                                        </span>
                                    </div>
                                    <div style={{ borderTop: '1px solid var(--color-border)', marginTop: '8px', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--space-lg)' }}>
                                        <span style={{ fontWeight: 700, fontSize: '1.25rem' }}>Final Total:</span>
                                        <span style={{ fontWeight: 700, fontSize: '1.35rem', color: 'var(--brand-primary)', width: '120px', textAlign: 'right' }}>{'\u20B5'}{finalTotal.toFixed(2)}</span>
                                    </div>
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

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
                            <div>
                                <h3 className="card-title" style={{ margin: 0 }}>Delivery Services</h3>
                                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>Does this order require courier delivery?</p>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={form.requires_delivery}
                                    onChange={e => setForm(f => ({ ...f, requires_delivery: e.target.checked }))}
                                    style={{ width: '20px', height: '20px', marginRight: '8px', cursor: 'pointer' }}
                                />
                                <span style={{ fontWeight: 600 }}>Yes, requires delivery</span>
                            </label>
                        </div>

                        {form.requires_delivery && (
                            <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
                                <label className="form-label" style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>Delivery Fee ({'\u20B5'})</label>
                                <input type="number" step="0.01" className="form-input" required={form.requires_delivery} style={{ maxWidth: '200px' }}
                                    value={form.delivery_fee} onChange={e => setForm(f => ({ ...f, delivery_fee: e.target.value }))}
                                    placeholder="Enter delivery cost..." />
                                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>This fee will be added to the invoice total and logged as a Courier Expense automatically.</p>
                            </div>
                        )}

                        {!form.requires_design && (
                            <div style={{ marginTop: 'var(--space-md)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-md)' }}>
                                <h4 style={{ fontSize: '0.9rem', marginBottom: '12px' }}>Client Files</h4>

                                {/* Custom Multi-file uploader UI */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                        <label className="btn btn-secondary" style={{ cursor: 'pointer', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                            <IconPlus size={16} /> Select Files
                                            <input
                                                type="file"
                                                multiple
                                                onChange={e => e.target.files && setFiles(prev => [...prev, ...Array.from(e.target.files)])}
                                                style={{ display: 'none' }}
                                            />
                                        </label>
                                        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                                            Supports multiple files (images, PDFs, documents)
                                        </span>
                                    </div>

                                    {files.length > 0 && (
                                        <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {files.map((file, i) => (
                                                <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-surface)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>{file.name}</span>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>({(file.size / 1024).toFixed(1)} KB)</span>
                                                    </div>
                                                    <button type="button" onClick={() => removeFile(i)} style={{ background: 'none', border: 'none', color: 'var(--color-pending)', cursor: 'pointer', padding: '4px', display: 'flex' }} title="Remove file">
                                                        <IconX size={16} />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* NOTES */}
                    <div className="form-group">
                        <label className="form-label" htmlFor="notes">
                            Additional Notes {form.requires_design && <span style={{ color: 'var(--color-pending)', fontWeight: 'normal' }}>(Required for Design Services)</span>}
                        </label>
                        <textarea id="notes" className="form-input" rows={4}
                            required={form.requires_design}
                            value={form.job_description} onChange={e => setForm(f => ({ ...f, job_description: e.target.value }))}
                            placeholder="Special instructions, delivery details, etc." />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-full"
                        disabled={submitting || !form.client_name || lineItems.length === 0}
                        style={{ padding: '16px', fontSize: '1.1rem', marginTop: 'var(--space-md)', fontWeight: 600 }}
                    >
                        {submitting ? 'Creating Job...' : `Create Job \u2014 \u20B5${finalTotal.toFixed(2)}`}
                    </button>
                </form>
            </div>

            {/* PRODUCT PICKER MODAL */}
            {showProductPicker && (
                <div className="modal-overlay" onClick={() => { setShowProductPicker(false); setSearchTerm(''); }}>
                    <div className="modal modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
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
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                                                        background: alreadyAdded ? 'var(--color-progress-bg)' : 'var(--color-bg-secondary)',
                                                        border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                                                        cursor: 'pointer', textAlign: 'left', color: 'var(--color-text-primary)'
                                                    }}
                                                >
                                                    <div>
                                                        <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                                                            {product.name}
                                                            {alreadyAdded && <span style={{ color: 'var(--color-accent)', marginLeft: '8px', fontSize: '0.75rem' }}>Added</span>}
                                                        </div>
                                                        {product.description && (
                                                            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '2px', maxWidth: '400px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {product.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.875rem', marginLeft: 'var(--space-md)' }}>
                                                        {'\u20B5'}{product.rate.toFixed(2)}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
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
