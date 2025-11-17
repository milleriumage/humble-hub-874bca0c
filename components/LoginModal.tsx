import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { LoginIcon } from './Icons';

interface LoginModalProps {
    isOpen: boolean;
    botName: string;
    onLogin: (user: string, pass: string) => Promise<boolean>;
    onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, botName, onLogin, onClose }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (botName) {
            setUsername(botName);
        }
    }, [botName]);

    useEffect(() => {
        if (!isOpen) {
            // Reset state when modal closes
            setPassword('');
            setIsLoading(false);
            setError(null);
        }
    }, [isOpen]);

    const handleLogin = async () => {
        console.log('[LoginModal] Attempting login for:', username);
        setIsLoading(true);
        setError(null);
        try {
            const success = await onLogin(username, password);
            console.log('[LoginModal] Login result:', success);
            if (!success) {
                setError('Login failed. Please check credentials and backend connection.');
                setIsLoading(false);
            }
        } catch (err: any) {
            console.error('[LoginModal] Login error:', err);
            setError(`Login error: ${err.message || 'Unknown error'}`);
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <div className="flex items-center space-x-2">
                        <LoginIcon />
                        <CardTitle>Login for {botName}</CardTitle>
                    </div>
                    <CardDescription>Enter credentials to bring this bot online.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <Input 
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={isLoading}
                        />
                        <Input 
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                            disabled={isLoading}
                        />
                        {error && <p className="text-sm text-red-400">{error}</p>}
                    </div>
                    <div className="flex justify-end space-x-2 mt-6">
                        <Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button>
                        <Button onClick={handleLogin} disabled={isLoading}>
                            {isLoading ? 'Logging in...' : 'Login'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};