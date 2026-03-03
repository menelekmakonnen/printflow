'use client';

import React, { useEffect, useState, useCallback } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { getConfig, updateConfig, getUser, hasAnyRole } from '@/lib/api';
import { IconPlus, IconX, IconGear, IconInfo } from '@/lib/icons';

export default function SettingsPage() {
    const [config, setConfig] = useState(null);
    const [user, setUserState] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [newType, setNewType] = useState('');
    const [logoBase64, setLogoBase64] = useState('');
    const [enableTax, setEnableTax] = useState(true);

    // --- Crop State ---
    const [cropImageSrc, setCropImageSrc] = useState(null);
    const [cropType, setCropType] = useState(null); // 'logo' | 'favicon'
    const [crop, setCrop] = useState();
    const [completedCrop, setCompletedCrop] = useState(null);
    const imgRef = React.useRef(null);

    const loadConfig = useCallback(async () => {
        setLoading(true);
        const res = await getConfig();
        if (res.success) {
            setConfig(res.data);
            setLogoBase64(res.data.logo_base64 || '');
            setEnableTax(res.data.enable_tax !== false); // Default true if undefined
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        setUserState(getUser());
        loadConfig();
    }, [loadConfig]);

    async function handleToggleTax(newVal) {
        setSaving(true);
        setMessage({ type: '', text: '' });

        const res = await updateConfig({ enable_tax: newVal });
        if (res.success) {
            setMessage({ type: 'success', text: `Estimated Tax ${newVal ? 'Enabled' : 'Disabled'}` });
            setEnableTax(newVal);
        } else {
            setMessage({ type: 'error', text: res.error });
        }
        setSaving(false);
    }

    async function handleLogoUpload(e, isDark = false) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 500 * 1024) {
            setMessage({ type: 'error', text: 'Logo image must be less than 500KB.' });
            return;
        }

        const reader = new FileReader();
        reader.addEventListener('load', () => setCropImageSrc(reader.result?.toString() || ''));
        reader.readAsDataURL(file);
    }

    // --- Crop Action Handlers ---
    async function handleCropComplete() {
        if (!completedCrop || !imgRef.current) return;
        const canvas = document.createElement('canvas');
        const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
        const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
        canvas.width = completedCrop.width;
        canvas.height = completedCrop.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(
            imgRef.current,
            completedCrop.x * scaleX,
            completedCrop.y * scaleY,
            completedCrop.width * scaleX,
            completedCrop.height * scaleY,
            0,
            0,
            completedCrop.width,
            completedCrop.height
        );
        const base64Data = canvas.toDataURL('image/png');
        setCropImageSrc(null); // Close modal 

        setSaving(true);
        setMessage({ type: '', text: '' });

        if (cropType === 'logo') {
            const res = await updateConfig({ logo_base64: base64Data, logo_dark_base64: base64Data }); // Set both
            if (res.success) {
                setMessage({ type: 'success', text: 'Logo uploaded successfully' });
                setLogoBase64(base64Data);
            } else setMessage({ type: 'error', text: res.error });
        } else {
            const res = await updateConfig({ favicon_base64: base64Data });
            if (res.success) {
                setMessage({ type: 'success', text: 'System Favicon uploaded successfully' });
                setFaviconBase64(base64Data);
            } else setMessage({ type: 'error', text: res.error });
        }
        setSaving(false);
    }

    async function handleFaviconUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 200 * 1024) {
            setMessage({ type: 'error', text: 'Favicon image must be less than 200KB.' });
            return;
        }

        const reader = new FileReader();
        reader.addEventListener('load', () => setCropImageSrc(reader.result?.toString() || ''));
        reader.readAsDataURL(file);
    }

    async function handleAddType() {
        if (!newType.trim()) return;
        setSaving(true);
        setMessage({ type: '', text: '' });

        const types = [...(config?.job_types || []), newType.trim().toLowerCase().replace(/\s+/g, '_')];
        const res = await updateConfig({ job_types: types });
        if (res.success) {
            setMessage({ type: 'success', text: `Added job type "${newType}"` });
            setNewType('');
            await loadConfig();
        } else {
            setMessage({ type: 'error', text: res.error });
        }
        setSaving(false);
    }

    async function handleRemoveType(typeToRemove) {
        if (!confirm(`Remove job type "${typeToRemove}"?`)) return;
        setSaving(true);
        setMessage({ type: '', text: '' });

        const types = (config?.job_types || []).filter(t => t !== typeToRemove);
        const res = await updateConfig({ job_types: types });
        if (res.success) {
            setMessage({ type: 'success', text: `Removed "${typeToRemove}"` });
            await loadConfig();
        } else {
            setMessage({ type: 'error', text: res.error });
        }
        setSaving(false);
    }

    if (loading) {
        return <div className="loading-center"><div className="spinner"></div></div>;
    }

    if (!hasAnyRole(['super_admin'])) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon"><IconGear size={40} color="var(--color-text-muted)" /></div>
                <div className="empty-state-title">Access Restricted</div>
                <p>Only Super Admins can access system settings.</p>
            </div>
        );
    }

    return (
        <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-lg)' }}>
                System Settings
            </h2>

            {message.text && (
                <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                    {message.text}
                </div>
            )}

            {/* System Logo */}
            <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
                <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>Dashboard & Login Branding</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem', marginBottom: 'var(--space-md)' }}>
                    Upload standard (light background) and dark mode (dark background) logos. Max 500KB.
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xl)' }}>
                    <div style={{ flex: '1 1 300px' }}>
                        <div style={{
                            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-md)',
                            display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: '8px',
                            background: '#f8fafc'
                        }}>
                            <div style={{
                                width: '64px', height: '64px', background: '#fff', borderRadius: '8px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                                flexShrink: 0, boxShadow: 'var(--shadow-sm)'
                            }}>
                                {logoBase64 ? (
                                    <img src={logoBase64} alt="Brand Logo" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                                ) : (
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>None</span>
                                )}
                            </div>
                            <div style={{ flex: 1 }}>
                                <input type="file" id="logo-upload" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleLogoUpload(e, false)} disabled={saving} />
                                <label htmlFor="logo-upload" className="btn btn-ghost" style={{ fontSize: '0.875rem', padding: '6px 12px', cursor: 'pointer' }}>
                                    {saving ? 'Uploading...' : 'Choose Image'}
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Financial Config */}
            <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
                <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>Financial Settings</h3>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 'var(--space-md)', borderBottom: '1px solid var(--color-border)', marginBottom: 'var(--space-md)' }}>
                    <div>
                        <div style={{ fontWeight: 600 }}>Enable Estimated Tax</div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                            Show the Est. Tax block on Quotes and Invoices by default.
                        </div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={enableTax}
                            onChange={(e) => handleToggleTax(e.target.checked)}
                            disabled={saving}
                            style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--color-accent)' }}
                        />
                    </label>
                </div>
            </div>

            {/* Currency */}
            <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
                <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>Currency</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 700 }}>{'\u20B5'}</div>
                    <div>
                        <div style={{ fontWeight: 600 }}>Ghanaian Cedi (GHS)</div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                            Default currency for all job amounts
                        </div>
                    </div>
                </div>
            </div>

            {/* System Info */}
            <details className="card" style={{ cursor: 'pointer' }}>
                <summary className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', outline: 'none' }}>
                    <IconInfo size={16} /> System Information
                </summary>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginTop: 'var(--space-lg)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px' }}>
                        <span style={{ fontWeight: 600 }}>Platform:</span><span>PrintFlow MVP</span>
                        <span style={{ fontWeight: 600 }}>Backend:</span><span>Google Apps Script</span>
                        <span style={{ fontWeight: 600 }}>Database:</span><span>Google Sheets</span>
                        <span style={{ fontWeight: 600 }}>Notifications:</span><span>Gmail + Calendar</span>
                        <span style={{ fontWeight: 600 }}>Storage:</span><span>Google Drive</span>
                        <span style={{ fontWeight: 600 }}>Developed By:</span><span>ICUNI Labs</span>
                    </div>
                </div>
            </details>

            {/* React Image Crop Modal overlay */}
            {cropImageSrc && (
                <div className="modal-overlay">
                    <div className="modal modal-content" style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column' }}>
                        <div className="modal-header">
                            <h2>Crop {cropType === 'logo' ? 'Logo' : 'Favicon'}</h2>
                            <button className="btn-icon" onClick={() => setCropImageSrc(null)}><IconX size={20} /></button>
                        </div>
                        <div className="modal-body" style={{ flex: 1, overflow: 'auto', background: '#000', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', justifyContent: 'center' }}>
                            <ReactCrop
                                crop={crop}
                                onChange={(_, percentCrop) => setCrop(percentCrop)}
                                onComplete={(c) => setCompletedCrop(c)}
                                aspect={cropType === 'favicon' ? 1 : undefined}
                            >
                                <img
                                    ref={imgRef}
                                    src={cropImageSrc}
                                    alt="Crop target"
                                    style={{ maxHeight: '50vh', maxWidth: '100%', objectFit: 'contain' }}
                                />
                            </ReactCrop>
                        </div>
                        <div className="modal-footer" style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button className="btn btn-secondary" onClick={() => setCropImageSrc(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleCropComplete}>Apply Crop</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
