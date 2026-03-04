'use client';

import { useEffect, useState } from 'react';
import { getUsers, createUser, updateUser, disableUser, enableUser, getUser, hasAnyRole } from '@/lib/api';
import { IconPlusCircle, IconX, IconCheckCircle, IconXCircle } from '@/lib/icons';
import { useCallback } from 'react';

const ALL_ROLES = [
    { key: 'receptionist', label: 'Receptionist', description: 'Receives jobs, manages client info' },
    { key: 'designer', label: 'Designer', description: 'Handles production/design work' },
    { key: 'finisher', label: 'Finisher', description: 'Handles finishing stage' },
    { key: 'admin', label: 'Admin', description: 'Manages users, views all data' },
    { key: 'super_admin', label: 'Super Admin', description: 'Full system access + settings' },
];

function parseRoles(rolesStr) {
    if (!rolesStr) return [];
    return String(rolesStr).split(',').map(r => {
        let normalized = r.trim().toLowerCase().replace(/\s+/g, '_');
        if (normalized === 'site_admin') return 'admin';
        return normalized;
    }).filter(Boolean);
}

function roleLabel(rolesStr) {
    const roles = parseRoles(rolesStr);
    return roles.map(r => {
        const def = ALL_ROLES.find(ar => ar.key === r);
        return def ? def.label : r;
    }).join(', ');
}

