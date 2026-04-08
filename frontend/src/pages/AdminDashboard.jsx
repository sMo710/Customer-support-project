import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllTickets, getTicketStats } from '../services/api';
import { formatTime } from '../utils/timeUtils';
import { useAuth } from '../context/AuthContext';

const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'tickets', label: 'Tickets', icon: '🎫' },
];

const statusColor = (status) => {
    switch (status) {
        case 'RESOLVED':
            return '#2ecc71';
        case 'NEEDS_HUMAN':
            return '#e63946';
        default:
            return '#0077b6';
    }
};

const AdminDashboard = () => {
    const [tickets, setTickets] = useState([]);
    const [stats, setStats] = useState({ OPEN: 0, RESOLVED: 0, NEEDS_HUMAN: 0 });
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [ticketIdFilter, setTicketIdFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { logoutUser } = useAuth();

    const loadDashboardData = useCallback(async () => {
        const [ticketsRes, statsRes] = await Promise.all([getAllTickets(), getTicketStats()]);
        setTickets(ticketsRes.data || []);
        setStats(statsRes.data || { OPEN: 0, RESOLVED: 0, NEEDS_HUMAN: 0 });
    }, []);

    useEffect(() => {
        const load = async () => {
            try {
                await loadDashboardData();
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [loadDashboardData]);

    const filteredTickets = useMemo(() => {
        const key = search.trim().toLowerCase();
        const idKey = ticketIdFilter.trim();
        return tickets.filter((ticket) => {
            const matchesSearch = !key || (`${ticket.id} ${ticket.query} ${ticket.status}`).toLowerCase().includes(key);
            const matchesStatus = statusFilter === 'ALL' || ticket.status === statusFilter;
            const matchesId = !idKey || String(ticket.id).includes(idKey);
            return matchesSearch && matchesStatus && matchesId;
        });
    }, [tickets, search, statusFilter, ticketIdFilter]);
    const activeTickets = useMemo(
        () => filteredTickets.filter((ticket) => ticket.status !== 'RESOLVED'),
        [filteredTickets]
    );
    const resolvedTickets = useMemo(
        () => filteredTickets.filter((ticket) => ticket.status === 'RESOLVED'),
        [filteredTickets]
    );

    const total = (stats.OPEN || 0) + (stats.RESOLVED || 0) + (stats.NEEDS_HUMAN || 0);

    return (
        <div className="app-bg" style={styles.page}>
            <div style={styles.overlay} />
            <div style={styles.shell}>
                <aside className="glass-panel" style={styles.sidebar}>
                    <div style={styles.brand}>Bonsai</div>
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            style={{
                                ...styles.navItem,
                                ...(item.id === 'dashboard' || item.id === 'tickets' ? styles.navItemActive : {}),
                            }}
                            onClick={() => {
                                if (item.id === 'analytics') navigate('/analytics');
                            }}
                        >
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                        </button>
                    ))}
                    <div style={styles.filterBox}>
                        <div style={styles.filterTitle}>Filters</div>
                        <label style={styles.filterLabel}>Status</label>
                        <select
                            style={styles.filterSelect}
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="ALL" style={styles.filterOption}>All</option>
                            <option value="OPEN" style={styles.filterOption}>Open</option>
                            <option value="NEEDS_HUMAN" style={styles.filterOption}>Needs Human</option>
                            <option value="RESOLVED" style={styles.filterOption}>Resolved</option>
                        </select>
                        <label style={styles.filterLabel}>Ticket ID</label>
                        <input
                            style={styles.filterInput}
                            placeholder="e.g. 101"
                            value={ticketIdFilter}
                            onChange={(e) => setTicketIdFilter(e.target.value.replace(/\D/g, ''))}
                        />
                        <button
                            style={styles.clearFilterBtn}
                            onClick={() => {
                                setStatusFilter('ALL');
                                setTicketIdFilter('');
                            }}
                        >
                            Clear Filters
                        </button>
                    </div>
                </aside>

                <main style={styles.main}>
                    <header className="glass-header" style={styles.header}>
                        <div style={styles.searchWrap}>
                            <span>🔎</span>
                            <input
                                style={styles.searchInput}
                                placeholder="Search tickets..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div style={styles.headerRight}>
                            <button style={styles.analyticsBtn} onClick={() => navigate('/analytics')}>
                                Analytics
                            </button>
                            <div style={styles.profile}>A</div>
                            <button style={styles.logoutBtn} onClick={() => { logoutUser(); navigate('/login'); }}>
                                Logout
                            </button>
                        </div>
                    </header>

                    <section style={styles.cardsGrid}>
                        <StatCard title="Total Tickets" value={total} accent="#48cae4" />
                        <StatCard title="Open" value={stats.OPEN || 0} accent="#0077b6" />
                        <StatCard title="Resolved" value={stats.RESOLVED || 0} accent="#2ecc71" />
                        <StatCard title="Needs Human" value={stats.NEEDS_HUMAN || 0} accent="#e63946" />
                    </section>

                    <section style={styles.contentSingle}>
                        <div className="glass-panel" style={styles.panel}>
                            <h3 style={styles.panelTitle}>Active Tickets</h3>
                            {loading ? (
                                <div style={styles.muted}>Loading...</div>
                            ) : activeTickets.length === 0 ? (
                                <div style={styles.muted}>No active tickets.</div>
                            ) : (
                                activeTickets.map((ticket) => (
                                    <button
                                        key={ticket.id}
                                        style={styles.ticketItem}
                                        onClick={() => navigate(`/admin/tickets/${ticket.id}`)}
                                    >
                                        <div style={styles.ticketTop}>
                                            <strong>#{ticket.id}</strong>
                                            <span style={{ ...styles.statusBadge, background: statusColor(ticket.status) }}>
                                                {ticket.status}
                                            </span>
                                        </div>
                                        <div style={styles.ticketQuery}>{ticket.query}</div>
                                        <div style={styles.ticketTime}>{formatTime(ticket.createdAt)}</div>
                                    </button>
                                ))
                            )}
                        </div>

                        <div className="glass-panel" style={styles.panel}>
                            <h3 style={styles.panelTitle}>Resolved Tickets</h3>
                            {loading ? (
                                <div style={styles.muted}>Loading...</div>
                            ) : resolvedTickets.length === 0 ? (
                                <div style={styles.muted}>No resolved tickets yet.</div>
                            ) : (
                                resolvedTickets.map((ticket) => (
                                    <button
                                        key={ticket.id}
                                        style={styles.ticketItem}
                                        onClick={() => navigate(`/admin/tickets/${ticket.id}`)}
                                    >
                                        <div style={styles.ticketTop}>
                                            <strong>#{ticket.id}</strong>
                                            <span style={{ ...styles.statusBadge, background: statusColor(ticket.status) }}>
                                                {ticket.status}
                                            </span>
                                        </div>
                                        <div style={styles.ticketQuery}>{ticket.query}</div>
                                        <div style={styles.ticketTime}>{formatTime(ticket.createdAt)}</div>
                                    </button>
                                ))
                            )}
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
};

const StatCard = ({ title, value, accent }) => (
    <div className="glass-card" style={{ ...styles.card, borderTop: `3px solid ${accent}` }}>
        <div style={styles.cardValue}>{value}</div>
        <div style={styles.cardTitle}>{title}</div>
    </div>
);

const glass = {
    background: 'rgba(255,255,255,0.1)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    boxShadow: '0 10px 30px rgba(2,62,138,0.25)',
    border: '1px solid rgba(255,255,255,0.18)',
};

const styles = {
    page: {
        minHeight: '100vh',
        position: 'relative',
        color: '#f8fbff',
        overflow: 'hidden',
    },
    overlay: {
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(2,62,138,0.08))',
    },
    shell: {
        position: 'relative',
        zIndex: 1,
        display: 'grid',
        gridTemplateColumns: '260px 1fr',
        gap: 16,
        padding: 16,
        minHeight: '100vh',
    },
    sidebar: {
        ...glass,
        borderRadius: 16,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
    },
    brand: { fontSize: 22, fontWeight: 700, marginBottom: 12, color: '#ffffff' },
    navItem: {
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'transparent',
        color: '#dff5ff',
        borderRadius: 12,
        padding: '10px 12px',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    navItemActive: { background: 'rgba(72,202,228,0.25)', color: '#ffffff' },
    filterBox: {
        marginTop: 10,
        borderTop: '1px solid rgba(255,255,255,0.2)',
        paddingTop: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    filterTitle: { fontSize: 14, fontWeight: 700, color: '#ffffff' },
    filterLabel: { fontSize: 12, color: 'rgba(245, 248, 251, 0.9)' },
    filterInput: {
        background: 'rgba(255,255,255,0.15)',
        border: '1px solid rgba(255,255,255,0.22)',
        color: 'rgba(245, 248, 251, 0.9)',
        borderRadius: 8,
        padding: '8px 10px',
        outline: 'none',
    },
    filterSelect: {
        background: 'rgba(255,255,255,0.15)',
        border: '1px solid rgba(255,255,255,0.22)',
        color: 'rgba(245, 248, 251, 0.95)',
        borderRadius: 8,
        padding: '8px 10px',
        outline: 'none',
    },
    filterOption: {
        background: '#ffffff',
        color: '#0b3558',
    },
    clearFilterBtn: {
        border: '1px solid rgba(255,255,255,0.35)',
        background: 'transparent',
        color: '#fff',
        borderRadius: 8,
        padding: '8px 10px',
        cursor: 'pointer',
    },
    main: { display: 'flex', flexDirection: 'column', gap: 16 },
    header: {
        ...glass,
        borderRadius: 16,
        padding: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    searchWrap: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(255,255,255,0.16)',
        borderRadius: 999,
        padding: '8px 12px',
        width: 'min(520px, 100%)',
    },
    searchInput: { flex: 1, background: 'transparent', border: 'none', color: '#fff', outline: 'none' },
    headerRight: { display: 'flex', alignItems: 'center', gap: 10 },
    analyticsBtn: {
        border: '1px solid rgba(255,255,255,0.35)',
        background: 'rgba(0,119,182,0.55)',
        color: '#fff',
        borderRadius: 10,
        padding: '8px 10px',
        cursor: 'pointer',
        fontWeight: 600,
    },
    profile: { width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(72,202,228,0.35)', fontWeight: 700 },
    logoutBtn: { border: '1px solid rgba(255,255,255,0.35)', background: 'transparent', color: '#fff', borderRadius: 10, padding: '8px 10px', cursor: 'pointer' },
    cardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 },
    card: { ...glass, borderRadius: 14, padding: 14 },
    cardValue: { fontSize: 28, fontWeight: 700, color: '#fff' },
    cardTitle: { fontSize: 13, color: 'rgba(240,248,255,0.9)' },
    contentSingle: { display: 'grid', gridTemplateColumns: '1fr', gap: 12, flex: 1, minHeight: 0 },
    panel: { ...glass, borderRadius: 14, padding: 14, minHeight: 0, overflow: 'auto' },
    panelTitle: { marginTop: 0, marginBottom: 12, color: '#fff' },
    muted: { color: 'rgba(240,248,255,0.85)' },
    ticketItem: {
        width: '100%',
        border: '1px solid rgba(255,255,255,0.16)',
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: 10,
        marginBottom: 10,
        textAlign: 'left',
        color: '#fff',
        cursor: 'pointer',
        transition: 'transform 0.15s ease, background 0.2s ease',
    },
    ticketTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    statusBadge: { color: '#fff', borderRadius: 999, fontSize: 11, padding: '4px 8px', fontWeight: 600 },
    ticketQuery: { color: 'rgba(244,251,255,0.95)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    ticketTime: { color: 'rgba(232,245,255,0.75)', fontSize: 12 },
};

export default AdminDashboard;
