'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getUser, isLoggedIn, logout as apiLogout, getUserRoles, hasAnyRole, getConfig, updateProfile } from '@/lib/api';
import { ThemeToggle } from '@/lib/theme';
import {
    IconDashboard, IconClipboard, IconPlusCircle, IconGear,
    IconUsers, IconBell, IconScroll, IconQueue, IconScissors,
    IconMenu, IconLogout, IconChevronLeft, IconChevronRight,
    IconCedis, IconX, IconTag
} from '@/lib/icons';
import Link from 'next/link';

/**
 * Build nav sections dynamically based on user's roles.
 * A user with multiple roles sees the union of all their permitted nav items.
 */
function buildNavSections(roles) {
    const sections = [];
    const addedHrefs = new Set();

    function addItem(sectionName, item) {
        if (addedHrefs.has(item.href)) return;
        addedHrefs.add(item.href);
        let section = sections.find(s => s.section === sectionName);
        if (!section) {
            section = { section: sectionName, items: [] };
            sections.push(section);
        }
        section.items.push(item);
    }

    // Dashboard is always visible
    addItem('Operations', { href: '/dashboard', icon: IconDashboard, label: 'Dashboard' });

    // Receptionist or Admin can see jobs
    if (roles.some(r => ['receptionist', 'admin', 'super_admin'].includes(r))) {
        addItem('Operations', { href: '/dashboard/products', icon: IconTag, label: 'Products & Services' });
        addItem('Operations', { href: '/dashboard/jobs/new', icon: IconPlusCircle, label: 'New Job' });
        addItem('Operations', { href: '/dashboard/jobs', icon: IconClipboard, label: 'All Jobs' });
    }

    // Designer, finisher, admin can see queue
    if (roles.some(r => ['designer', 'finisher', 'admin', 'super_admin'].includes(r))) {
        addItem('Operations', { href: '/dashboard/queue', icon: IconQueue, label: 'Production Queue' });
    }

    // Receptionist, Admin, Super Admin can manage Stock
    if (roles.some(r => ['receptionist', 'admin', 'super_admin'].includes(r))) {
        addItem('Operations', { href: '/dashboard/inventory', icon: IconScissors, label: 'Stock & Inventory' });
    }

    // Admin/Super Admin management
    if (roles.some(r => ['admin', 'super_admin'].includes(r))) {
        addItem('Management', { href: '/dashboard/accounting', icon: IconCedis, label: 'Accounting' });
        addItem('Management', { href: '/dashboard/users', icon: IconUsers, label: 'User Management' });
        addItem('Management', { href: '/dashboard/notifications', icon: IconBell, label: 'Notification Log' });
    }

    // Super Admin gets activity log and settings
    if (roles.includes('super_admin')) {
        addItem('Management', { href: '/dashboard/activity', icon: IconScroll, label: 'Activity Log' });
        addItem('System', { href: '/dashboard/settings', icon: IconGear, label: 'Settings' });
    }

    return sections;
}

const roleLabels = {
    super_admin: 'Super Admin', admin: 'Admin', receptionist: 'Receptionist',
    designer: 'Designer', finisher: 'Finisher'
};

function formatRoles(rolesStr) {
    const roles = (rolesStr || '').split(',').map(r => r.trim()).filter(Boolean);
    if (roles.length === 0) return 'Staff';
    if (roles.length === 1) return roleLabels[roles[0]] || roles[0];
    // Show the "highest" role
    const priority = ['super_admin', 'admin', 'designer', 'finisher', 'receptionist'];
    for (const p of priority) {
        if (roles.includes(p)) return roleLabels[p] + (roles.length > 1 ? ` +${roles.length - 1}` : '');
    }
    return roles.length + ' roles';
}