export default function UsersPage() {
    const [users, setUsers] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [form, setForm] = useState({
        username: '', password: '', display_name: '', roles: []
    });
    const [formLoading, setFormLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        const res = await getUsers();
        if (res.success) setUsers(res.data);
        setLoading(false);
    }, []);

    useEffect(() => {
        setCurrentUser(getUser());
        loadUsers();
    }, [loadUsers]);


    function openCreate() {
        setEditingUser(null);
        setForm({ username: '', password: '', display_name: '', roles: [], hide_floater: false });
        setShowModal(true);
    }

    function openEdit(user) {
        setEditingUser(user);
        setForm({
            username: user.username,
            password: '',
            display_name: user.display_name,
            roles: parseRoles(user.roles),
            hide_floater: user.hide_floater === true
        });
        setShowModal(true);
    }

    function toggleRole(roleKey) {
        setForm(f => {
            const current = f.roles;
            if (current.includes(roleKey)) {
                return { ...f, roles: current.filter(r => r !== roleKey) };
            } else {
                return { ...f, roles: [...current, roleKey] };
            }
        });
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (form.roles.length === 0) {
            setMessage({ type: 'error', text: 'Select at least one role' });
            return;
        }
        setFormLoading(true);
        setMessage({ type: '', text: '' });

        try {
            let res;
            if (editingUser) {
                const payload = {
                    target_username: editingUser.username,
                    display_name: form.display_name,
                    roles: form.roles.join(','),
                    hide_floater: form.hide_floater
                };
                if (form.password) payload.new_password = form.password;
                res = await updateUser(payload);
            } else {
                if (!form.username || !form.password || !form.display_name) {
                    setMessage({ type: 'error', text: 'All fields are required' });
                    setFormLoading(false);
                    return;
                }
                res = await createUser({
                    username: form.username,
                    password: form.password,
                    display_name: form.display_name,
                    roles: form.roles.join(','),
                    hide_floater: form.hide_floater
                });
            }

            if (res.success) {
                setMessage({ type: 'success', text: editingUser ? 'User updated' : 'User created' });
                setShowModal(false);
                await loadUsers();
            } else {
                setMessage({ type: 'error', text: res.error });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Connection failed — please try again.' });
        } finally {
            setFormLoading(false);
        }
    }

    async function handleToggleStatus(user) {
        const isActive = (user.status || 'active') === 'active';
        const action = isActive ? 'disable' : 'enable';
        if (!confirm(`${isActive ? 'Disable' : 'Enable'} user "${user.display_name}"?${isActive ? ' They will not be able to log in.' : ''}`)) return;

        setActionLoading(user.username);
        setMessage({ type: '', text: '' });

        const res = isActive
            ? await disableUser(user.username)
            : await enableUser(user.username);

        if (res.success) {
            setMessage({ type: 'success', text: res.data?.message || `User ${action}d` });
            await loadUsers();
        } else {
            setMessage({ type: 'error', text: res.error });
        }
        setActionLoading(null);
    }

    const roleBadgeColors = {
        super_admin: 'badge-finishing', admin: 'badge-progress', receptionist: 'badge-approved',
        designer: 'badge-progress', finisher: 'badge-completed'
    };

    if (loading) {
        return <div className="loading-center"><div className="spinner"></div></div>;
    }

    const isSuperAdmin = hasAnyRole(['super_admin']);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>User Management</h2>
                <button className="btn btn-primary" onClick={openCreate} style={{ gap: '6px' }}>
                    <IconPlusCircle size={16} /> Add User
                </button>
            </div>

            {message.text && (
                <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                    {message.text}
                </div>
            )}

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Username</th>
                            <th>Roles</th>
                            <th>Status</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => {
                            const isActive = (u.status || 'active') === 'active';
                            const userRoles = parseRoles(u.roles);
                            return (
                                <tr key={u.username} style={{ opacity: isActive ? 1 : 0.5 }}>
                                    <td style={{ fontWeight: 600 }}>{u.display_name}</td>
                                    <td style={{ fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{u.username}</td>
                                    <td>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {userRoles.map(r => (
                                                <span key={r} className={`badge ${roleBadgeColors[r] || 'badge-progress'}`} style={{ fontSize: '0.6875rem' }}>
                                                    {ALL_ROLES.find(ar => ar.key === r)?.label || r}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`badge ${isActive ? 'badge-completed' : 'badge-pending'}`}>
                                            {isActive ? 'Active' : 'Disabled'}
                                        </span>
                                    </td>
                                    <td style={{ color: 'var(--color-text-muted)' }}>
                                        {u.created_at ? new Date(u.created_at.toString().replace(/-/g, '/')).toLocaleDateString() : '\u2014'}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                                            <button className="btn btn-ghost" onClick={() => openEdit(u)}
                                                style={{ fontSize: '0.75rem', padding: '4px 12px' }}>
                                                Edit
                                            </button>
                                            {isSuperAdmin && u.username !== currentUser?.username && (
                                                <button
                                                    className={`btn ${isActive ? 'btn-danger' : 'btn-primary'}`}
                                                    onClick={() => handleToggleStatus(u)}
                                                    disabled={actionLoading === u.username}
                                                    style={{ fontSize: '0.75rem', padding: '4px 12px', gap: '4px' }}
                                                >
                                                    {actionLoading === u.username ? '...' : (
                                                        isActive ? <><IconXCircle size={12} /> Disable</> : <><IconCheckCircle size={12} /> Enable</>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editingUser ? 'Edit User' : 'Add New User'}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><IconX size={18} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                {message.text && message.type === 'error' && (
                                    <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                                        {message.text}
                                    </div>
                                )}
                                {!editingUser && (
                                    <div className="form-group">
                                        <label className="form-label">Username</label>
                                        <input type="text" className="form-input" value={form.username}
                                            onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required placeholder="e.g. john_doe" />
                                    </div>
                                )}
                                <div className="form-group">
                                    <label className="form-label">Display Name</label>
                                    <input type="text" className="form-input" value={form.display_name}
                                        onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} required placeholder="Full name" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{editingUser ? 'New Password (leave empty to keep current)' : 'Password'}</label>
                                    <input type="password" className="form-input" value={form.password}
                                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required={!editingUser} />
                                </div>

                                {/* Floating UI Settings */}
                                <div className="form-group" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px', marginTop: '16px' }}>
                                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={form.hide_floater}
                                            onChange={(e) => setForm(f => ({ ...f, hide_floater: e.target.checked }))}
                                            style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: 'var(--brand-primary)' }}
                                        />
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Disable Floating Quote Summary</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4, marginTop: '2px' }}>
                                                Forces the hovering Draft Job box to be disabled for this user.
                                            </div>
                                        </div>
                                    </label>
                                </div>

                                {/* Multi-Role Checkboxes */}
                                <div className="form-group">
                                    <label className="form-label">Roles / Privileges</label>
                                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 'var(--space-sm)' }}>
                                        Select one or more roles. A user can hold multiple privileges.
                                    </p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {ALL_ROLES.map(role => {
                                            const checked = form.roles.includes(role.key);
                                            // Only Super Admin can assign admin/super_admin
                                            const disabled = ['admin', 'super_admin'].includes(role.key) && !isSuperAdmin;
                                            return (
                                                <label
                                                    key={role.key}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '10px',
                                                        padding: '10px 12px',
                                                        background: checked ? 'var(--color-progress-bg, rgba(37, 99, 235, 0.08))' : 'var(--color-bg-secondary)',
                                                        border: `1.5px solid ${checked ? 'var(--color-accent)' : 'var(--color-border)'}`,
                                                        borderRadius: 'var(--radius-md)',
                                                        cursor: disabled ? 'not-allowed' : 'pointer',
                                                        opacity: disabled ? 0.4 : 1,
                                                        transition: 'all 150ms ease'
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        disabled={disabled}
                                                        onChange={() => !disabled && toggleRole(role.key)}
                                                        style={{ width: 16, height: 16, accentColor: 'var(--color-accent)' }}
                                                    />
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{role.label}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{role.description}</div>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={formLoading || form.roles.length === 0}>
                                    {formLoading ? 'Saving...' : (editingUser ? 'Update' : 'Create')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
