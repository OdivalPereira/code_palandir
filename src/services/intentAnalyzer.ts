import {
    UIIntentSchema,
    BackendRequirements,
    MissingDependency,
} from '../types';
import { analyzeIntent } from './apiClient';

/**
 * Analyze a frontend component and infer required backend infrastructure.
 * Uses Gemini AI to understand the UI intent and suggest tables, endpoints, and services.
 */
export async function analyzeBackendRequirements(
    payload: {
        uiSchema: UIIntentSchema;
        fileContent: string;
        selectedNode: { name: string; path: string; type: string; id?: string | null };
        userIntent?: string;
        existingInfrastructure?: string[];
    }
): Promise<BackendRequirements> {
    try {
        return await analyzeIntent({
            uiSchema: payload.uiSchema,
            fileContent: payload.fileContent,
            selectedNode: payload.selectedNode,
            userIntent: payload.userIntent,
            existingInfrastructure: payload.existingInfrastructure ?? [],
        });
    } catch (error) {
        console.error('Backend requirements analysis failed:', error);
        return { tables: [], endpoints: [], services: [] };
    }
}

/**
 * Detect which requirements already exist in the project.
 * Returns a list of MissingDependency objects with status.
 */
export function detectMissingDependencies(
    requirements: BackendRequirements,
    existingFiles: string[],
    componentPath: string
): MissingDependency[] {
    const missing: MissingDependency[] = [];

    // Check tables
    for (const table of requirements.tables) {
        const exists = existingFiles.some(
            (f) =>
                f.includes('schema') ||
                f.includes('migrations') ||
                f.includes('supabase') ||
                f.includes(table.name)
        );

        if (!exists) {
            missing.push({
                id: `table_${table.name}`,
                name: `${table.name} Table`,
                type: 'table',
                description: `Database table with columns: ${table.columns.map((c) => c.name).join(', ')}`,
                requiredBy: [componentPath],
                suggestedStack: 'supabase',
            });
        }
    }

    // Check endpoints
    for (const endpoint of requirements.endpoints) {
        const exists = existingFiles.some(
            (f) =>
                f.includes('api') ||
                f.includes('routes') ||
                f.includes('functions') ||
                f.includes(endpoint.path.split('/').pop() || '')
        );

        if (!exists) {
            missing.push({
                id: `endpoint_${endpoint.method}_${endpoint.path.replace(/\//g, '_')}`,
                name: `${endpoint.method} ${endpoint.path}`,
                type: 'endpoint',
                description: endpoint.description || `API endpoint for ${endpoint.path}`,
                requiredBy: [componentPath],
                suggestedStack: 'supabase',
            });
        }
    }

    // Check services
    for (const service of requirements.services) {
        const servicePatterns: Record<string, string[]> = {
            auth: ['auth', 'supabase', 'firebase', 'clerk', 'nextauth'],
            email: ['email', 'smtp', 'resend', 'sendgrid', 'mailgun'],
            storage: ['storage', 's3', 'cloudinary', 'uploadthing'],
            payment: ['stripe', 'payment', 'checkout'],
        };

        const patterns = servicePatterns[service.type] || [service.name.toLowerCase()];
        const exists = existingFiles.some((f) =>
            patterns.some((p) => f.toLowerCase().includes(p))
        );

        if (!exists) {
            missing.push({
                id: `service_${service.type}_${service.name}`,
                name: service.name,
                type: service.type === 'auth' ? 'auth' : 'service',
                description: service.description,
                requiredBy: [componentPath],
                suggestedStack: 'supabase',
            });
        }
    }

    return missing;
}

/**
 * Generate a summary of what needs to be built.
 */
export function generateRequirementsSummary(
    requirements: BackendRequirements,
    missing: MissingDependency[]
): string {
    const lines: string[] = [];

    if (requirements.tables.length > 0) {
        lines.push('📊 **Database Tables:**');
        for (const table of requirements.tables) {
            const isMissing = missing.some((m) => m.id === `table_${table.name}`);
            const status = isMissing ? '❌' : '✅';
            lines.push(`  ${status} \`${table.name}\` (${table.columns.length} columns)`);
        }
    }

    if (requirements.endpoints.length > 0) {
        lines.push('');
        lines.push('🔌 **API Endpoints:**');
        for (const endpoint of requirements.endpoints) {
            const isMissing = missing.some(
                (m) => m.id === `endpoint_${endpoint.method}_${endpoint.path.replace(/\//g, '_')}`
            );
            const status = isMissing ? '❌' : '✅';
            lines.push(`  ${status} \`${endpoint.method} ${endpoint.path}\``);
        }
    }

    if (requirements.services.length > 0) {
        lines.push('');
        lines.push('⚙️ **Services:**');
        for (const service of requirements.services) {
            const isMissing = missing.some(
                (m) => m.id === `service_${service.type}_${service.name}`
            );
            const status = isMissing ? '❌' : '✅';
            lines.push(`  ${status} ${service.name} (${service.type})`);
        }
    }

    return lines.join('\n');
}
