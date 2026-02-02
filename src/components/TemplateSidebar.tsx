import React, { useState } from 'react';
import {
    Database, Server, Shield, Mail, CreditCard, Users,
    FileText, Clock, ChevronDown, ChevronRight, GripVertical,
    Package
} from 'lucide-react';

// ============================================
// Backend Template Types
// ============================================

export interface BackendTemplate {
    id: string;
    name: string;
    description: string;
    category: TemplateCategory;
    icon: React.ReactNode;
    color: string;
    components: TemplateComponent[];
}

export interface TemplateComponent {
    type: 'table' | 'endpoint' | 'service';
    name: string;
    description: string;
    details?: string[];
}

export type TemplateCategory = 'auth' | 'data' | 'integration' | 'common';

// ============================================
// Template Definitions
// ============================================

const BACKEND_TEMPLATES: BackendTemplate[] = [
    // Authentication Templates
    {
        id: 'auth-email-password',
        name: 'Auth Email/Senha',
        description: 'Autenticação completa com email e senha',
        category: 'auth',
        icon: <Shield size={16} />,
        color: 'purple',
        components: [
            { type: 'table', name: 'users', description: 'Tabela de usuários', details: ['id', 'email', 'password_hash', 'created_at'] },
            { type: 'endpoint', name: 'POST /auth/register', description: 'Registro de novo usuário' },
            { type: 'endpoint', name: 'POST /auth/login', description: 'Login com email/senha' },
            { type: 'endpoint', name: 'POST /auth/logout', description: 'Logout do usuário' },
            { type: 'service', name: 'AuthService', description: 'Gerenciamento de sessões e tokens' },
        ],
    },
    {
        id: 'auth-social',
        name: 'Auth Social (OAuth)',
        description: 'Login com Google, GitHub, etc',
        category: 'auth',
        icon: <Users size={16} />,
        color: 'blue',
        components: [
            { type: 'table', name: 'oauth_accounts', description: 'Contas OAuth vinculadas' },
            { type: 'endpoint', name: 'GET /auth/callback/:provider', description: 'Callback OAuth' },
            { type: 'service', name: 'OAuthService', description: 'Integração com provedores OAuth' },
        ],
    },
    // Data Templates
    {
        id: 'crud-basic',
        name: 'CRUD Básico',
        description: 'Operações Create/Read/Update/Delete',
        category: 'data',
        icon: <Database size={16} />,
        color: 'green',
        components: [
            { type: 'table', name: 'items', description: 'Tabela de itens (customizável)', details: ['id', 'name', 'created_at', 'updated_at'] },
            { type: 'endpoint', name: 'GET /items', description: 'Listar itens' },
            { type: 'endpoint', name: 'GET /items/:id', description: 'Obter item por ID' },
            { type: 'endpoint', name: 'POST /items', description: 'Criar novo item' },
            { type: 'endpoint', name: 'PUT /items/:id', description: 'Atualizar item' },
            { type: 'endpoint', name: 'DELETE /items/:id', description: 'Excluir item' },
        ],
    },
    {
        id: 'file-upload',
        name: 'Upload de Arquivos',
        description: 'Storage para arquivos e imagens',
        category: 'data',
        icon: <FileText size={16} />,
        color: 'orange',
        components: [
            { type: 'table', name: 'files', description: 'Metadados dos arquivos' },
            { type: 'endpoint', name: 'POST /upload', description: 'Upload de arquivo' },
            { type: 'endpoint', name: 'GET /files/:id', description: 'Download de arquivo' },
            { type: 'service', name: 'StorageService', description: 'Integração com S3/GCS' },
        ],
    },
    // Integration Templates
    {
        id: 'email-service',
        name: 'Serviço de Email',
        description: 'Envio de emails transacionais',
        category: 'integration',
        icon: <Mail size={16} />,
        color: 'pink',
        components: [
            { type: 'table', name: 'email_logs', description: 'Histórico de emails enviados' },
            { type: 'endpoint', name: 'POST /email/send', description: 'Enviar email' },
            { type: 'service', name: 'EmailService', description: 'Integração com SMTP/SendGrid/Resend' },
        ],
    },
    {
        id: 'payment-gateway',
        name: 'Gateway de Pagamento',
        description: 'Integração com Stripe/PagSeguro',
        category: 'integration',
        icon: <CreditCard size={16} />,
        color: 'yellow',
        components: [
            { type: 'table', name: 'payments', description: 'Histórico de pagamentos' },
            { type: 'table', name: 'subscriptions', description: 'Assinaturas ativas' },
            { type: 'endpoint', name: 'POST /payments/create-intent', description: 'Criar intent de pagamento' },
            { type: 'endpoint', name: 'POST /webhooks/stripe', description: 'Webhook do Stripe' },
            { type: 'service', name: 'PaymentService', description: 'Lógica de cobrança' },
        ],
    },
    // Common Patterns
    {
        id: 'scheduled-jobs',
        name: 'Jobs Agendados',
        description: 'Tarefas em background/cron',
        category: 'common',
        icon: <Clock size={16} />,
        color: 'slate',
        components: [
            { type: 'table', name: 'job_queue', description: 'Fila de jobs' },
            { type: 'service', name: 'JobScheduler', description: 'Agendador de tarefas' },
        ],
    },
];

// ============================================
// Template Sidebar Component
// ============================================

