import React, { useState, useEffect, useRef } from 'react';
import { createTicket, addMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatTime } from '../utils/timeUtils';
import { subscribeToTicket } from '../services/socket';
import GlassButton from '../components/ui/GlassButton';

const mergeUniqueMessages = (existing, incoming) => {
    const merged = [...existing];
    incoming.forEach((msg) => {
        const incomingId = msg?.id != null ? String(msg.id) : null;
        const existsById = incomingId != null && merged.some((m) => m?.id != null && String(m.id) === incomingId);
        if (existsById) return;

        // Fallback de-duplication when id is missing/inconsistent.
        const existsByContent = merged.some(
            (m) => m.sender === msg.sender
                && m.message === msg.message
                && String(m.timestamp) === String(msg.timestamp)
        );
        if (!existsByContent) merged.push(msg);
    });
    return merged;
};

const renderMessageHtml = (text) => {
    if (!text) return '';
    // Escape basic HTML to avoid injection, then re-apply our simple bold formatting.
    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    // Convert **bold** to <strong>bold</strong>
    return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
};

const ChatPage = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [ticketId, setTicketId] = useState(null);
    const messagesEndRef = useRef(null);
    const { user, logoutUser } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (!ticketId) return undefined;

        const unsubscribe = subscribeToTicket(ticketId, (payload) => {
            if (!payload || payload.sender === 'USER') return;

            setMessages((prev) => {
                const incoming = [{
                    id: payload.id,
                    sender: payload.sender,
                    message: payload.message,
                    timestamp: payload.timestamp || new Date(),
                }];
                return mergeUniqueMessages(prev, incoming);
            });
        });

        return () => unsubscribe();
    }, [ticketId]);

    const sendMessage = async () => {
        if (!input.trim()) return;

        const userMsg = {
            sender: 'USER',
            message: input,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const userId = user?.id || 1;
            let response;

            if (!ticketId) {
                response = await createTicket(input, userId);
                const data = response.data;
                setTicketId(data.ticket.id);
                const aiMessages = data.messages.filter((m) => m.sender === 'AI');
                if (aiMessages.length > 0) {
                    setMessages((prev) => mergeUniqueMessages(prev, aiMessages));
                }
                if (data.ticket.status === 'NEEDS_HUMAN') {
                    setMessages((prev) => [
                        ...prev,
                        {
                            sender: 'SYSTEM',
                            message: 'Your query has been escalated to a human agent.',
                            timestamp: new Date(),
                        },
                    ]);
                }
            } else {
                response = await addMessage(ticketId, input);
                const data = response.data;
                const aiMessages = data.messages.filter((m) => m.sender === 'AI');
                if (aiMessages.length > 0) {
                    setMessages((prev) => mergeUniqueMessages(prev, aiMessages));
                }
            }
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                {
                    sender: 'SYSTEM',
                    message: 'Something went wrong. Please try again.',
                    timestamp: new Date(),
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="app-bg" style={styles.container}>
            {/* Header */}
            <div className="glass-header" style={styles.header}>
                <div style={styles.headerLeft}>
                    <div style={styles.logo}>MX</div>
                    <div>
                        <div style={styles.headerTitle}>Bonsai Support</div>
                        <div style={styles.headerStatus}>
                            <div style={styles.statusDot} />
                            Online
                        </div>
                    </div>
                </div>
                <div style={styles.headerRight}>
          <span style={styles.username}>
            {user?.username || 'User'}
          </span>
                    <button
                        style={styles.newChatBtn}
                        onClick={() => { setMessages([]); setTicketId(null); }}
                    >
                        New Chat
                    </button>
                    <button
                        style={styles.logoutBtn}
                        onClick={() => { logoutUser(); navigate('/login'); }}
                    >
                        Logout
                    </button>
                </div>
            </div>

            {/* Ticket Banner */}
            {ticketId && (
                <div style={styles.ticketBanner}>
                    <div style={styles.ticketDot} />
                    Ticket #{ticketId} — All messages in this conversation are linked
                </div>
            )}

            {/* Messages */}
            <div className="glass-panel" style={styles.messagesContainer}>
                {messages.length === 0 && (
                    <div style={styles.emptyState}>
                        <div style={styles.emptyIconWrapper}>
                            <div style={styles.emptyIcon}>MX</div>
                        </div>
                        <div style={styles.emptyTitle}>Hi! How can we help you today?</div>
                        <div style={styles.emptySubtitle}>
                            Type your message below to get started.
                        </div>
                        <div style={styles.suggestionsRow}>
                            {['Where is my order?', 'I need a refund', 'Track my shipment'].map((s) => (
                                <button
                                    key={s}
                                    style={styles.suggestionBtn}
                                    onClick={() => setInput(s)}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, index) => (
                    <div
                        key={msg.id ?? `${msg.sender}-${msg.timestamp}-${index}`}
                        style={{
                            ...styles.messageRow,
                            justifyContent: msg.sender === 'USER' ? 'flex-end' : 'flex-start',
                        }}
                    >
                        {msg.sender !== 'USER' && (
                            <div style={styles.aiAvatar}>
                                {msg.sender === 'AI' ? 'AI' : '!'}
                            </div>
                        )}
                        <div
                            className={
                                msg.sender === 'USER'
                                    ? 'chat-bubble chat-bubble-user'
                                    : msg.sender === 'SYSTEM'
                                        ? 'chat-bubble chat-bubble-system'
                                        : 'chat-bubble chat-bubble-ai'
                            }
                            style={{
                                ...styles.messageBubble,
                                borderRadius:
                                    msg.sender === 'USER'
                                        ? '18px 18px 4px 18px'
                                        : '18px 18px 18px 4px',
                            }}
                        >
                            <div
                                style={styles.messageText}
                                dangerouslySetInnerHTML={{ __html: renderMessageHtml(msg.message) }}
                            />
                            <div
                                style={{
                                    ...styles.messageTime,
                                    color:
                                        msg.sender === 'USER'
                                            ? 'rgba(255,255,255,0.6)'
                                            : '#94a3b8',
                                }}
                            >
                                {formatTime(msg.timestamp)}
                            </div>
                        </div>
                    </div>
                ))}

                {loading && (
                    <div style={styles.messageRow}>
                        <div style={styles.aiAvatar}>AI</div>
                        <div className="chat-bubble chat-bubble-ai" style={styles.messageBubble}>
                            <div style={styles.typingDots}>
                                <span style={styles.dot}>•</span>
                                <span style={styles.dot}>•</span>
                                <span style={styles.dot}>•</span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="glass-panel" style={styles.inputContainer}>
                <input
                    className="glass-input"
                    style={styles.input}
                    type="text"
                    placeholder="Type your message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !loading && sendMessage()}
                    disabled={loading}
                />
                <GlassButton
                    style={{ ...styles.sendBtn, opacity: loading || !input.trim() ? 0.6 : 1 }}
                    onClick={sendMessage}
                    disabled={loading || !input.trim()}
                >
                    Send
                </GlassButton>
            </div>
        </div>
    );
};

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
    },
    header: {
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    logo: {
        width: '40px',
        height: '40px',
        borderRadius: '12px',
        background: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: '700',
        color: '#023e8a',
        fontSize: '14px',
    },
    headerTitle: {
        fontWeight: '600',
        color: 'white',
        fontSize: '15px',
    },
    headerStatus: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        color: 'rgba(255,255,255,0.7)',
        marginTop: '2px',
    },
    statusDot: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: '#48cae4',
    },
    headerRight: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
    },
    username: {
        fontSize: '13px',
        color: 'rgba(255,255,255,0.8)',
    },
    newChatBtn: {
        background: 'rgba(255,255,255,0.15)',
        border: '1px solid rgba(255,255,255,0.3)',
        color: 'white',
        padding: '6px 14px',
        borderRadius: '8px',
        fontSize: '13px',
        cursor: 'pointer',
    },
    logoutBtn: {
        background: 'transparent',
        border: '1px solid rgba(255,255,255,0.3)',
        color: 'white',
        padding: '6px 14px',
        borderRadius: '8px',
        fontSize: '13px',
        cursor: 'pointer',
    },
    ticketBanner: {
        background: '#e0f4ff',
        padding: '8px 24px',
        borderBottom: '1px solid #bae6fd',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13px',
        color: '#0077b6',
        fontWeight: '500',
    },
    ticketDot: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: '#0077b6',
        flexShrink: 0,
    },
    messagesContainer: {
        flex: 1,
        overflowY: 'auto',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    emptyState: {
        textAlign: 'center',
        marginTop: '60px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
    },
    emptyIconWrapper: {
        marginBottom: '8px',
    },
    emptyIcon: {
        width: '64px',
        height: '64px',
        borderRadius: '20px',
        background: 'linear-gradient(135deg, #023e8a, #0077b6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: '700',
        fontSize: '20px',
        margin: '0 auto',
    },
    emptyTitle: {
        fontSize: '18px',
        fontWeight: '600',
        color: '#1e293b',
    },
    emptySubtitle: {
        fontSize: '14px',
        color: '#94a3b8',
    },
    suggestionsRow: {
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginTop: '8px',
    },
    suggestionBtn: {
        padding: '8px 16px',
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '20px',
        fontSize: '13px',
        color: '#0077b6',
        cursor: 'pointer',
        fontWeight: '500',
    },
    messageRow: {
        display: 'flex',
        alignItems: 'flex-end',
        gap: '10px',
    },
    aiAvatar: {
        width: '32px',
        height: '32px',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, #023e8a, #0077b6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '11px',
        fontWeight: '600',
        color: 'white',
        flexShrink: 0,
    },
    messageBubble: {
        padding: '12px 16px',
        maxWidth: '60%',
        boxSizing: 'border-box',
    },
    messageText: {
        fontSize: '14px',
        lineHeight: '1.5',
    },
    messageTime: {
        fontSize: '11px',
        marginTop: '4px',
        textAlign: 'right',
    },
    typingDots: {
        display: 'flex',
        gap: '4px',
        alignItems: 'center',
        fontSize: '20px',
        color: '#94a3b8',
    },
    dot: {
        fontSize: '20px',
    },
    inputContainer: {
        padding: '16px 24px',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        padding: '12px 18px',
        borderRadius: '24px',
        fontSize: '14px',
        outline: 'none',
        boxSizing: 'border-box',
    },
    sendBtn: {
        background: 'linear-gradient(135deg, #023e8a, #0077b6)',
        color: 'white',
        border: 'none',
        borderRadius: '24px',
        padding: '12px 24px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
    },
};

export default ChatPage;