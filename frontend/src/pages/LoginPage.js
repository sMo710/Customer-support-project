import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/api';
import { useAuth } from '../context/AuthContext';
import GlassCard from '../components/ui/GlassCard';
import GlassButton from '../components/ui/GlassButton';

const LoginPage = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { loginUser } = useAuth();
    const navigate = useNavigate();

    const handleLogin = async () => {
        if (!username.trim() || !password.trim()) {
            setError('Please enter username and password');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const response = await login(username, password);
            const { token, role, username: responseUsername, userId } = response.data;
            loginUser(token, role, responseUsername, userId ? Number(userId) : undefined);
            if (role === 'ADMIN') {
                navigate('/admin');
            } else {
                navigate('/chat');
            }
        } catch (err) {
            setError('Invalid username or password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="app-bg" style={styles.container}>
            <div style={styles.circle1} />
            <div style={styles.circle2} />
            <div style={styles.circle3} />

            <GlassCard style={styles.card}>
                <div style={styles.logoContainer}>
                    <div style={styles.logo}>MX</div>
                    <div style={styles.brandName}>Bonsai Support</div>
                    <div style={styles.brandSubtitle}>Sign in to your account</div>
                </div>

                {error && (
                    <div style={styles.errorBox}>
                        ⚠️ {error}
                    </div>
                )}

                <div style={styles.formGroup}>
                    <div style={styles.label}>Username</div>
                    <input
                        className="glass-input"
                        type="text"
                        placeholder="Enter your username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    />
                </div>

                <div style={styles.formGroup}>
                    <div style={styles.label}>Password</div>
                    <input
                        className="glass-input"
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    />
                </div>

                <GlassButton
                    style={{ ...styles.primaryBtn, opacity: loading ? 0.8 : 1 }}
                    onClick={handleLogin}
                    disabled={loading}
                >
                    {loading ? 'Signing in...' : 'Sign In'}
                </GlassButton>

                <div style={styles.divider}>
                    <div style={styles.dividerLine} />
                    <span style={styles.dividerText}>or</span>
                    <div style={styles.dividerLine} />
                </div>

                <GlassButton variant="secondary" style={styles.secondaryBtn} onClick={() => navigate('/register')}>
                    Create Account
                </GlassButton>

                <div style={styles.footer}>Powered by Bonsai AI</div>
            </GlassCard>
        </div>
    );
};

const styles = {
    container: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        position: 'relative',
        overflow: 'hidden',
    },
    circle1: {
        position: 'absolute',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.04)',
        top: '-120px',
        left: '-120px',
    },
    circle2: {
        position: 'absolute',
        width: '250px',
        height: '250px',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.04)',
        bottom: '-60px',
        right: '-60px',
    },
    circle3: {
        position: 'absolute',
        width: '180px',
        height: '180px',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.04)',
        top: '40%',
        right: '8%',
    },
    card: {
        borderRadius: '24px',
        padding: '48px',
        width: '100%',
        maxWidth: '420px',
        position: 'relative',
        zIndex: 1,
    },
    logoContainer: {
        textAlign: 'center',
        marginBottom: '36px',
    },
    logo: {
        width: '72px',
        height: '72px',
        borderRadius: '20px',
        background: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        fontWeight: '700',
        margin: '0 auto 16px',
        color: '#023e8a',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
    },
    brandName: {
        fontSize: '26px',
        fontWeight: '600',
        color: 'white',
        marginBottom: '6px',
    },
    brandSubtitle: {
        fontSize: '14px',
        color: 'rgba(255,255,255,0.65)',
    },
    errorBox: {
        background: 'rgba(255,80,80,0.2)',
        border: '1px solid rgba(255,80,80,0.4)',
        color: 'white',
        padding: '12px 16px',
        borderRadius: '12px',
        marginBottom: '20px',
        fontSize: '14px',
    },
    formGroup: {
        marginBottom: '16px',
    },
    label: {
        fontSize: '13px',
        fontWeight: '500',
        color: 'rgba(255,255,255,0.9)',
        marginBottom: '8px',
    },
    primaryBtn: {
        width: '100%',
        padding: '15px',
        background: 'white',
        color: '#023e8a',
        border: 'none',
        borderRadius: '12px',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        marginBottom: '16px',
        marginTop: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    },
    divider: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
    },
    dividerLine: {
        flex: 1,
        height: '1px',
        background: 'rgba(255,255,255,0.2)',
    },
    dividerText: {
        fontSize: '13px',
        color: 'rgba(255,255,255,0.5)',
    },
    secondaryBtn: {
        width: '100%',
        padding: '14px',
        background: 'transparent',
        color: 'white',
        border: '1px solid rgba(255,255,255,0.35)',
        borderRadius: '12px',
        fontSize: '15px',
        fontWeight: '500',
        cursor: 'pointer',
    },
    footer: {
        textAlign: 'center',
        marginTop: '24px',
        fontSize: '12px',
        color: 'rgba(255,255,255,0.4)',
    },
};

export default LoginPage;