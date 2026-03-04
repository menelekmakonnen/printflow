'use client';

import { useEffect, useState, useRef } from 'react';
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
import Image from 'next/image';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

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

    // Receptionist or Admin can see jobs & products
    if (roles.some(r => ['receptionist', 'admin', 'super_admin'].includes(r))) {
        addItem('Operations', { href: '/dashboard/jobs/new', icon: IconPlusCircle, label: 'New Job' });
        addItem('Operations', { href: '/dashboard/jobs', icon: IconClipboard, label: 'All Jobs' });
        addItem('Operations', { href: '/dashboard/products', icon: IconTag, label: 'Products & Services' });
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
        addItem('Management', { href: '/dashboard/expenses', icon: IconClipboard, label: 'Expenses Tracking' });
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
    const [isClient, setIsClient] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [systemLogo, setSystemLogo] = useState(null);
    const [systemLogoDark, setSystemLogoDark] = useState(null);
    const [systemFavicon, setSystemFavicon] = useState(null);
    const [companyName, setCompanyName] = useState('PrintFlow');

    // Profile Edit State
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [profileSaving, setProfileSaving] = useState(false);
    const [newAvatarBase64, setNewAvatarBase64] = useState('');
    const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });

    // Crop State
    const [cropImageSrc, setCropImageSrc] = useState(null);
    const [crop, setCrop] = useState();
    const [completedCrop, setCompletedCrop] = useState(null);
    const imgRef = useRef(null);

    // SVG Printer Scroll State
    const [scrollProgress, setScrollProgress] = useState(0);

    // Draft Floater State
    const [draftQuote, setDraftQuote] = useState(null);
    const [hideFloater, setHideFloater] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            const raw = localStorage.getItem('printflow_draft_job');
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (pathname === '/dashboard/jobs/new') {
                        const totalsEl = document.getElementById('order-totals-section');
                        if (totalsEl) {
                            const rect = totalsEl.getBoundingClientRect();
                            const isVisible = (rect.top <= (window.innerHeight || document.documentElement.clientHeight) && rect.bottom >= 0);
                            setHideFloater(isVisible);
                        } else {
                            setHideFloater(false);
                        }
                    } else {
                        setHideFloater(false);
                    }
                    if (parsed.lineItems && parsed.lineItems.length > 0) {
                        setDraftQuote(parsed);
                    } else {
                        setDraftQuote(null);
                    }
                } catch (e) { }
            } else {
                setDraftQuote(null);
            }
        }, 500);
        return () => clearInterval(interval);
    }, [pathname]);

    useEffect(() => {
        const handleScroll = () => {
            const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
            const clientHeight = document.documentElement.clientHeight || window.innerHeight;

            let progress = 0;
            if (scrollHeight > clientHeight) {
                progress = scrollTop / (scrollHeight - clientHeight);
            }
            setScrollProgress(Math.min(Math.max(progress, 0), 1));
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        if (!isLoggedIn()) {
            router.push('/');
            return;
        }
        setUserState(getUser());
        setIsClient(true);

        async function fetchLogo() {
            const res = await getConfig();
            if (res.success) {
                if (res.data.logo_base64) setSystemLogo(res.data.logo_base64);
                if (res.data.logo_dark_base64) setSystemLogoDark(res.data.logo_dark_base64);
                if (res.data.favicon_base64) setSystemFavicon(res.data.favicon_base64);
                if (res.data.company_name) setCompanyName(res.data.company_name);
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

            const lightIcon = systemFavicon || systemLogo || '/favicon.svg';
            const darkIcon = systemFavicon || systemLogoDark || '/favicon.svg';

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
        reader.addEventListener('load', () => setCropImageSrc(reader.result?.toString() || ''));
        reader.readAsDataURL(file);
    }

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
        setCropImageSrc(null);
        setNewAvatarBase64(base64Data);
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

    if (!isClient || !user) {
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
                    <Link href="/dashboard" style={{ display: 'block', textAlign: 'center', width: '100%', textDecoration: 'none' }}>
                        <svg width={sidebarCollapsed ? 32 : 48} height={sidebarCollapsed ? 32 : 48} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ margin: '0 auto' }}>
                            <defs>
                                <clipPath id="paperClip">
                                    <rect x="0" y="36" width="64" height="28" />
                                </clipPath>
                            </defs>
                            <rect x="6" y="26" width="52" height="24" rx="6" fill="var(--color-border-light)" />
                            <path d="M20 8H44V24H20V8Z" fill="var(--color-text-muted)" opacity="0.5" />
                            <rect x="8" y="24" width="48" height="24" rx="4" fill="var(--color-border)" />
                            <rect x="42" y="27" width="10" height="4" rx="1" fill="var(--brand-primary)" opacity="0.8" />
                            <circle cx="14" cy="29" r="2" fill="var(--color-completed)" />
                            <rect x="16" y="34" width="32" height="4" rx="2" fill="var(--color-bg-primary)" />
                            <g clipPath="url(#paperClip)">
                                <g transform={`translate(0, ${scrollProgress * 24})`}>
                                    <rect x="20" y="14" width="24" height="26" fill="#ffffff" />
                                    <path d="M24 20H40M24 26H40M24 32H34" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
                                </g>
                            </g>
                            <path d="M20 48H44L46 56H18L20 48Z" fill="var(--color-border-light)" opacity="0.8" />
                        </svg>
                        {!sidebarCollapsed && <div style={{ fontSize: '1rem', fontWeight: 'bold', marginTop: '4px', color: 'var(--color-text-primary)' }}>{companyName}</div>}
                    </Link>
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
                        <div className="sidebar-avatar" style={{ overflow: 'hidden', position: 'relative' }}>
                            {user.avatar_base64 ? (
                                <Image src={user.avatar_base64} alt="Avatar" fill style={{ objectFit: 'cover' }} unoptimized />
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

            {/* Draft Job Floater */}
            {draftQuote && !hideFloater && (
                <div style={{
                    position: 'fixed', bottom: '24px', right: '24px', background: 'var(--color-bg-card)',
                    padding: '16px 20px', borderRadius: 'var(--radius-lg)', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    border: '1px solid var(--brand-primary)', zIndex: 90, display: 'flex', flexDirection: 'column', gap: '4px',
                    animation: 'slideUp 0.3s ease-out'
                }}>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', marginBottom: '8px' }}>Draft Job Totals</div>

                    {draftQuote.computedItems && draftQuote.computedItems.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                            {draftQuote.computedItems.map((cItem, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '0.8125rem', color: 'var(--color-text-primary)' }}>
                                    <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                        <span>{cItem.quantity}x</span>
                                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>{cItem.name}</span>
                                        {cItem.designCost > 0 && <span style={{ color: 'var(--brand-primary)', fontSize: '0.7rem', fontWeight: 600 }}> (+Design)</span>}
                                    </span>
                                    <span>{'\u20B5'}{cItem.itemTotal.toFixed(2)}</span>
                                </div>
                            ))}
                            {draftQuote.standaloneDesign?.active && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '0.8125rem', color: 'var(--color-text-primary)' }}>
                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>Standalone Design Svc</span>
                                    <span>{'\u20B5'}{(draftQuote.standaloneDesign.total || 0).toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Subtotal</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{'\u20B5'}{(draftQuote.subtotal || 0).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--brand-primary)' }}>Final Total</span>
                            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--brand-primary)' }}>{'\u20B5'}{(draftQuote.finalTotal || 0).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            )}

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
                                overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                                fontSize: '2rem', fontWeight: 600, color: 'var(--color-text-muted)', border: '2px dashed var(--color-border)'
                            }}>
                                {newAvatarBase64 || user.avatar_base64 ? (
                                    <Image src={newAvatarBase64 || user.avatar_base64} alt="New Avatar Preview" fill style={{ objectFit: 'cover' }} unoptimized />
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

            {/* Profile Picture Crop Modal */}
            {cropImageSrc && (
                <div className="modal-overlay">
                    <div className="modal modal-content" style={{ maxWidth: '400px', display: 'flex', flexDirection: 'column' }}>
                        <div className="modal-header">
                            <h2>Crop Avatar</h2>
                            <button className="btn-icon" onClick={() => setCropImageSrc(null)}><IconX size={20} /></button>
                        </div>
                        <div className="modal-body" style={{ flex: 1, overflow: 'auto', background: '#000', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', justifyContent: 'center' }}>
                            <ReactCrop
                                crop={crop}
                                onChange={(_, percentCrop) => setCrop(percentCrop)}
                                onComplete={(c) => setCompletedCrop(c)}
                                aspect={1}
                                circularCrop
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
