'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createJob, uploadFile, getProducts, getConfig } from '@/lib/api';
import { IconArrowLeft, IconPlus, IconMinus, IconX, IconPlusCircle, IconTrash, IconUpload } from '@/lib/icons';

export default function NewJobPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const [form, setForm] = useState({
        client_name: '',
        client_email: '',
        client_phone: '',
        job_description: '',
        requires_design: false,
        provides_files: false,
        requires_delivery: false,
        delivery_fee: 0,
        delivery_address: '',
        delivery_notes: ''
    });

    const [files, setFiles] = useState([]);

    // Line items: { productId, name, rate, quantity, discount, discountType, cost, costType, unit }
    const [lineItems, setLineItems] = useState([]);

    // Global modifications
    const [globalDiscount, setGlobalDiscount] = useState(0);
    const [globalDiscountType, setGlobalDiscountType] = useState('cedi'); // 'cedi' or 'percent'
    const [globalCost, setGlobalCost] = useState(0);
    const [globalCostType, setGlobalCostType] = useState('cedi'); // 'cedi' or 'percent'

    const [estTaxRate, setEstTaxRate] = useState(0);

    const [productGroups, setProductGroups] = useState({});
    const [showProductPicker, setShowProductPicker] = useState(false);
    const [showCustomItemPicker, setShowCustomItemPicker] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [config, setConfig] = useState(null);
    const [designServiceOptions, setDesignServiceOptions] = useState([]);

    // Load Initial Data
    useEffect(() => {
        async function loadInitialData() {
            // First load config
            const conf = await getConfig();
            if (conf.success && conf.data) {
                setConfig(conf.data);
            }

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
                const designOptionsList = [];

                res.data.forEach(p => {
                    const t = p.product_type || 'Other';
                    if (!groups[t]) groups[t] = [];

                    const itemData = {
                        id: p.item_id,
                        name: p.item_name,
                        rate: Number(p.rate),
                        unit: p.usage_unit || p.unit_name || 'pcs',
                        description: p.description
                    };

                    if (p.item_name && p.item_name.toLowerCase().includes('design')) {
                        designOptionsList.push(itemData);
                    }

                    groups[t].push(itemData);
                });
                setProductGroups(groups);
                setDesignServiceOptions(designOptionsList);
            }

            setLoading(false);
        }
        loadInitialData();
    }, []);




    // Calculations
    const lineItemsWithTotals = lineItems.map(item => {
        const itemBase = Number(item.rate || 0) * Number(item.quantity || 1);
        const itemCost = item.costType === 'percent' ? itemBase * (Number(item.cost || 0) / 100) : Number(item.cost || 0);

        // Item Level Design Cost calculation
        let baseDesignRate = 0;
        let designName = 'Design Service';
        if (item.design_service && item.design_id) {
            const foundOption = designServiceOptions.find(opt => opt.id === item.design_id);
            if (foundOption) {
                baseDesignRate = foundOption.rate;
                designName = foundOption.name;
            }
        }

        const designAddLog = item.design_service ? Number(item.design_cost || 0) : 0;
        const computedDesignAdd = (item.design_service && item.design_costType === 'percent') ? baseDesignRate * (designAddLog / 100) : designAddLog;

        const designDiscLog = item.design_service ? Number(item.design_discount || 0) : 0;
        const computedDesignDisc = (item.design_service && item.design_discountType === 'percent') ? baseDesignRate * (designDiscLog / 100) : designDiscLog;

        const designCost = item.design_service ? Math.max(0, (baseDesignRate + computedDesignAdd) - computedDesignDisc) : 0;

        const productBaseWithCost = itemBase + itemCost;
        const itemDiscount = item.discountType === 'percent' ? productBaseWithCost * (Number(item.discount || 0) / 100) : Number(item.discount || 0);
        const productTotal = Math.max(0, productBaseWithCost - itemDiscount);

        const itemTotal = productTotal + designCost;
        return { ...item, itemBase, itemCost, designCost, designDiscMod: computedDesignDisc, designAddMod: computedDesignAdd, baseDesignRate, designName, itemDiscount, productTotal, itemTotal };
    });

    const subtotalProducts = lineItemsWithTotals.reduce((sum, item) => sum + item.itemTotal, 0);

    let standaloneDesignBaseRate = 0;
    if (form.requires_design && form.standalone_design_id) {
        const foundOption = designServiceOptions.find(opt => opt.id === form.standalone_design_id);
        if (foundOption) standaloneDesignBaseRate = foundOption.rate;
    }
    const standaloneDesignBase = form.requires_design ? standaloneDesignBaseRate : 0;

    const standaloneDesignAdd = form.requires_design ? (
        form.standalone_design_cost_type === 'percent'
            ? standaloneDesignBase * (Number(form.standalone_design_cost || 0) / 100)
            : Number(form.standalone_design_cost || 0)
    ) : 0;

    const standaloneDesignDiscount = form.requires_design ? (
        form.standalone_design_discount_type === 'percent'
            ? standaloneDesignBase * (Number(form.standalone_design_discount || 0) / 100)
            : Number(form.standalone_design_discount || 0)
    ) : 0;

    const standaloneDesignTotal = Math.max(0, (standaloneDesignBase + standaloneDesignAdd) - standaloneDesignDiscount);

    const subtotal = subtotalProducts + standaloneDesignTotal;

    const calculatedGlobalCost = globalCostType === 'percent' ? subtotal * (Number(globalCost || 0) / 100) : Number(globalCost || 0);
    const subtotalWithGlobalCost = subtotal + calculatedGlobalCost;

    const calculatedGlobalDiscount = globalDiscountType === 'percent' ? subtotalWithGlobalCost * (Number(globalDiscount || 0) / 100) : Number(globalDiscount || 0);
    const afterGlobalDiscount = Math.max(0, subtotalWithGlobalCost - calculatedGlobalDiscount);

    const taxAmount = afterGlobalDiscount * (Number(estTaxRate || 0) / 100);
    const deliveryDelta = (form.requires_delivery && form.delivery_fee) ? Number(form.delivery_fee) : 0;

    const finalTotal = afterGlobalDiscount + taxAmount + deliveryDelta;

    // Save Draft to LocalStorage
    useEffect(() => {
        if (!loading) {
            if (lineItems.length > 0 || form.client_name || form.requires_design) {
                localStorage.setItem('printflow_draft_job', JSON.stringify({
                    form,
                    lineItems,
                    computedItems: lineItemsWithTotals,
                    standaloneDesign: { active: form.requires_design, total: standaloneDesignTotal },
                    globalDiscount,
                    globalDiscountType,
                    globalCost,
                    globalCostType,
                    estTaxRate,
                    subtotal,
                    finalTotal
                }));
            } else {
                localStorage.removeItem('printflow_draft_job');
            }
        }
    }, [form, lineItems, globalDiscount, globalDiscountType, globalCost, globalCostType, estTaxRate, loading, subtotal, finalTotal]);

    function handleFileChange(e) {
        if (e.target.files) {
            // Keep existing files, append new files
            setFiles(prev => [...prev, ...Array.from(e.target.files)]);
        }
    }

    function addCustomItem(name, rate, qty = 1, discount = 0, discountType = 'cedi') {
        const newItem = {
            productId: 'CUSTOM-' + Math.random().toString(36).substr(2, 9),
            name: name,
            rate: Number(rate),
            quantity: qty,
            cost: 0,
            costType: 'cedi',
            discount: discount,
            discountType: discountType,
            design_service: false,
            design_id: designServiceOptions.length > 0 ? designServiceOptions[0].id : null,
            design_cost: 0,
            design_costType: 'cedi',
            design_discount: 0,
            design_discountType: 'cedi',
            design_notes: '',
            unit: 'unit'
        };
        setLineItems([...lineItems, newItem]);
        setShowCustomItemPicker(false);
    }



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
                discountType: 'cedi',
                cost: 0,
                costType: 'cedi',
                design_service: false,
                design_id: designServiceOptions.length > 0 ? designServiceOptions[0].id : null,
                design_cost: 0,
                design_costType: 'cedi',
                design_discount: 0,
                design_discountType: 'cedi',
                design_notes: '',
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
        } else if (field === 'cost') {
            updated[index].cost = Math.max(0, parseFloat(value) || 0);
        } else if (field === 'design_cost') {
            updated[index].design_cost = Math.max(0, parseFloat(value) || 0);
        } else if (field === 'design_discount') {
            updated[index].design_discount = Math.max(0, parseFloat(value) || 0);
        } else if (field === 'design_service') {
            updated[index].design_service = value;
        } else if (field === 'design_id') {
            updated[index].design_id = value;
        } else if (field === 'design_notes') {
            updated[index].design_notes = value;
        } else if (field === 'discountType' || field === 'costType' || field === 'design_costType' || field === 'design_discountType') {
            updated[index][field] = value;
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
        if (form.requires_design && !form.standalone_design_details?.trim()) {
            setError('Design Details are required when requesting a Standalone Design Service');
            return;
        }

        setError('');
        setSubmitting(true);

        const jobType = lineItems.map(li => li.name).join(', ');

        let detailedDescription = '--- QUOTE BREAKDOWN ---\n';
        lineItemsWithTotals.forEach(li => {
            detailedDescription += `${li.quantity}x ${li.name} @ \u20B5${li.rate.toFixed(2)}`;
            if (li.itemCost > 0) detailedDescription += ` (Cost: +\u20B5${li.itemCost.toFixed(2)})`;
            if (li.itemDiscount > 0) detailedDescription += ` (Discount: -\u20B5${li.itemDiscount.toFixed(2)})`;
            detailedDescription += ` = \u20B5${li.productTotal.toFixed(2)}\n`;
            if (li.designCost > 0) {
                detailedDescription += `   \u21B3 +Design: ${li.designName || 'Custom'} = \u20B5${li.designCost.toFixed(2)}\n`;
            }
            if (li.design_service) {
                detailedDescription += `   -> Configured: ${li.designName}\n`;
                detailedDescription += `      | Base Rate: \u20B5${li.baseDesignRate.toFixed(2)}`;
                if (li.designAddMod > 0) detailedDescription += ` | Add'l Cost: +\u20B5${li.designAddMod.toFixed(2)}`;
                if (li.designDiscMod > 0) detailedDescription += ` | Disc: -\u20B5${li.designDiscMod.toFixed(2)}`;
                detailedDescription += ` | Subtotal: \u20B5${li.designCost.toFixed(2)}\n`;
                if (li.design_notes) detailedDescription += `   -> Design Notes: ${li.design_notes}\n`;
            }
        });

        detailedDescription += `\nRaw Subtotal: \u20B5${subtotal.toFixed(2)}`;

        if (calculatedGlobalCost > 0) {
            detailedDescription += `\nGlobal Additional Cost: +\u20B5${calculatedGlobalCost.toFixed(2)}`;
        }

        if (calculatedGlobalDiscount > 0) {
            detailedDescription += `\nGlobal Discount: -\u20B5${calculatedGlobalDiscount.toFixed(2)}`;
        }

        if (calculatedGlobalCost > 0 || calculatedGlobalDiscount > 0) {
            detailedDescription += `\nAfter Global Adjustments: \u20B5${afterGlobalDiscount.toFixed(2)}`;
        }

        if (form.requires_design) {
            const optedDesign = designServiceOptions.find(opt => opt.id === form.standalone_design_id);
            const designName = optedDesign ? optedDesign.name : 'Standalone Design Service';
            detailedDescription += `\n--- ${designName.toUpperCase()} ---\n`;
            detailedDescription += `   -> Base Cost: \u20B5${standaloneDesignBase.toFixed(2)}\n`;
            if (Number(form.standalone_design_cost || 0) > 0) {
                const cType = form.standalone_design_cost_type === 'percent' ? '%' : '\u20B5';
                detailedDescription += `   -> Add'l Cost: +${form.standalone_design_cost}${cType}\n`;
            }
            if (Number(form.standalone_design_discount || 0) > 0) {
                const dType = form.standalone_design_discount_type === 'percent' ? '%' : '\u20B5';
                detailedDescription += `   -> Discount: -${form.standalone_design_discount}${dType}\n`;
            }
            if (form.standalone_design_details) {
                detailedDescription += `   -> Scope: ${form.standalone_design_details}\n`;
            }
        }

        if (form.requires_delivery && form.delivery_fee > 0) {
            detailedDescription += `\nDelivery Fee: \u20B5${Number(form.delivery_fee).toFixed(2)}`;
            if (form.delivery_address) {
                detailedDescription += `\nDelivery Address: ${form.delivery_address}`;
            }
            if (form.delivery_notes) {
                detailedDescription += `\nDelivery Notes: ${form.delivery_notes}`;
            }
        }

        detailedDescription += `\n\nFINAL TOTAL: \u20B5${finalTotal.toFixed(2)}`;

        if (form.job_description) {
            detailedDescription += '\n\n--- NOTES ---\n' + form.job_description;
        }

        // Splice Standalone Design locally before shipping to API
        const submitLineItems = [...lineItems];
        if (form.requires_design && form.standalone_design_id) {
            const optedDesign = designServiceOptions.find(opt => opt.id === form.standalone_design_id);
            submitLineItems.push({
                productId: form.standalone_design_id,
                name: optedDesign ? optedDesign.name : 'Standalone Design',
                rate: standaloneDesignTotal, // Push pre-computed total
                quantity: 1,
                discount: 0,
                discountType: 'cedi',
                cost: 0,
                costType: 'cedi',
                design_service: false,
                design_notes: form.standalone_design_details,
                unit: optedDesign ? optedDesign.unit : 'unit'
            });
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
            delivery_address: form.requires_delivery ? form.delivery_address : '',
            delivery_status: form.requires_delivery ? 'pending' : 'none',
            tax_percentage: estTaxRate, // pass tax rate to back-end for email mapping
            items: submitLineItems // pass line items to back-end for invoice generation
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
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowCustomItemPicker(true)}
                                    style={{ gap: '4px', fontSize: '0.8125rem' }}
                                >
                                    <IconPlusCircle size={16} /> Custom Item
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => setShowProductPicker(true)}
                                    style={{ gap: '4px', fontSize: '0.8125rem' }}
                                >
                                    <IconPlusCircle size={16} /> Browse Products
                                </button>
                            </div>
                        </div>

                        {lineItems.length === 0 ? (
                            <div style={{
                                border: '2px dashed var(--color-border)', borderRadius: 'var(--radius-lg)',
                                padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--color-text-muted)'
                            }}>
                                <p style={{ marginBottom: 'var(--space-sm)' }}>No items added yet</p>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                                    <button type="button" className="btn btn-ghost" onClick={() => setShowProductPicker(true)} style={{ gap: '4px' }}>
                                        <IconPlusCircle size={16} /> Browse Products
                                    </button>
                                    <button type="button" className="btn btn-ghost" onClick={() => setShowCustomItemPicker(true)} style={{ gap: '4px', color: 'var(--color-primary)' }}>
                                        + Add Custom Item
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                {lineItems.map((item, i) => (
                                    <div key={`${item.productId}-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: i < lineItems.length - 1 ? 'var(--space-md)' : 0 }}>
                                        <div style={{
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

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minHeight: '26px' }}>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', width: '32px' }}>Cost</span>
                                                    <input type="number" value={item.cost || 0} min="0" step="0.01" onChange={e => updateItemField(i, 'cost', e.target.value)}
                                                        style={{ width: '60px', padding: '4px 8px', background: 'var(--color-bg-input)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)' }} />
                                                    <select value={item.costType || 'cedi'} onChange={e => updateItemField(i, 'costType', e.target.value)}
                                                        style={{ background: 'var(--color-bg-secondary)', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.75rem', padding: '2px' }}>
                                                        <option value="cedi">{'\u20B5'}</option>
                                                        <option value="percent">%</option>
                                                    </select>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minHeight: '26px' }}>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', width: '32px' }}>Disc</span>
                                                    <input type="number" value={item.discount || 0} min="0" step="0.01" onChange={e => updateItemField(i, 'discount', e.target.value)}
                                                        style={{ width: '60px', padding: '4px 8px', background: 'var(--color-bg-input)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)' }} />
                                                    <select value={item.discountType || 'cedi'} onChange={e => updateItemField(i, 'discountType', e.target.value)}
                                                        style={{ background: 'var(--color-bg-secondary)', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.75rem', padding: '2px' }}>
                                                        <option value="cedi">{'\u20B5'}</option>
                                                        <option value="percent">%</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '90px', gap: '4px' }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.9375rem', whiteSpace: 'nowrap', textAlign: 'right' }}>
                                                    {'\u20B5'}{(lineItemsWithTotals[i]?.productTotal || lineItemsWithTotals[i]?.itemTotal || 0).toFixed(2)}
                                                </div>
                                                {item.design_service && (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                        + {'\u20B5'}{(lineItemsWithTotals[i]?.designCost || 0).toFixed(2)}
                                                    </div>
                                                )}
                                            </div>

                                            <button type="button" onClick={() => removeItem(i)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-pending)', padding: '4px', display: 'flex' }}>
                                                <IconTrash size={16} />
                                            </button>
                                        </div>

                                        <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px dashed var(--color-border)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', alignItems: 'center' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '6px', background: item.design_service ? 'var(--color-text-primary)' : 'var(--color-bg-input)', padding: '4px 10px', borderRadius: 'var(--radius-full)', border: `1px solid ${item.design_service ? 'var(--color-text-primary)' : 'var(--color-border)'}`, transition: 'all 0.2s', boxShadow: item.design_service ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none' }}>
                                                <input type="checkbox" checked={item.design_service} onChange={e => {
                                                    const isChecked = e.target.checked;
                                                    updateItemField(i, 'design_service', isChecked);
                                                    if (!isChecked) updateItemField(i, 'design_notes', '');
                                                }} style={{ display: 'none' }} />
                                                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: item.design_service ? 'var(--color-bg-primary)' : 'var(--color-text-muted)', whiteSpace: 'nowrap', transition: 'color 0.2s' }}>{item.design_service ? '\u2713 Design Applied' : '+Design'}</span>
                                            </label>

                                            {item.design_service && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Tier</span>
                                                        <select value={item.design_id || ''} onChange={e => updateItemField(i, 'design_id', e.target.value)}
                                                            style={{ minWidth: '120px', padding: '4px 8px', background: 'var(--color-bg-input)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)', fontSize: '0.75rem' }}>
                                                            {designServiceOptions.map(opt => (
                                                                <option key={opt.id} value={opt.id}>{opt.name} (\u20B5{opt.rate})</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>+Cost</span>
                                                        <input type="number" value={item.design_cost || 0} step="0.01" onChange={e => updateItemField(i, 'design_cost', e.target.value)}
                                                            style={{ width: '60px', padding: '4px 8px', background: 'var(--color-bg-input)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)' }}
                                                            placeholder="Amt" />
                                                        <select value={item.design_costType || 'cedi'} onChange={e => updateItemField(i, 'design_costType', e.target.value)}
                                                            style={{ background: 'var(--color-bg-secondary)', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.75rem', padding: '2px', borderRadius: '4px', cursor: 'pointer' }}>
                                                            <option value="cedi">{'\u20B5'}</option>
                                                            <option value="percent">%</option>
                                                        </select>
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>-Disc</span>
                                                        <input type="number" value={item.design_discount || 0} step="0.01" onChange={e => updateItemField(i, 'design_discount', e.target.value)}
                                                            style={{ width: '60px', padding: '4px 8px', background: 'var(--color-bg-input)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)' }}
                                                            placeholder="Amt" />
                                                        <select value={item.design_discountType || 'cedi'} onChange={e => updateItemField(i, 'design_discountType', e.target.value)}
                                                            style={{ background: 'var(--color-bg-secondary)', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.75rem', padding: '2px', borderRadius: '4px', cursor: 'pointer' }}>
                                                            <option value="cedi">{'\u20B5'}</option>
                                                            <option value="percent">%</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {item.design_service && (
                                            <div style={{ marginTop: '12px', padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-input)' }}>
                                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '8px' }}>Design Instructions</label>
                                                <textarea style={{ width: '100%', fontSize: '0.8125rem', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', resize: 'vertical' }} rows={2} placeholder={`Provide detailed design instructions for ${item.name}...`} value={item.design_notes || ''} onChange={e => updateItemField(i, 'design_notes', e.target.value)} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* STANDALONE DESIGN SERVICE */}
                    <div style={{ marginBottom: 'var(--space-xl)', padding: form.requires_design ? 'var(--space-md)' : '10px 16px', background: form.requires_design ? 'var(--color-bg-secondary)' : 'transparent', border: `1px solid ${form.requires_design ? 'transparent' : 'var(--color-border)'}`, borderRadius: 'var(--radius-lg)', transition: 'all 0.2s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: form.requires_design ? 'var(--space-md)' : '0' }}>
                            <div>
                                <h3 className="card-title" style={{ margin: 0 }}>Standalone Design Service</h3>
                                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>Is this a design-only job without physical products?</p>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={form.requires_design}
                                    onChange={e => setForm(f => ({ ...f, requires_design: e.target.checked }))}
                                    style={{ width: '20px', height: '20px', marginRight: '8px', cursor: 'pointer' }}
                                />
                                <span style={{ fontWeight: 600 }}>Yes, Design Only</span>
                            </label>
                        </div>

                        {form.requires_design && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                                <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                                    <div className="form-group" style={{ marginBottom: 0, flex: 2 }}>
                                        <label className="form-label" style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>Design Tier</label>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <select className="form-input" style={{ flex: 1 }} value={form.standalone_design_id || ''}
                                                onChange={e => setForm(f => ({ ...f, standalone_design_id: e.target.value }))}>
                                                {designServiceOptions.map(opt => (
                                                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                                                ))}
                                            </select>
                                            <div style={{ padding: '8px 12px', background: 'var(--color-bg-input)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontWeight: 600, display: 'flex', alignItems: 'center', height: '42px', whiteSpace: 'nowrap' }}>
                                                {'\u20B5'}{standaloneDesignBase.toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                                        <label className="form-label" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>Add'l Cost</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input type="number" step="0.01" className="form-input"
                                                value={form.standalone_design_cost || ''} onChange={e => setForm(f => ({ ...f, standalone_design_cost: e.target.value }))}
                                                placeholder="Amount" style={{ flex: 2 }} />
                                            <select className="form-input" value={form.standalone_design_cost_type || 'cedi'}
                                                onChange={e => setForm(f => ({ ...f, standalone_design_cost_type: e.target.value }))} style={{ flex: 1 }}>
                                                <option value="cedi">{'\u20B5'}</option>
                                                <option value="percent">%</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                                        <label className="form-label" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>Discount</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input type="number" step="0.01" className="form-input"
                                                value={form.standalone_design_discount || ''} onChange={e => setForm(f => ({ ...f, standalone_design_discount: e.target.value }))}
                                                placeholder="Amount" style={{ flex: 2 }} />
                                            <select className="form-input" value={form.standalone_design_discount_type || 'cedi'}
                                                onChange={e => setForm(f => ({ ...f, standalone_design_discount_type: e.target.value }))} style={{ flex: 1 }}>
                                                <option value="cedi">{'\u20B5'}</option>
                                                <option value="percent">%</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontWeight: 600 }}>Design Details & Scope *</label>
                                    <textarea className="form-input" rows={3} required={form.requires_design}
                                        value={form.standalone_design_details || ''} onChange={e => setForm(f => ({ ...f, standalone_design_details: e.target.value }))}
                                        placeholder="Detailed instructions for the design team..." />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* CLIENT FILES */}
                    <div style={{
                        marginBottom: 'var(--space-xl)', padding: 'var(--space-xl)',
                        background: form.provides_files ? '#f0fdf4' : 'var(--color-bg-secondary)',
                        border: form.provides_files ? '2px solid #22c55e' : '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-lg)', transition: 'all var(--transition-normal)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <h3 className="card-title" style={{ margin: 0, color: form.provides_files ? '#166534' : 'var(--color-text-primary)' }}>Client Files</h3>
                                <p style={{ fontSize: '0.875rem', color: form.provides_files ? '#15803d' : 'var(--color-text-muted)', margin: 0 }}>Is the client providing assets or files?</p>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={form.provides_files}
                                    onChange={e => setForm(f => ({ ...f, provides_files: e.target.checked }))}
                                    style={{ width: '24px', height: '24px', marginRight: '12px', cursor: 'pointer', accentColor: '#22c55e' }}
                                />
                                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: form.provides_files ? '#166534' : 'var(--color-text-primary)' }}>Yes, Have Files</span>
                            </label>
                        </div>

                        {form.provides_files && (
                            <div style={{ marginTop: 'var(--space-lg)', borderTop: `1px solid ${form.provides_files ? '#bbf7d0' : 'var(--color-border)'}`, paddingTop: 'var(--space-lg)' }}>
                                <h4 style={{ fontSize: '1rem', marginBottom: '16px', fontWeight: 600, color: '#166534' }}>Upload Assets</h4>

                                {/* Custom Multi-file uploader UI */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                        <label className="btn btn-primary" style={{ cursor: 'pointer', padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '1rem', background: '#22c55e', color: 'white', border: 'none' }}>
                                            <IconUpload size={20} />
                                            Select Files
                                            <input
                                                type="file"
                                                multiple
                                                onChange={handleFileChange}
                                                style={{ display: 'none' }}
                                            />
                                        </label>
                                        <span style={{ fontSize: '0.875rem', color: '#15803d' }}>
                                            {files.length === 0 ? 'No files selected' : `${files.length} file(s) selected`}
                                        </span>
                                    </div>

                                    {files.length > 0 && (
                                        <div style={{
                                            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px',
                                            background: '#dcfce7', padding: '16px', borderRadius: '8px'
                                        }}>
                                            {files.map((file, i) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white', padding: '8px 12px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                                                    <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#166534', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }} title={file.name}>
                                                        {file.name}
                                                    </span>
                                                    <button type="button" onClick={() => removeFile(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', padding: '4px' }}>
                                                        <IconX size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="form-group" style={{ marginTop: 'var(--space-lg)', marginBottom: 0 }}>
                                    <label className="form-label" style={{ color: '#166534' }}>File URL / Drive Link (Optional)</label>
                                    <input type="url" className="form-input"
                                        value={form.file_url} onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))}
                                        placeholder="https://drive.google.com/..."
                                        style={{ border: '1px solid #86efac', '&:focus': { borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34, 197, 94, 0.1)' } }} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* DELIVERY SERVICES */}
                    <div style={{ marginBottom: 'var(--space-xl)', padding: 'var(--space-md)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>Delivery Fee ({'\u20B5'})</label>
                                    <input type="number" step="0.01" className="form-input" required={form.requires_delivery} style={{ maxWidth: '200px' }}
                                        value={form.delivery_fee} onChange={e => setForm(f => ({ ...f, delivery_fee: e.target.value }))}
                                        placeholder="Enter delivery cost..." />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontWeight: 600 }}>Delivery Address *</label>
                                    <textarea className="form-input" rows={2} required={form.requires_delivery}
                                        value={form.delivery_address} onChange={e => setForm(f => ({ ...f, delivery_address: e.target.value }))}
                                        placeholder="Enter complete delivery address..." />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontWeight: 600 }}>Delivery Notes (Optional)</label>
                                    <textarea className="form-input" rows={2}
                                        value={form.delivery_notes} onChange={e => setForm(f => ({ ...f, delivery_notes: e.target.value }))}
                                        placeholder="Any special instructions for the courier?" />
                                </div>
                            </div>
                        )}

                    </div>



                    {/* NOTES */}
                    <div className="form-group">
                        <label className="form-label" htmlFor="notes">
                            Additional Notes
                        </label>
                        <textarea id="notes" className="form-input" rows={4}
                            value={form.job_description} onChange={e => setForm(f => ({ ...f, job_description: e.target.value }))}
                            placeholder="Special instructions, delivery details, etc." />
                    </div>

                    {
                        lineItems.length > 0 && (
                            <div id="order-totals-section" style={{
                                marginBottom: 'var(--space-md)', padding: 'var(--space-md) var(--space-lg)',
                                background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '8px'
                            }}>
                                <div style={{ paddingBottom: '12px', borderBottom: '1px solid var(--color-border)', marginBottom: '8px' }}>
                                    <h4 style={{ margin: '0 0 12px 0', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>Quote Breakdown</h4>
                                    {lineItemsWithTotals.map((li, idx) => (
                                        <div key={`summary-${idx}`}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '4px', color: 'var(--color-text-primary)' }}>
                                                <span style={{ display: 'flex', gap: '8px' }}><span>{li.quantity}x</span> <span>{li.name}</span></span>
                                                <span>{'\u20B5'}{li.productTotal.toFixed(2)}</span>
                                            </div>
                                            {li.designCost > 0 && (
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px', color: 'var(--brand-primary)', paddingLeft: '24px' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>&#x21B3; +Design: {li.designName || 'Custom'}</span>
                                                    <span>{'\u20B5'}{li.designCost.toFixed(2)}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {form.requires_design && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '6px', color: 'var(--color-text-muted)' }}>
                                            <span>Standalone Design Service</span>
                                            <span>{'\u20B5'}{standaloneDesignTotal.toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--space-lg)' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Raw Subtotal:</span>
                                    <span style={{ fontWeight: 600, fontSize: '1rem', width: '100px', textAlign: 'right' }}>{'\u20B5'}{subtotal.toFixed(2)}</span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--space-lg)' }}>
                                    <span style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        Overall Added Cost:
                                        <input type="number" value={globalCost} min="0" step="0.01" onChange={e => setGlobalCost(Math.max(0, parseFloat(e.target.value) || 0))}
                                            style={{ width: '80px', padding: '4px 8px', background: 'var(--color-bg-input)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)' }} />
                                        <select value={globalCostType} onChange={e => setGlobalCostType(e.target.value)} style={{ background: 'none', border: 'none', color: 'var(--color-text-primary)' }}>
                                            <option value="cedi">{'\u20B5'}</option>
                                            <option value="percent">%</option>
                                        </select>
                                    </span>
                                    <span style={{ fontWeight: 600, fontSize: '1rem', width: '100px', textAlign: 'right', color: 'var(--color-text-primary)' }}>
                                        +{'\u20B5'}{Number(calculatedGlobalCost).toFixed(2)}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--space-lg)' }}>
                                    <span style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        Overall Discount:
                                        <input type="number" value={globalDiscount} min="0" step="0.01" onChange={e => setGlobalDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                                            style={{ width: '80px', padding: '4px 8px', background: 'var(--color-bg-input)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)' }} />
                                        <select value={globalDiscountType} onChange={e => setGlobalDiscountType(e.target.value)} style={{ background: 'none', border: 'none', color: 'var(--color-text-primary)' }}>
                                            <option value="cedi">{'\u20B5'}</option>
                                            <option value="percent">%</option>
                                        </select>
                                    </span>
                                    <span style={{ fontWeight: 600, fontSize: '1rem', width: '100px', textAlign: 'right', color: 'var(--color-pending)' }}>
                                        -{'\u20B5'}{Number(calculatedGlobalDiscount).toFixed(2)}
                                    </span>
                                </div>
                                {(config?.enable_tax !== false) && (
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
                                )}
                                {form.requires_delivery && (
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--space-lg)', marginTop: '8px' }}>
                                        <span style={{ color: 'var(--color-text-muted)' }}>Delivery Fee:</span>
                                        <span style={{ fontWeight: 600, fontSize: '1rem', width: '100px', textAlign: 'right' }}>
                                            {'\u20B5'}{deliveryDelta.toFixed(2)}
                                        </span>
                                    </div>
                                )}
                                <div style={{ borderTop: '1px solid var(--color-border)', marginTop: '8px', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--space-lg)' }}>
                                    <span style={{ fontWeight: 700, fontSize: '1.25rem' }}>Final Total:</span>
                                    <span style={{ fontWeight: 700, fontSize: '1.35rem', color: 'var(--brand-primary)', width: '120px', textAlign: 'right' }}>{'\u20B5'}{finalTotal.toFixed(2)}</span>
                                </div>
                            </div>
                        )
                    }

                    <button
                        type="submit"
                        className="btn btn-primary btn-full"
                        disabled={submitting || !form.client_name || lineItems.length === 0}
                        style={{ padding: '16px', fontSize: '1.1rem', marginTop: 'var(--space-md)', fontWeight: 600 }}
                    >
                        {submitting ? 'Creating Job...' : `Create Job \u2014 \u20B5${finalTotal.toFixed(2)}`}
                    </button>
                </form >
            </div >

            {/* PRODUCT PICKER MODAL */}
            {
                showProductPicker && (
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
                )
            }

            {/* CUSTOM ITEM PICKER MODAL */}
            {
                showCustomItemPicker && (
                    <div className="modal-overlay" onClick={() => setShowCustomItemPicker(false)}>
                        <div className="modal modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
                            <div className="modal-header">
                                <h3 className="modal-title">Add Custom Item</h3>
                                <button className="modal-close" onClick={() => setShowCustomItemPicker(false)}>
                                    <IconX size={18} />
                                </button>
                            </div>
                            <div className="modal-body" style={{ padding: 'var(--space-lg)' }}>
                                <form onSubmit={(e) => {
                                    e.preventDefault();
                                    const fd = new FormData(e.target);
                                    addCustomItem(
                                        fd.get('name'),
                                        fd.get('rate'),
                                        Number(fd.get('qty') || 1),
                                        Number(fd.get('discount') || 0),
                                        fd.get('discountType')
                                    );
                                }}>
                                    <div className="form-group">
                                        <label className="form-label">Item / Service Name *</label>
                                        <input name="name" type="text" className="form-input" required autoFocus placeholder="e.g. Custom Rush Printing" />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                                        <div className="form-group">
                                            <label className="form-label">Price / Rate ({'\u20B5'}) *</label>
                                            <input name="rate" type="number" step="0.01" min="0" className="form-input" required placeholder="0.00" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Quantity</label>
                                            <input name="qty" type="number" min="1" defaultValue="1" className="form-input" required />
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Discount Section</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input name="discount" type="number" step="0.01" min="0" defaultValue="0" className="form-input" style={{ flex: 1 }} />
                                            <select name="discountType" className="form-input" style={{ width: '80px', padding: '0 8px' }}>
                                                <option value="cedi">{'\u20B5'}</option>
                                                <option value="percent">%</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: 'var(--space-xl)' }}>
                                        <button type="submit" className="btn btn-primary btn-full" style={{ padding: '12px', fontSize: '1rem' }}>
                                            Add to Job
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* CUSTOM ITEM PICKER MODAL */}
            {
                showCustomItemPicker && (
                    <div className="modal-overlay" onClick={() => setShowCustomItemPicker(false)}>
                        <div className="modal modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
                            <div className="modal-header">
                                <h3 className="modal-title">Add Custom Item</h3>
                                <button className="modal-close" onClick={() => setShowCustomItemPicker(false)}>
                                    <IconX size={18} />
                                </button>
                            </div>
                            <div className="modal-body" style={{ padding: 'var(--space-lg)' }}>
                                <form onSubmit={(e) => {
                                    e.preventDefault();
                                    const fd = new FormData(e.target);
                                    addCustomItem(
                                        fd.get('name'),
                                        fd.get('rate'),
                                        Number(fd.get('qty') || 1),
                                        Number(fd.get('discount') || 0),
                                        fd.get('discountType')
                                    );
                                }}>
                                    <div className="form-group">
                                        <label className="form-label">Item / Service Name *</label>
                                        <input name="name" type="text" className="form-input" required autoFocus placeholder="e.g. Custom Rush Printing" />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                                        <div className="form-group">
                                            <label className="form-label">Price / Rate ({'\u20B5'}) *</label>
                                            <input name="rate" type="number" step="0.01" min="0" className="form-input" required placeholder="0.00" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Quantity</label>
                                            <input name="qty" type="number" min="1" defaultValue="1" className="form-input" required />
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Discount Section</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input name="discount" type="number" step="0.01" min="0" defaultValue="0" className="form-input" style={{ flex: 1 }} />
                                            <select name="discountType" className="form-input" style={{ width: '80px', padding: '0 8px' }}>
                                                <option value="cedi">{'\u20B5'}</option>
                                                <option value="percent">%</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: 'var(--space-xl)' }}>
                                        <button type="submit" className="btn btn-primary btn-full" style={{ padding: '12px', fontSize: '1rem' }}>
                                            Add to Job
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
