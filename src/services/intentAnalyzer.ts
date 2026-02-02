import { GoogleGenAI, Type } from '@google/genai';
import {
    UIIntentSchema,
    BackendRequirements,
    MissingDependency,
} from '../types';

// Lazy initialization for Gemini AI - only initialize when needed
let aiInstance: GoogleGenAI | null = null;
const modelId = 'gemini-2.5-flash';

function getAI(): GoogleGenAI {
    if (!aiInstance) {
        const apiKey = import.meta.env.VITE_API_KEY;
        if (!apiKey) {
            throw new Error('VITE_API_KEY environment variable is not set. Please configure your Gemini API key.');
        }
        aiInstance = new GoogleGenAI({
            apiKey,
            vertexai: true,
        });
    }
    return aiInstance;
}

/**
 * Analyze a frontend component and infer required backend infrastructure.
 * Uses Gemini AI to understand the UI intent and suggest tables, endpoints, and services.
 */
export async function analyzeBackendRequirements(
    uiSchema: UIIntentSchema,
    componentCode: string,
    existingInfrastructure: string[] = []
): Promise<BackendRequirements> {
    const prompt = `You are a backend architect analyzing a React frontend component.

COMPONENT: ${uiSchema.component}
FIELDS: ${JSON.stringify(uiSchema.fields, null, 2)}
ACTIONS: ${JSON.stringify(uiSchema.actions, null, 2)}
DATA FLOW: ${JSON.stringify(uiSchema.dataFlow, null, 2)}
HOOKS USED: ${uiSchema.hooks.join(', ')}
EXISTING INFRASTRUCTURE: ${existingInfrastructure.length > 0 ? existingInfrastructure.join(', ') : 'None detected'}

Based on this frontend component, determine what backend infrastructure is needed to make it fully functional:

1. **Database Tables**: What tables are needed? Include columns with types.
2. **API Endpoints**: What endpoints are required? Include HTTP methods and paths.
3. **Services**: What external services are needed? (auth, email, storage, etc.)

Be practical and suggest ONLY what's necessary for this specific component to function.
Use common conventions (e.g., REST paths, PostgreSQL types for Supabase).`;

    try {
        const response = await getAI().models.generateContent({
            model: modelId,
            contents: {
                role: 'user',
                parts: [
                    { text: prompt },
                    { text: `COMPONENT CODE:\n${componentCode.slice(0, 12000)}` },
                ],
            },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        tables: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    columns: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                name: { type: Type.STRING },
                                                type: { type: Type.STRING },
                                                constraints: {
                                                    type: Type.ARRAY,
                                                    items: { type: Type.STRING },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        endpoints: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    method: { type: Type.STRING },
                                    path: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                },
                            },
                        },
                        services: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    type: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (response.text) {
            const result = JSON.parse(response.text);
            return {
                tables: result.tables || [],
                endpoints: result.endpoints || [],
                services: result.services || [],
            };
        }

        return { tables: [], endpoints: [], services: [] };
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
