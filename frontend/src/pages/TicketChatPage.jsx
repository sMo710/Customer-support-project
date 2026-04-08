import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { addAdminMessage, getTicketById, updateTicketStatus } from '../services/api';
import { subscribeToTicket } from '../services/socket';
import { formatTime } from '../utils/timeUtils';

const TicketChatPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [ticket, setTicket] = useState(null);
    const [messages, setMessages] = useState([]);
    const [adminInput, setAdminInput] = useState('');
    const [sending, setSending] = useState(false);
    const [loadError, setLoadError] = useState('');

    useEffect(() => {
        const load = async () => {
            try {
                const res = await getTicketById(id);
                setTicket(res.data.ticket);
                setMessages(res.data.messages || []);
                setLoadError('');
            } catch (e) {
                setLoadError('Unable to load ticket details right now. Please retry from dashboard.');
            }
        };
        load();
    }, [id]);

    useEffect(() => {
        const unsubscribe = subscribeToTicket(id, (payload) => {
            if (!payload) return;

            if (payload.status) {
                setTicket((prev) => (prev ? { ...prev, status: payload.status } : prev));
            }

            if (payload.message) {
                setMessages((prev) => {
                    if (payload.id && prev.some((m) => m.id === payload.id)) return prev;
                    return [...prev, {
                        id: payload.id,
                        sender: payload.sender,
                        message: payload.message,
                        timestamp: payload.timestamp || new Date(),
                    }];
                });
            }
        });
        return () => unsubscribe();
    }, [id]);

    const sendAdminReply = async () => {
        const trimmed = adminInput.trim();
        if (!trimmed) return;
        setSending(true);
        try {
            const res = await addAdminMessage(id, trimmed);
            const newMessages = res.data?.messages || [];
            setMessages((prev) => {
                const merged = [...prev];
                newMessages.forEach((m) => {
                    if (!merged.some((x) => x.id === m.id)) merged.push(m);
                });
                return merged;
            });
            setAdminInput('');
        } finally {
            setSending(false);
        }
    };

    const setStatus = async (status) => {
        try {
            await updateTicketStatus(id, status);
            setTicket((prev) => (prev ? { ...prev, status } : prev));
        } catch (e) {
            // ignore and keep current state
        }
    };

    return (
        <div className="app-bg" style={styles.page}>
            <div style={styles.overlay} />
            <div style={styles.shell}>
                <div className="glass-header" style={styles.header}>
                    <button className="glass-button" style={styles.backBtn} onClick={() => navigate('/admin')}>Back</button>
                    <div style={styles.titleBlock}>
                        <div style={styles.title}>Ticket #{id}</div>
                        <div style={styles.subtitle}>{ticket?.query || 'Loading...'}</div>
                    </div>
                    <div style={styles.statusGroup}>
                        {['OPEN', 'RESOLVED', 'NEEDS_HUMAN'].map((status) => (
                            <button
                                className="glass-button"
                                key={status}
                                style={{
                                    ...styles.statusBtn,
                                    ...(ticket?.status === status ? styles.statusBtnActive : {}),
                                }}
                                onClick={() => setStatus(status)}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="glass-panel" style={styles.chat}>
                    {loadError && (
                        <div style={styles.errorBanner}>{loadError}</div>
                    )}
                    {messages.map((msg, index) => (
                        <div
                            key={msg.id || index}
                            style={{
                                ...styles.row,
                                justifyContent: msg.sender === 'USER' ? 'flex-end' : 'flex-start',
                            }}
                        >
                            <div
                                className={
                                    msg.sender === 'USER'
                                        ? 'chat-bubble chat-bubble-user'
                                        : msg.sender === 'ADMIN'
                                            ? 'chat-bubble chat-bubble-admin'
                                            : msg.sender === 'SYSTEM'
                                                ? 'chat-bubble chat-bubble-system'
                                                : 'chat-bubble chat-bubble-ai'
                                }
                                style={{
                                    borderRadius:
                                        msg.sender === 'USER' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                }}
                            >
                                <div style={styles.sender}>{msg.sender}</div>
                                <div
                                    dangerouslySetInnerHTML={{
                                        __html: renderMessageHtml(msg.message),
                                    }}
                                />
                                <div style={styles.time}>{formatTime(msg.timestamp)}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="glass-panel" style={styles.inputBar}>
                    <input
                        className="glass-input"
                        style={styles.input}
                        value={adminInput}
                        placeholder="Type admin reply..."
                        onChange={(e) => setAdminInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !sending) sendAdminReply();
                        }}
                    />
                    <button className="glass-button" style={styles.sendBtn} onClick={sendAdminReply} disabled={sending || !adminInput.trim()}>
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};

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
        minHeight: '100vh',
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
        gap: 12,
        padding: 16,
    },
    header: {
        ...glass,
        borderRadius: 16,
        padding: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        justifyContent: 'space-between',
    },
    backBtn: {
        border: '1px solid rgba(255,255,255,0.35)',
        background: 'transparent',
        color: '#fff',
        borderRadius: 10,
        padding: '8px 12px',
        cursor: 'pointer',
    },
    titleBlock: { minWidth: 0, flex: 1 },
    title: { fontWeight: 700, color: '#fff' },
    subtitle: { fontSize: 12, color: 'rgba(232,245,255,0.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    statusGroup: { display: 'flex', gap: 8 },
    statusBtn: {
        border: '1px solid rgba(255,255,255,0.28)',
        borderRadius: 8,
        background: 'rgba(255,255,255,0.1)',
        color: '#eaf7ff',
        padding: '7px 10px',
        cursor: 'pointer',
        fontSize: 12,
    },
    statusBtnActive: {
        background: 'rgba(72,202,228,0.3)',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.45)',
    },
    chat: {
        ...glass,
        borderRadius: 14,
        overflowY: 'auto',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
    },
    row: { display: 'flex' },
    errorBanner: {
        border: '1px solid rgba(255, 99, 132, 0.45)',
        background: 'rgba(255, 99, 132, 0.18)',
        color: '#fff',
        borderRadius: 10,
        padding: '10px 12px',
        fontSize: 13,
    },
    sender: { fontSize: 11, fontWeight: 700, marginBottom: 4, opacity: 0.8 },
    time: { fontSize: 11, opacity: 0.6, marginTop: 6 },
    inputBar: {
        ...glass,
        borderRadius: 14,
        padding: 12,
        display: 'flex',
        gap: 10,
    },
    input: {
        flex: 1,
        borderRadius: 999,
        padding: '10px 14px',
        fontSize: 14,
        boxSizing: 'border-box',
    },
    sendBtn: {
        border: '1px solid rgba(255,255,255,0.35)',
        background: 'rgba(2,62,138,0.8)',
        color: '#fff',
        borderRadius: 999,
        padding: '10px 16px',
        cursor: 'pointer',
    },
};

const renderMessageHtml = (text) => {
    if (!text) return '';
    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
};

export default TicketChatPage;
