'use client';

import { useEffect, useState } from 'react';
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

    useEffect(() => {
        setUserState(getUser());
        loadConfig();
    }, []);

    async function loadConfig() {
        setLoading(true);
        const res = await getConfig();
        if (res.success) {
            setConfig(res.data);
            setCompanyName(res.data.company_name || 'PopOut Studios');
        }
        setLoading(false);
    }

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
                    </div>
                </div>
            </div>
        </div>
    );
}