interface TemplateSidebarProps {
    onTemplateSelect: (template: BackendTemplate) => void;
    onTemplateDragStart: (template: BackendTemplate, event: React.DragEvent) => void;
    className?: string;
}

export const TemplateSidebar: React.FC<TemplateSidebarProps> = ({
    onTemplateSelect,
    onTemplateDragStart,
    className = '',
}) => {
    const [expandedCategories, setExpandedCategories] = useState<Set<TemplateCategory>>(
        new Set(['auth', 'data'])
    );
    const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());

    const toggleCategory = (category: TemplateCategory) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(category)) {
                next.delete(category);
            } else {
                next.add(category);
            }
            return next;
        });
    };

    const toggleTemplate = (templateId: string) => {
        setExpandedTemplates(prev => {
            const next = new Set(prev);
            if (next.has(templateId)) {
                next.delete(templateId);
            } else {
                next.add(templateId);
            }
            return next;
        });
    };

    const getCategoryLabel = (category: TemplateCategory): string => {
        switch (category) {
            case 'auth': return '🔐 Autenticação';
            case 'data': return '💾 Dados & CRUD';
            case 'integration': return '🔌 Integrações';
            case 'common': return '⚙️ Padrões Comuns';
        }
    };

    const getColorClass = (color: string): string => {
        const colors: Record<string, string> = {
            purple: 'bg-purple-500/20 border-purple-500/50 hover:bg-purple-500/30',
            blue: 'bg-blue-500/20 border-blue-500/50 hover:bg-blue-500/30',
            green: 'bg-green-500/20 border-green-500/50 hover:bg-green-500/30',
            orange: 'bg-orange-500/20 border-orange-500/50 hover:bg-orange-500/30',
            pink: 'bg-pink-500/20 border-pink-500/50 hover:bg-pink-500/30',
            yellow: 'bg-yellow-500/20 border-yellow-500/50 hover:bg-yellow-500/30',
            slate: 'bg-slate-500/20 border-slate-500/50 hover:bg-slate-500/30',
        };
        return colors[color] || colors.slate;
    };

    const categories: TemplateCategory[] = ['auth', 'data', 'integration', 'common'];

    return (
        <div className={`bg-slate-800 border-r border-slate-700 flex flex-col ${className}`}>
            {/* Header */}
            <div className="p-4 border-b border-slate-700 bg-slate-900/50">
                <h2 className="font-semibold text-slate-100 flex items-center gap-2">
                    <Package size={18} className="text-green-400" />
                    Templates Backend
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                    Arraste templates para o grafo
                </p>
            </div>

            {/* Template List */}
            <div className="flex-1 overflow-y-auto p-2">
                {categories.map(category => {
                    const categoryTemplates = BACKEND_TEMPLATES.filter(t => t.category === category);
                    const isExpanded = expandedCategories.has(category);

                    return (
                        <div key={category} className="mb-2">
                            {/* Category Header */}
                            <button
                                onClick={() => toggleCategory(category)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
                            >
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                {getCategoryLabel(category)}
                                <span className="ml-auto text-xs text-slate-500">{categoryTemplates.length}</span>
                            </button>

                            {/* Templates */}
                            {isExpanded && (
                                <div className="ml-2 mt-1 space-y-1">
                                    {categoryTemplates.map(template => {
                                        const isTemplateExpanded = expandedTemplates.has(template.id);

                                        return (
                                            <div key={template.id}>
                                                {/* Template Card */}
                                                <div
                                                    draggable
                                                    onDragStart={(e) => onTemplateDragStart(template, e)}
                                                    onClick={() => toggleTemplate(template.id)}
                                                    className={`p-2 rounded border cursor-grab active:cursor-grabbing transition-all ${getColorClass(template.color)}`}
                                                >
                                                    <div className="flex items-start gap-2">
                                                        <GripVertical size={12} className="text-slate-500 mt-0.5 flex-shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                {template.icon}
                                                                <span className="text-sm font-medium text-slate-200 truncate">
                                                                    {template.name}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                                                                {template.description}
                                                            </p>
                                                        </div>
                                                        {isTemplateExpanded ? (
                                                            <ChevronDown size={12} className="text-slate-500 flex-shrink-0" />
                                                        ) : (
                                                            <ChevronRight size={12} className="text-slate-500 flex-shrink-0" />
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Template Components (Expanded) */}
                                                {isTemplateExpanded && (
                                                    <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-700 pl-2">
                                                        {template.components.map((comp, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="py-1 px-2 rounded bg-slate-900/50 text-xs"
                                                            >
                                                                <div className="flex items-center gap-1">
                                                                    {comp.type === 'table' && <Database size={10} className="text-blue-400" />}
                                                                    {comp.type === 'endpoint' && <Server size={10} className="text-green-400" />}
                                                                    {comp.type === 'service' && <Shield size={10} className="text-purple-400" />}
                                                                    <span className="font-mono text-slate-300">{comp.name}</span>
                                                                </div>
                                                                <p className="text-slate-500 mt-0.5">{comp.description}</p>
                                                            </div>
                                                        ))}

                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onTemplateSelect(template);
                                                            }}
                                                            className="w-full mt-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded font-medium transition-colors"
                                                        >
                                                            Adicionar ao Projeto
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-700 bg-slate-900/50">
                <p className="text-[10px] text-slate-500 text-center">
                    💡 Arraste para o grafo ou clique para adicionar
                </p>
            </div>
        </div>
    );
};

export default TemplateSidebar;
export { BACKEND_TEMPLATES };