export default function DashboardLayout({ children }) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUserState] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [systemLogo, setSystemLogo] = useState(null);
    const [systemLogoDark, setSystemLogoDark] = useState(null);
    const [systemFavicon, setSystemFavicon] = useState(null);

    // Profile Edit State
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [profileSaving, setProfileSaving] = useState(false);
    const [newAvatarBase64, setNewAvatarBase64] = useState('');
    const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        if (!isLoggedIn()) {
            router.push('/');
            return;
        }
        setUserState(getUser());

        async function fetchLogo() {
            const res = await getConfig();
            if (res.success) {
                if (res.data.logo_base64) setSystemLogo(res.data.logo_base64);
                if (res.data.logo_dark_base64) setSystemLogoDark(res.data.logo_dark_base64);
                if (res.data.favicon_base64) setSystemFavicon(res.data.favicon_base64);
            }
        }
        fetchLogo();
    }, [router]);

    useEffect(() => {
        function updateFavicon() {
            let link = document.querySelector("link[rel~='icon']");
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.head.appendChild(link);
            }

            const lightIcon = systemFavicon || systemLogo || '/images/logo-light.png';
            const darkIcon = systemFavicon || systemLogoDark || '/images/logo-dark.png';

            link.href = document.hidden ? darkIcon : lightIcon;
        }

        document.addEventListener("visibilitychange", updateFavicon);
        updateFavicon(); // Initialize

        return () => document.removeEventListener("visibilitychange", updateFavicon);
    }, [systemLogo, systemLogoDark, systemFavicon]);

    function handleLogout() {
        apiLogout();
        router.push('/');
    }

    async function handleAvatarUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 500 * 1024) { // 500KB limit
            setProfileMessage({ type: 'error', text: 'Image must be less than 500KB.' });
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => setNewAvatarBase64(reader.result);
        reader.readAsDataURL(file);
    }

    async function handleSaveProfile() {
        setProfileSaving(true);
        setProfileMessage({ type: '', text: '' });

        const res = await updateProfile(newAvatarBase64);
        if (res.success) {
            setProfileMessage({ type: 'success', text: 'Profile updated!' });
            const updatedUser = { ...user, avatar_base64: newAvatarBase64 };
            setUserState(updatedUser);
            // Must update local storage too!
            localStorage.setItem('printflow_user', JSON.stringify(updatedUser));

            setTimeout(() => {
                setShowProfileModal(false);
                setProfileMessage({ type: '', text: '' });
                setNewAvatarBase64('');
            }, 1000);
        } else {
            setProfileMessage({ type: 'error', text: res.error || 'Failed to update profile' });
        }
        setProfileSaving(false);
    }

    if (!user) {
        return (
            <div className="loading-center" style={{ minHeight: '100vh' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    const userRoles = (user.roles || user.role || '').split(',').map(r => r.trim()).filter(Boolean);
    const navSections = buildNavSections(userRoles);
    const initials = (user.display_name || 'U')
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <div className="dashboard-layout">
            <div
                className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
                onClick={() => setSidebarOpen(false)}
            />

            <aside className={`sidebar ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
                <button
                    className="sidebar-toggle-handle"
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    aria-label="Toggle Sidebar"
                >
                    {sidebarCollapsed ? <IconChevronRight size={14} /> : <IconChevronLeft size={14} />}
                </button>

                <div className="sidebar-header" style={{ minHeight: '80px', justifyContent: 'center' }}>
                    {systemLogo && !sidebarCollapsed ? (
                        <Link href="/dashboard" style={{ display: 'block', textAlign: 'center', width: '100%' }}>
                            <img src={systemLogo} alt="Logo" style={{ maxHeight: '44px', maxWidth: '100%', objectFit: 'contain' }} />
                        </Link>
                    ) : sidebarCollapsed && systemFavicon ? (
                        <Link href="/dashboard" style={{ display: 'block', textAlign: 'center', width: '100%' }}>
                            <img src={systemFavicon} alt="Icon" style={{ maxHeight: '32px', maxWidth: '100%', objectFit: 'contain' }} />
                        </Link>
                    ) : (
                        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
                            <div className="sidebar-brand">{sidebarCollapsed ? 'PF' : 'PrintFlow'}</div>
                        </Link>
                    )}
                    {!sidebarCollapsed && <div className="sidebar-role">{formatRoles(user.roles || user.role)}</div>}
                </div>

                <nav className="sidebar-nav">
                    {navSections.map((section, si) => (
                        <div key={si}>
                            {!sidebarCollapsed && <div className="nav-section-label">{section.section}</div>}
                            {sidebarCollapsed && <div className="nav-section-divider" />}
                            {section.items.map(item => {
                                const NavIcon = item.icon;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`nav-link ${pathname === item.href ? 'active' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}
                                        onClick={() => setSidebarOpen(false)}
                                        title={sidebarCollapsed ? item.label : undefined}
                                    >
                                        <span className="nav-link-icon"><NavIcon size={18} /></span>
                                        {!sidebarCollapsed && <span>{item.label}</span>}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user" onClick={() => setShowProfileModal(true)} style={{ cursor: 'pointer', transition: 'background var(--transition-fast)' }} title="Edit Profile">
                        <div className="sidebar-avatar" style={{ overflow: 'hidden' }}>
                            {user.avatar_base64 ? (
                                <img src={user.avatar_base64} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : initials}
                        </div>
                        <div className="sidebar-user-info">
                            <div className="sidebar-user-name">{user.display_name}</div>
                            <div className="sidebar-user-role">{formatRoles(user.roles || user.role)}</div>
                        </div>
                    </div>
                    <button
                        className="btn btn-ghost btn-full"
                        onClick={handleLogout}
                        style={{ marginTop: '8px', fontSize: '0.8125rem', gap: '6px', padding: sidebarCollapsed ? '10px 0' : '10px 20px' }}
                        title={sidebarCollapsed ? 'Sign Out' : undefined}
                    >
                        <IconLogout size={16} /> {!sidebarCollapsed && 'Sign Out'}
                    </button>
                </div>
            </aside>

            <main className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
                <header className="topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <button
                            className="mobile-menu-btn"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            aria-label="Toggle menu"
                        >
                            <IconMenu size={20} />
                        </button>
                        <span className="topbar-title">
                            {pathname === '/dashboard' && 'Dashboard'}
                            {pathname === '/dashboard/jobs' && 'All Jobs'}
                            {pathname === '/dashboard/jobs/new' && 'New Job'}
                            {pathname.startsWith('/dashboard/jobs/') && !pathname.includes('new') && 'Job Detail'}
                            {pathname === '/dashboard/queue' && 'Production Queue'}
                            {pathname === '/dashboard/users' && 'User Management'}
                            {pathname === '/dashboard/notifications' && 'Notification Log'}
                            {pathname === '/dashboard/activity' && 'Activity Log'}
                            {pathname === '/dashboard/settings' && 'System Settings'}
                        </span>
                    </div>
                    <div className="topbar-actions">
                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                            {user.display_name}
                        </span>
                        <ThemeToggle />
                    </div>
                </header>

                <div className="page-content">
                    {children}
                </div>
            </main>

            {/* Profile Edit Modal */}
            {showProfileModal && (
                <div className="modal-overlay" onClick={(e) => { if (e.target.className === 'modal-overlay') setShowProfileModal(false) }}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3 className="modal-title">Edit Profile</h3>
                            <button className="modal-close" onClick={() => setShowProfileModal(false)}><IconX /></button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-lg)' }}>
                            {profileMessage.text && (
                                <div className={`alert ${profileMessage.type === 'success' ? 'alert-success' : 'alert-error'}`} style={{ width: '100%' }}>
                                    {profileMessage.text}
                                </div>
                            )}

                            <div style={{
                                width: '120px', height: '120px', borderRadius: '50%', backgroundColor: 'var(--color-bg-secondary)',
                                overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '2rem', fontWeight: 600, color: 'var(--color-text-muted)', border: '2px dashed var(--color-border)'
                            }}>
                                {newAvatarBase64 || user.avatar_base64 ? (
                                    <img src={newAvatarBase64 || user.avatar_base64} alt="New Avatar Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : initials}
                            </div>

                            <div style={{ textAlign: 'center' }}>
                                <input type="file" id="avatar-upload" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} disabled={profileSaving} />
                                <label htmlFor="avatar-upload" className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                                    Choose Picture
                                </label>
                                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                                    Max size: 500KB. Square images recommended.
                                </p>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowProfileModal(false)} disabled={profileSaving}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSaveProfile} disabled={profileSaving || !newAvatarBase64}>
                                {profileSaving ? 'Saving...' : 'Save Profile'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
