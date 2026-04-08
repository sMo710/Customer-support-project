import React, { createContext, useState, useContext, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));

    useEffect(() => {
        if (token) {
            try {
                const decoded = jwtDecode(token);
                const storedUserId = localStorage.getItem('userId');
                setUser({
                    ...decoded,
                    role: localStorage.getItem('role'),
                    username: localStorage.getItem('username'),
                    id: storedUserId ? Number(storedUserId) : undefined,
                });
            } catch (e) {
                localStorage.removeItem('token');
                localStorage.removeItem('userId');
                setToken(null);
            }
        }
    }, [token]);

    const loginUser = (newToken, role, username, userId) => {
        localStorage.setItem('token', newToken);
        localStorage.setItem('role', role);
        localStorage.setItem('username', username);
        if (userId !== undefined && userId !== null) {
            localStorage.setItem('userId', String(userId));
        }
        setToken(newToken);
        try {
            const decoded = jwtDecode(newToken);
            setUser({ ...decoded, role, username, id: userId });
        } catch (e) {
            setUser({ role, username, id: userId });
        }
    };

    const logoutUser = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('username');
        localStorage.removeItem('userId');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, loginUser, logoutUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);