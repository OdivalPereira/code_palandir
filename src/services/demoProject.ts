import type { ProjectFile } from '@/types/project';

export function createDemoProjectFiles(): ProjectFile[] {
  return [
    {
      path: 'package.json',
      language: 'json',
      size: 450,
      content: JSON.stringify(
        {
          name: 'saas-analytics-app',
          version: '1.0.0',
          dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0',
            'react-router-dom': '^6.20.0',
            zustand: '^4.4.0',
            axios: '^1.6.0',
          },
        },
        null,
        2
      ),
    },
    {
      path: 'src/App.tsx',
      language: 'tsx',
      size: 800,
      content: `import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;`,
    },
    {
      path: 'src/pages/LoginPage.tsx',
      language: 'tsx',
      size: 1200,
      content: `import React from 'react';
import LoginForm from '../components/LoginForm';

export function LoginPage() {
  return (
    <div className="login-screen">
      <h1>Portal do Usuário</h1>
      <LoginForm />
    </div>
  );
}
export default LoginPage;`,
    },
    {
      path: 'src/components/LoginForm.tsx',
      language: 'tsx',
      size: 1400,
      content: `import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useAuthStore((s) => s.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    login(email);
  };

  return (
    <form onSubmit={handleSubmit} className="card-form">
      <input 
        type="email" 
        placeholder="Digite seu e-mail corporativo" 
        value={email} 
        onChange={(e) => setEmail(e.target.value)} 
      />
      <input 
        type="password" 
        placeholder="Senha de acesso" 
        value={password} 
        onChange={(e) => setPassword(e.target.value)} 
      />
      <button type="submit">Entrar na Plataforma</button>
    </form>
  );
}
export default LoginForm;`,
    },
    {
      path: 'src/pages/DashboardPage.tsx',
      language: 'tsx',
      size: 1500,
      content: `import React, { useEffect } from 'react';
import MetricsCard from '../components/MetricsCard';
import UserTable from '../components/UserTable';
import { useAuthStore } from '../stores/authStore';

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    fetch('/api/analytics/overview');
  }, []);

  return (
    <div className="dashboard-container">
      <h2>Painel Principal - Visão Geral</h2>
      <div className="metrics-grid">
        <MetricsCard title="Novos Usuários" value="1,240" />
        <MetricsCard title="Receita Mensal" value="R$ 48.900" />
      </div>
      <UserTable />
    </div>
  );
}
export default DashboardPage;`,
    },
    {
      path: 'src/components/MetricsCard.tsx',
      language: 'tsx',
      size: 800,
      content: `import React from 'react';

export function MetricsCard({ title, value }: { title: string; value: string }) {
  const handleRefresh = () => {
    fetch('/api/metrics/refresh', { method: 'POST' });
  };

  return (
    <div className="metric-box">
      <h3>{title}</h3>
      <p className="value">{value}</p>
      <button onClick={handleRefresh}>Atualizar Dados</button>
    </div>
  );
}
export default MetricsCard;`,
    },
    {
      path: 'src/components/UserTable.tsx',
      language: 'tsx',
      size: 900,
      content: `import React from 'react';

export function UserTable() {
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Email</th>
            <th>Ações</th>
          </tr>
        </thead>
      </table>
    </div>
  );
}
export default UserTable;`,
    },
    {
      path: 'src/pages/ReportsPage.tsx',
      language: 'tsx',
      size: 1300,
      content: `import React from 'react';

export function ReportsPage() {
  const handleExportCsv = async () => {
    await fetch('/api/reports/export-csv', { method: 'POST' });
  };

  const handleFilterDate = () => {
    fetch('/api/reports/filter');
  };

  return (
    <div className="reports-tab">
      <h2>Aba de Relatórios Financeiros</h2>
      <button onClick={handleFilterDate}>Filtrar Período</button>
      <button onClick={handleExportCsv}>Exportar Relatório CSV</button>
    </div>
  );
}
export default ReportsPage;`,
    },
    {
      path: 'src/pages/SettingsPage.tsx',
      language: 'tsx',
      size: 1100,
      content: `import React, { useState } from 'react';

export function SettingsPage() {
  const [theme, setTheme] = useState('dark');

  const handleSavePreferences = () => {
    fetch('/api/user/preferences', {
      method: 'PUT',
      body: JSON.stringify({ theme }),
    });
  };

  return (
    <div className="settings-tab">
      <h2>Configurações da Conta</h2>
      <input placeholder="Nome de exibição" />
      <button onClick={handleSavePreferences}>Salvar Preferências</button>
    </div>
  );
}
export default SettingsPage;`,
    },
    {
      path: 'src/stores/authStore.ts',
      language: 'typescript',
      size: 700,
      content: `import { create } from 'zustand';

export interface AuthState {
  user: string | null;
  isAuthenticated: boolean;
  login: (email: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: (email) => set({ user: email, isAuthenticated: true }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));`,
    },
  ];
}
