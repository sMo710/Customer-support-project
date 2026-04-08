import React, { useEffect, useMemo, useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { getAllTickets } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS = {
    OPEN: '#0077b6',
    RESOLVED: '#2ecc71',
    NEEDS_HUMAN: '#e63946',
};

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit' });
const AXIS_STYLE = { stroke: 'rgba(255,255,255,0.9)', tick: { fontSize: 12 } };

const AnalyticsPage = () => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { logoutUser } = useAuth();

    useEffect(() => {
        const fetchTickets = async () => {
            try {
                const response = await getAllTickets();
                setTickets(response.data || []);
            } catch (err) {
                console.error('Error fetching tickets:', err);
                setTickets([]);
            } finally {
                setLoading(false);
            }
        };

        fetchTickets();
    }, []);

    const metrics = useMemo(() => {
        const total = tickets.length;
        const statusCounts = tickets.reduce(
            (acc, ticket) => {
                if (ticket.status === 'OPEN') acc.open += 1;
                else if (ticket.status === 'RESOLVED') acc.resolved += 1;
                else if (ticket.status === 'NEEDS_HUMAN') acc.needsHuman += 1;
                return acc;
            },
            { open: 0, resolved: 0, needsHuman: 0 }
        );
        const { open, resolved, needsHuman } = statusCounts;
        const resolutionRate = total ? ((resolved / total) * 100).toFixed(1) : '0.0';
        const escalationRate = total ? ((needsHuman / total) * 100).toFixed(1) : '0.0';

        return { total, open, resolved, needsHuman, resolutionRate, escalationRate };
    }, [tickets]);

    const dailySeries = useMemo(() => {
        const grouped = tickets.reduce((acc, ticket) => {
            const date = new Date(ticket.createdAt);
            if (Number.isNaN(date.getTime())) return acc;
            const key = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

        return Object.entries(grouped)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([time, count]) => ({
                date: DATE_FORMATTER.format(new Date(Number(time))),
                count,
            }));
    }, [tickets]);

    const cumulativeSeries = useMemo(() => {
        let running = 0;
        return dailySeries.map((item) => {
            running += item.count;
            return { date: item.date, total: running };
        });
    }, [dailySeries]);

    const pieData = useMemo(
        () => [
            { name: 'OPEN', value: metrics.open },
            { name: 'RESOLVED', value: metrics.resolved },
            { name: 'NEEDS_HUMAN', value: metrics.needsHuman },
        ],
        [metrics]
    );

    const summaryData = useMemo(
        () => [
            { label: 'Open', key: 'OPEN', value: metrics.open },
            { label: 'Resolved', key: 'RESOLVED', value: metrics.resolved },
            { label: 'Needs Human', key: 'NEEDS_HUMAN', value: metrics.needsHuman },
        ],
        [metrics]
    );

    return (
        <div className="app-bg" style={styles.page}>
            <div style={styles.overlay} />
            <div style={styles.shell}>
                <header className="glass-header" style={styles.header}>
                    <div>
                        <h1 style={styles.title}>Analytics Dashboard</h1>
                        <p style={styles.subtitle}>Ticket Insights & Trends</p>
                    </div>
                    <div style={styles.headerActions}>
                        <button style={styles.navBtn} onClick={() => navigate('/admin')}>
                            Go to Admin
                        </button>
                        <button
                            style={styles.logoutBtn}
                            onClick={() => {
                                logoutUser();
                                navigate('/login');
                            }}
                        >
                            Logout
                        </button>
                    </div>
                </header>

                {loading ? (
                    <div className="glass-panel" style={styles.loadingCard}>Loading analytics...</div>
                ) : (
                    <>
                        <section style={styles.kpiGrid}>
                            <KpiCard title="Total Tickets" value={metrics.total} accent="#48cae4" />
                            <KpiCard title="Resolution Rate" value={`${metrics.resolutionRate}%`} accent="#2ecc71" />
                            <KpiCard title="Escalation Rate" value={`${metrics.escalationRate}%`} accent="#e63946" />
                            <KpiCard title="Open Tickets" value={metrics.open} accent="#0077b6" />
                        </section>

                        <section style={styles.chartGrid}>
                            <div className="glass-card" style={styles.card}>
                                <h3 style={styles.cardTitle}>Ticket Status Distribution</h3>
                                <div style={styles.chartHeight}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={pieData}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={55}
                                                outerRadius={95}
                                                paddingAngle={2}
                                                animationDuration={650}
                                            >
                                                {pieData.map((entry) => (
                                                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={styles.tooltip} />
                                            <Legend wrapperStyle={{ color: '#fff' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="glass-card" style={styles.card}>
                                <h3 style={styles.cardTitle}>Tickets Per Day</h3>
                                <div style={styles.chartHeight}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={dailySeries}>
                                            <CartesianGrid stroke="rgba(255,255,255,0.2)" vertical={false} />
                                            <XAxis dataKey="date" {...AXIS_STYLE} />
                                            <YAxis {...AXIS_STYLE} />
                                            <Tooltip contentStyle={styles.tooltip} />
                                            <Bar dataKey="count" fill="#48cae4" radius={[8, 8, 0, 0]} animationDuration={650} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="glass-card" style={styles.card}>
                                <h3 style={styles.cardTitle}>Cumulative Tickets Over Time</h3>
                                <div style={styles.chartHeight}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={cumulativeSeries}>
                                            <CartesianGrid stroke="rgba(255,255,255,0.2)" vertical={false} />
                                            <XAxis dataKey="date" {...AXIS_STYLE} />
                                            <YAxis {...AXIS_STYLE} />
                                            <Tooltip contentStyle={styles.tooltip} />
                                            <Line
                                                type="monotone"
                                                dataKey="total"
                                                stroke="#0077b6"
                                                strokeWidth={3}
                                                dot={{ r: 3, fill: '#48cae4' }}
                                                activeDot={{ r: 6 }}
                                                animationDuration={700}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="glass-card" style={styles.card}>
                                <h3 style={styles.cardTitle}>Status Summary</h3>
                                <div style={styles.summaryList}>
                                    {summaryData.map((item) => {
                                        const percentage = metrics.total ? (item.value / metrics.total) * 100 : 0;
                                        return (
                                            <div key={item.key} style={styles.summaryItem}>
                                                <div style={styles.summaryTop}>
                                                    <div style={styles.summaryLabelWrap}>
                                                        <span
                                                            style={{
                                                                ...styles.summaryDot,
                                                                background: STATUS_COLORS[item.key],
                                                            }}
                                                        />
                                                        <span style={styles.summaryLabel}>{item.label}</span>
                                                    </div>
                                                    <span style={styles.summaryValue}>
                                                        {item.value} ({percentage.toFixed(1)}%)
                                                    </span>
                                                </div>
                                                <div style={styles.progressTrack}>
                                                    <div
                                                        style={{
                                                            ...styles.progressFill,
                                                            width: `${percentage}%`,
                                                            background: STATUS_COLORS[item.key],
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </section>
                    </>
                )}
            </div>
        </div>
    );
};

const glass = {
    background: 'rgba(255,255,255,0.15)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.2)',
    boxShadow: '0 12px 32px rgba(2,62,138,0.28)',
};

const styles = {
    page: {
        minHeight: '100vh',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
    },
    overlay: {
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(2,62,138,0.12))',
    },
    shell: {
        position: 'relative',
        zIndex: 1,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        minHeight: '100vh',
    },
    header: {
        ...glass,
        borderRadius: 16,
        padding: '14px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
    },
    title: { margin: 0, fontSize: 24, fontWeight: 700 },
    subtitle: { margin: '4px 0 0 0', fontSize: 13, color: 'rgba(240,248,255,0.9)' },
    headerActions: { display: 'flex', gap: 10, alignItems: 'center' },
    navBtn: {
        border: '1px solid rgba(255,255,255,0.35)',
        background: 'rgba(0,119,182,0.75)',
        color: '#fff',
        borderRadius: 10,
        padding: '8px 12px',
        cursor: 'pointer',
    },
    logoutBtn: {
        border: '1px solid rgba(255,255,255,0.35)',
        background: 'transparent',
        color: '#fff',
        borderRadius: 10,
        padding: '8px 12px',
        cursor: 'pointer',
    },
    loadingCard: {
        ...glass,
        borderRadius: 16,
        padding: 20,
        textAlign: 'center',
        color: 'rgba(240,248,255,0.95)',
    },
    kpiGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 12,
    },
    kpiCard: {
        ...glass,
        borderRadius: 16,
        padding: 14,
    },
    kpiValue: { fontSize: 28, fontWeight: 700, color: '#fff' },
    kpiLabel: { marginTop: 3, fontSize: 13, color: 'rgba(240,248,255,0.9)' },
    kpiAccent: { marginTop: 10, height: 3, borderRadius: 999 },
    chartGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 12,
    },
    card: {
        ...glass,
        borderRadius: 16,
        padding: 14,
        minHeight: 300,
    },
    cardTitle: { margin: 0, marginBottom: 10, fontSize: 15, fontWeight: 600, color: '#fff' },
    chartHeight: { height: 250 },
    tooltip: {
        background: '#fff',
        border: '1px solid #dbe5ef',
        color: '#0f172a',
        borderRadius: 10,
        fontSize: 12,
    },
    summaryList: { display: 'flex', flexDirection: 'column', gap: 14, marginTop: 6 },
    summaryItem: { display: 'flex', flexDirection: 'column', gap: 8 },
    summaryTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    summaryLabelWrap: { display: 'flex', alignItems: 'center', gap: 8 },
    summaryDot: { width: 10, height: 10, borderRadius: '50%' },
    summaryLabel: { fontSize: 13, color: '#fff' },
    summaryValue: { fontSize: 12, color: 'rgba(240,248,255,0.92)' },
    progressTrack: {
        width: '100%',
        height: 8,
        borderRadius: 999,
        background: 'rgba(255,255,255,0.25)',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 999,
        transition: 'width 0.3s ease',
    },
};

const KpiCard = ({ title, value, accent }) => (
    <div className="glass-card" style={styles.kpiCard}>
        <div style={styles.kpiValue}>{value}</div>
        <div style={styles.kpiLabel}>{title}</div>
        <div style={{ ...styles.kpiAccent, background: accent }} />
    </div>
);

export default AnalyticsPage;