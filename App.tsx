import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginModal } from './components/LoginModal';
import { DashboardPage } from './pages/DashboardPage';
import { MultiRoomPage } from './pages/MultiRoomPage';
import { ChatPage } from './pages/ChatPage';
import { SettingsPage } from './pages/SettingsPage';
import { BotManagerPage } from './pages/BotManagerPage';
import { useBotStore } from './store/botStore';
import { useImvuBot } from './hooks/useImvuBot';
import { Page } from './types';

const BotController: React.FC<{ botId: string }> = ({ botId }) => {
    useImvuBot(botId);
    return null; // This component is for logic only
};

const App: React.FC = () => {
    const [currentPage, setCurrentPage] = useState<Page>('dashboard');
    const { bots, activeBotId, initialize, loginModal, closeLoginModal, loginBot } = useBotStore();
    
    const botToLogin = bots.find(b => b.id === loginModal.botId);

    useEffect(() => {
        initialize();
    }, [initialize]);
    
    const renderPage = () => {
        if (!activeBotId && currentPage !== 'bots') {
            return (
                <div className="flex flex-col items-center justify-center h-full text-text-secondary">
                    <p className="text-lg">No bot selected.</p>
                    <p>Please select a bot from the sidebar to get started, or create a new one.</p>
                </div>
            );
        }
        switch (currentPage) {
            case 'dashboard':
                return <DashboardPage />;
            case 'rooms':
                return <MultiRoomPage />;
            case 'chat':
                return <ChatPage />;
            case 'bots':
                return <BotManagerPage />;
            case 'settings':
                return <SettingsPage />;
            default:
                return <DashboardPage />;
        }
    };

    return (
        <div className="flex h-screen" style={{ background: '#1a1a1a', color: '#fff' }}>
            {bots.map(bot => bot.status === 'online' && <BotController key={bot.id} botId={bot.id} />)}
            
            <LoginModal
                isOpen={loginModal.isOpen}
                botName={botToLogin?.name || ''}
                onLogin={(user, pass) => {
                    if (botToLogin) {
                       return loginBot(botToLogin.id, user, pass);
                    }
                    return Promise.resolve(false);
                }}
                onClose={closeLoginModal}
            />

            <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
            <div className="flex flex-col flex-1">
                <Header />
                <main className="flex-1 p-6 overflow-y-auto">
                    {renderPage()}
                </main>
            </div>
        </div>
    );
};

export default App;