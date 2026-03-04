'use client';

import React from 'react';
import { IconUsers, IconClipboard, IconScissors, IconDashboard, IconGear, IconShieldAlert, IconCheckCircle } from '@/lib/icons';

export default function RolesPage() {
    const rolesData = [
        {
            id: 'super_admin',
            title: 'Super Admin',
            icon: IconShieldAlert,
            color: 'var(--brand-primary)',
            bg: 'rgba(37, 99, 235, 0.08)',
            description: 'Unrestricted system access. Can modify global configurations, aesthetics, billing logic, and assign privileges to other accounts.',
            permissions: [
                'Full access to System Settings (Logos, Est. Tax, Currency)',
                'Ability to view and edit all Users and change Roles',
                'Create and modify Products & Services globally',
                'Disable global Quote Totals floater for any user',
                'View global Activity Logs'
            ]
        },
        {
            id: 'admin',
            title: 'Administrator',
            icon: IconCheckCircle,
            color: '#10b981',
            bg: 'rgba(16, 185, 129, 0.08)',
            description: 'Management access. Controls users, approvals, and has full visibility over the operations and accounting without touching system infrastructure.',
            permissions: [
                'View and filter all active and completed Jobs',
                'Access Accounting and Expense tracking',
                'Manage Stock and Inventory levels',
                'View Notification and Audit logs',
                'Approve pending Designs and release to Production'
            ]
        },
        {
            id: 'receptionist',
            title: 'Receptionist',
            icon: IconDashboard,
            color: '#f59e0b',
            bg: 'rgba(245, 158, 11, 0.08)',
            description: 'Front-desk operations. Primarily interacts with customers, handles cash, drafts quotes, and logs new incoming jobs.',
            permissions: [
                'Create New Jobs and Quotes',
                'Access the All Jobs list overview',
                'Read-only access to Products & Services',
                'View Stock limitations and Stock hub'
            ]
        },
        {
            id: 'designer',
            title: 'Designer',
            icon: IconClipboard,
            color: '#8b5cf6',
            bg: 'rgba(139, 92, 246, 0.08)',
            description: 'Creative department. Responsible for reviewing Job tickets, uploading drafts, and iterating on design feedback with customers.',
            permissions: [
                'Access to the combined Production Queue',
                'Upload PDF/JPG proofs and flag Jobs as "Awaiting Design Review"',
                'Receive customer feedback on digital proofs',
                'Pass approved designs onto Finishers'
            ]
        },
        {
            id: 'finisher',
            title: 'Finisher / Printer',
            icon: IconScissors,
            color: '#ec4899',
            bg: 'rgba(236, 72, 153, 0.08)',
            description: 'Production logic. Receives approved digital artwork and executes the physical printing or manufacturing.',
            permissions: [
                'Access to the Production Queue',
                'Download approved final artwork assets',
                'Mark physical products as "Processing Complete" / Ready for Pickup'
            ]
        }
    ];

    return (
        <div style={{ paddingBottom: '24px' }}>
            <div style={{ marginBottom: 'var(--space-xl)' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Roles & Privileges</h2>
                <p style={{ color: 'var(--color-text-muted)', maxWidth: '600px', lineHeight: 1.5 }}>
                    PrintFlow utilizes a multi-role authentication system. This means a single user account can hold multiple roles simultaneously, automatically combining their privileges across the dashboard. Review the manual below to understand what each privilege unlocks.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-lg)' }}>
                {rolesData.map(role => {
                    const RoleIcon = role.icon;
                    return (
                        <div key={role.id} className="card" style={{ borderTop: `4px solid ${role.color}`, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '12px',
                                    background: role.bg, color: role.color,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <RoleIcon size={24} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>{role.title}</h3>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>Role ID: {role.id}</div>
                                </div>
                            </div>

                            <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--color-text-primary)', marginBottom: '20px' }}>
                                {role.description}
                            </p>

                            <div style={{ marginTop: 'auto', background: '#f8fafc', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                                <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: '12px', fontWeight: 700 }}>Key Capabilities</h4>
                                <ul style={{ margin: 0, paddingLeft: '16px', color: 'var(--color-text-primary)', fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {role.permissions.map((perm, i) => (
                                        <li key={i} style={{ lineHeight: 1.4 }}>{perm}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={{ marginTop: 'var(--space-xl)', padding: 'var(--space-lg)', background: 'rgba(37, 99, 235, 0.05)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(37, 99, 235, 0.1)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '8px', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IconShieldAlert size={18} /> Role Inheritance & Logic
                </h3>
                <p style={{ fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--color-text-muted)' }}>
                    Permissions in PrintFlow are additive. If a user is assigned both <strong>Receptionist</strong> and <strong>Designer</strong> roles, they will see both the &quot;New Job&quot; interfaces as well as the &quot;Production Queue&quot;. Super Admins automatically inherit the functional equivalent of all administrative powers. If you are ever unsure why a user cannot see a specific tab, ensure their User Profile has the corresponding Role ID checked.
                </p>
            </div>
        </div >
    );
}
