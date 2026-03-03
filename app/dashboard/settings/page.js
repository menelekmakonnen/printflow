'use client';

import { useEffect, useState, useCallback } from 'react';
import { getConfig, updateConfig, getUser, hasAnyRole } from '@/lib/api';
import { IconPlus, IconX, IconGear, IconInfo } from '@/lib/icons';

export default function SettingsPage() {
    const [config, setConfig] = useState(null);
    const [user, setUserState] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [newType, setNewType] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [logoBase64, setLogoBase64] = useState('');
    const [logoDarkBase64, setLogoDarkBase64] = useState('');
    const [faviconBase64, setFaviconBase64] = useState('');

    const loadConfig = useCallback(async () => {
        setLoading(true);
        const res = await getConfig();
        if (res.success) {
            setConfig(res.data);
            setCompanyName(res.data.company_name || 'PopOut Studios');
            setLogoBase64(res.data.logo_base64 || '');
            setLogoDarkBase64(res.data.logo_dark_base64 || '');
            setFaviconBase64(res.data.favicon_base64 || '');
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        setUserState(getUser());
        loadConfig();
    }, [loadConfig]);

    async function handleSaveCompany() {
        if (!companyName.trim()) return;
        setSaving(true);
        setMessage({ type: '', text: '' });

        const res = await updateConfig({ company_name: companyName });
        if (res.success) {
            setMessage({ type: 'success', text: 'Company name updated' });
            await loadConfig();
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
        reader.onloadend = async () => {
            const base64Data = reader.result;
            setSaving(true);
            setMessage({ type: '', text: '' });

            const res = await updateConfig(isDark ? { logo_dark_base64: base64Data } : { logo_base64: base64Data });
            if (res.success) {
                setMessage({ type: 'success', text: `${isDark ? 'Dark ' : ''}Logo uploaded successfully` });
                if (isDark) {
                    setLogoDarkBase64(base64Data);
                } else {
                    setLogoBase64(base64Data);
                }
            } else {
                setMessage({ type: 'error', text: res.error });
            }
            setSaving(false);
        };
        reader.readAsDataURL(file);
    }

    async function handleFaviconUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 200 * 1024) {
            setMessage({ type: 'error', text: 'Favicon image must be less than 200KB.' });
            return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64Data = reader.result;
            setSaving(true);
            setMessage({ type: '', text: '' });

            const res = await updateConfig({ favicon_base64: base64Data });
            if (res.success) {
                setMessage({ type: 'success', text: 'System Favicon uploaded successfully' });
                setFaviconBase64(base64Data);
            } else {
                setMessage({ type: 'error', text: res.error });
            }
            setSaving(false);
        };
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

            {/* Company Name */}
            <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
                <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>Company Name</h3>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                    <input type="text" className="form-input" value={companyName}
                        onChange={e => setCompanyName(e.target.value)} style={{ flex: 1 }} />
                    <button className="btn btn-primary" onClick={handleSaveCompany} disabled={saving}>
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>

            {/* System Logo */}
            <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
                <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>System Logos</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem', marginBottom: 'var(--space-md)' }}>
                    Upload standard (light background), dark mode (dark background) logos, and a square Favicon. Max 500KB.
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xl)' }}>
                    {/* Light Logo */}
                    <div style={{ flex: '1 1 300px' }}>
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '8px' }}>Standard/Light Logo</h4>
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
                                    <img src={logoBase64} alt="Light Logo" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                                ) : (
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>None</span>
                                )}
                            </div>
                            <div style={{ flex: 1 }}>
                                <input type="file" id="logo-light-upload" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleLogoUpload(e, false)} disabled={saving} />
                                <label htmlFor="logo-light-upload" className="btn btn-ghost" style={{ fontSize: '0.875rem', padding: '6px 12px', cursor: 'pointer' }}>
                                    {saving ? 'Uploading...' : 'Choose Image'}
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Dark Logo */}
                    <div style={{ flex: '1 1 300px' }}>
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '8px' }}>Dark Mode Logo</h4>
                        <div style={{
                            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-md)',
                            display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: '8px',
                            background: '#0f172a'
                        }}>
                            <div style={{
                                width: '64px', height: '64px', background: '#1e293b', borderRadius: '8px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                                flexShrink: 0, boxShadow: 'var(--shadow-sm)'
                            }}>
                                {logoDarkBase64 ? (
                                    <img src={logoDarkBase64} alt="Dark Logo" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                                ) : (
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>None</span>
                                )}
                            </div>
                            <div style={{ flex: 1 }}>
                                <input type="file" id="logo-dark-upload" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleLogoUpload(e, true)} disabled={saving} />
                                <label htmlFor="logo-dark-upload" className="btn btn-ghost" style={{ fontSize: '0.875rem', padding: '6px 12px', cursor: 'pointer', color: '#f1f5f9' }}>
                                    {saving ? 'Uploading...' : 'Choose Image'}
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* System Favicon */}
                    <div style={{ flex: '1 1 300px' }}>
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '8px' }}>System Favicon</h4>
                        <div style={{
                            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-md)',
                            display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: '8px',
                            background: '#f8fafc'
                        }}>
                            <div style={{
                                width: '64px', height: '64px', background: '#e2e8f0', borderRadius: '8px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                                flexShrink: 0, boxShadow: 'var(--shadow-sm)'
                            }}>
                                {faviconBase64 ? (
                                    <img src={faviconBase64} alt="Favicon" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                ) : (
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>None</span>
                                )}
                            </div>
                            <div style={{ flex: 1 }}>
                                <input type="file" id="favicon-upload" accept="image/*" style={{ display: 'none' }} onChange={handleFaviconUpload} disabled={saving} />
                                <label htmlFor="favicon-upload" className="btn btn-ghost" style={{ fontSize: '0.875rem', padding: '6px 12px', cursor: 'pointer' }}>
                                    {saving ? 'Uploading...' : 'Choose Square Element'}
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Job Types */}
            <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
                <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>Job Types</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem', marginBottom: 'var(--space-md)' }}>
                    Manage the types of print jobs available in the system. These appear in the New Job form.
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
                    {(config?.job_types || []).map(type => (
                        <span key={type} className="badge badge-progress" style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            padding: '6px 14px', fontSize: '0.8125rem', cursor: 'default'
                        }}>
                            {type.replace(/_/g, ' ')}
                            <button
                                onClick={() => handleRemoveType(type)}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'inherit', padding: 0, display: 'flex', opacity: 0.7
                                }}
                                title="Remove type"
                            >
                                <IconX size={14} />
                            </button>
                        </span>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                    <input type="text" className="form-input" value={newType}
                        onChange={e => setNewType(e.target.value)} placeholder="e.g. Large Format"
                        onKeyPress={e => e.key === 'Enter' && handleAddType()} style={{ flex: 1 }} />
                    <button className="btn btn-primary" onClick={handleAddType} disabled={saving || !newType.trim()} style={{ gap: '4px' }}>
                        <IconPlus size={16} /> Add
                    </button>
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
            <div className="card">
                <h3 className="card-title" style={{ marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IconInfo size={16} /> System Information
                </h3>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px' }}>
                        <span style={{ fontWeight: 600 }}>Platform:</span><span>PrintFlow MVP</span>
                        <span style={{ fontWeight: 600 }}>Backend:</span><span>Google Apps Script</span>
                        <span style={{ fontWeight: 600 }}>Database:</span><span>Google Sheets</span>
                        <span style={{ fontWeight: 600 }}>Notifications:</span><span>Gmail + Calendar</span>
                        <span style={{ fontWeight: 600 }}>Storage:</span><span>Google Drive</span>
                        <span style={{ fontWeight: 600 }}>Developed By:</span><span>ICUNI Labs</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
