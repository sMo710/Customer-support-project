import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register } from '../services/api';
import GlassCard from '../components/ui/GlassCard';
import GlassButton from '../components/ui/GlassButton';

const RegisterPage = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState('CUSTOMER');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const validatePassword = (value) => {
        // At least 8 chars
        const hasMinLength = value.length >= 8;
        // At least 1 uppercase letter
        const hasUppercase = /[A-Z]/.test(value);
        // At least 1 symbol (non letter/digit)
        const hasSymbol = /[^A-Za-z0-9]/.test(value);
        return { hasMinLength, hasUppercase, hasSymbol };
    };

    const { hasMinLength, hasUppercase, hasSymbol } = validatePassword(password);
    const isPasswordValid = hasMinLength && hasUppercase && hasSymbol;
    const validateForm = () => {
        const trimmedUsername = username.trim();
        if (!trimmedUsername) {
            return 'Username is required';
        }
        if (!password.trim()) {
            return 'Password is required';
        }
        if (!confirmPassword.trim()) {
            return 'Please confirm your password';
        }
        if (!isPasswordValid) {
            return 'Password must be at least 8 characters, include 1 uppercase letter, and include 1 symbol.';
        }
        if (password !== confirmPassword) {
            return 'Passwords do not match';
        }
        return '';
    };

    const handleRegister = async () => {
        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            setSuccess('');
            return;
        }

        setLoading(true);
        setError('');
        try {
            await register(username.trim(), password, role);
            setSuccess('Account created! Redirecting to login...');
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            setError(err?.response?.data?.message || err?.response?.data || 'Registration failed. Please try again.');
            setSuccess('');
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
                {/* Logo */}
                <div style={styles.logoContainer}>
                    <div style={styles.logo}>MX</div>
                    <div style={styles.brandName}>Create Account</div>
                    <div style={styles.brandSubtitle}>Join Bonsai Support today</div>
                </div>

                {error && <div style={styles.errorBox}>⚠️ {error}</div>}
                {success && <div style={styles.successBox}>✅ {success}</div>}

                {/* Username */}
                <div style={styles.formGroup}>
                    <div style={styles.label}>Username</div>
                    <input
                        className="glass-input"
                        type="text"
                        placeholder="Choose a username"
                        value={username}
                        onChange={(e) => {
                            setUsername(e.target.value);
                            setError('');
                            setSuccess('');
                        }}
                    />
                </div>

                {/* Password */}
                <div style={styles.formGroup}>
                    <div style={styles.label}>Password</div>
                    <input
                        className="glass-input"
                        type="password"
                        placeholder="Choose a password"
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            setError('');
                            setSuccess('');
                        }}
                    />
                </div>

                {/* Confirm Password */}
                <div style={styles.formGroup}>
                    <div style={styles.label}>Confirm Password</div>
                    <input
                        className="glass-input"
                        type="password"
                        placeholder="Re-enter your password"
                        value={confirmPassword}
                        onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            setError('');
                            setSuccess('');
                        }}
                    />
                </div>

                <div style={styles.passwordRules}>
                    <div style={{ ...styles.passwordRuleItem, color: hasMinLength ? '#7CFC9A' : 'rgba(255,255,255,0.7)' }}>
                        {hasMinLength ? '✓' : '•'} Minimum 8 characters
                    </div>
                    <div style={{ ...styles.passwordRuleItem, color: hasUppercase ? '#7CFC9A' : 'rgba(255,255,255,0.7)' }}>
                        {hasUppercase ? '✓' : '•'} At least one uppercase letter
                    </div>
                    <div style={{ ...styles.passwordRuleItem, color: hasSymbol ? '#7CFC9A' : 'rgba(255,255,255,0.7)' }}>
                        {hasSymbol ? '✓' : '•'} At least one symbol
                    </div>
                    <div style={{ ...styles.passwordRuleItem, color: password && confirmPassword && password === confirmPassword ? '#7CFC9A' : 'rgba(255,255,255,0.7)' }}>
                        {password && confirmPassword && password === confirmPassword ? '✓' : '•'} Passwords must match
                    </div>
                </div>

                {/* Role Selector */}
                <div style={styles.formGroup}>
                    <div style={styles.label}>Account Type</div>
                    <div style={styles.roleSelector}>
                        <div
                            style={{
                                ...styles.roleOption,
                                ...(role === 'CUSTOMER' ? styles.roleOptionActive : {}),
                            }}
                            onClick={() => setRole('CUSTOMER')}
                        >
                            <div style={styles.roleIconCircle}>👤</div>
                            <div>
                                <div style={styles.roleTitle}>Customer</div>
                                <div style={styles.roleDesc}>Get AI support</div>
                            </div>
                        </div>
                        <div
                            style={{
                                ...styles.roleOption,
                                ...(role === 'ADMIN' ? styles.roleOptionActive : {}),
                            }}
                            onClick={() => setRole('ADMIN')}
                        >
                            <div style={styles.roleIconCircle}>🛡️</div>
                            <div>
                                <div style={styles.roleTitle}>Admin</div>
                                <div style={styles.roleDesc}>Manage tickets</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Register Button */}
                <GlassButton
                    style={{ ...styles.primaryBtn, opacity: loading ? 0.8 : 1 }}
                    onClick={handleRegister}
                    disabled={loading}
                >
                    {loading ? 'Creating...' : 'Create Account'}
                </GlassButton>

                {/* Divider */}
                <div style={styles.divider}>
                    <div style={styles.dividerLine} />
                    <span style={styles.dividerText}>or</span>
                    <div style={styles.dividerLine} />
                </div>

                {/* Login Button */}
                <GlassButton variant="secondary" style={styles.secondaryBtn} onClick={() => navigate('/login')}>
                    Sign In
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
        marginBottom: '32px',
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
    successBox: {
        background: 'rgba(80,255,120,0.2)',
        border: '1px solid rgba(80,255,120,0.4)',
        color: 'white',
        padding: '12px 16px',
        borderRadius: '12px',
        marginBottom: '20px',
        fontSize: '14px',
    },
    formGroup: {
        marginBottom: '16px',
    },
    passwordRules: {
        marginTop: '-4px',
        marginBottom: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
    },
    passwordRuleItem: {
        fontSize: '12px',
        lineHeight: 1.2,
    },
    label: {
        fontSize: '13px',
        fontWeight: '500',
        color: 'rgba(255,255,255,0.9)',
        marginBottom: '8px',
    },
    roleSelector: {
        display: 'flex',
        gap: '12px',
    },
    roleOption: {
        flex: 1,
        padding: '14px',
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: '12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'rgba(255,255,255,0.08)',
        transition: 'all 0.2s',
    },
    roleOptionActive: {
        border: '1px solid rgba(255,255,255,0.8)',
        background: 'rgba(255,255,255,0.2)',
    },
    roleIconCircle: {
        fontSize: '20px',
        flexShrink: 0,
    },
    roleTitle: {
        fontSize: '13px',
        fontWeight: '600',
        color: 'white',
    },
    roleDesc: {
        fontSize: '11px',
        color: 'rgba(255,255,255,0.6)',
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

export default RegisterPage;