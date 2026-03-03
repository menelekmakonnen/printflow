'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getUser, isLoggedIn, logout as apiLogout, getUserRoles, hasAnyRole } from '@/lib/api';
import { ThemeToggle } from '@/lib/theme';
import {
    IconDashboard, IconClipboard, IconPlusCircle, IconGear,
    IconUsers, IconBell, IconScroll, IconQueue, IconScissors,
    IconMenu, IconLogout
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
        addItem('Operations', { href: '/dashboard/jobs', icon: IconClipboard, label: 'All Jobs' });
        addItem('Operations', { href: '/dashboard/jobs/new', icon: IconPlusCircle, label: 'New Job' });
    }

    // Designer, finisher, admin can see queue
    if (roles.some(r => ['designer', 'finisher', 'admin', 'super_admin'].includes(r))) {
        addItem('Operations', { href: '/dashboard/queue', icon: IconQueue, label: 'Production Queue' });
    }

    // Admin/Super Admin management
    if (roles.some(r => ['admin', 'super_admin'].includes(r))) {
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

    useEffect(() => {
        if (!isLoggedIn()) {
            router.push('/');
            return;
        }
        setUserState(getUser());
    }, [router]);

    function handleLogout() {
        apiLogout();
        router.push('/');
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

            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-brand">PrintFlow</div>
                    <div className="sidebar-role">{formatRoles(user.roles || user.role)}</div>
                </div>

                <nav className="sidebar-nav">
                    {navSections.map((section, si) => (
                        <div key={si}>
                            <div className="nav-section-label">{section.section}</div>
                            {section.items.map(item => {
                                const NavIcon = item.icon;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`nav-link ${pathname === item.href ? 'active' : ''}`}
                                        onClick={() => setSidebarOpen(false)}
                                    >
                                        <span className="nav-link-icon"><NavIcon size={18} /></span>
                                        <span>{item.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="sidebar-avatar">{initials}</div>
                        <div className="sidebar-user-info">
                            <div className="sidebar-user-name">{user.display_name}</div>
                            <div className="sidebar-user-role">{formatRoles(user.roles || user.role)}</div>
                        </div>
                    </div>
                    <button
                        className="btn btn-ghost btn-full"
                        onClick={handleLogout}
                        style={{ marginTop: '8px', fontSize: '0.8125rem', gap: '6px' }}
                    >
                        <IconLogout size={16} /> Sign Out
                    </button>
                </div>
            </aside>

            <main className="main-content">
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
        </div>
    );
}
