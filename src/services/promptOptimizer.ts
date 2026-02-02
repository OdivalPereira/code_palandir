import { GoogleGenAI } from '@google/genai';
import {
    UIIntentSchema,
    BackendRequirements,
    PromptOptimizerPayload,
    MissingDependency,
} from '../types';

// Lazy initialization for Gemini AI - only initialize when needed
let aiInstance: GoogleGenAI | null = null;

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
 * Generate a detailed, prescriptive prompt for external AI tools (Cursor, Windsurf, Copilot).
 * The output should be copy-paste ready and actionable.
 */
export async function generateBackendPrompt(
    payload: PromptOptimizerPayload
): Promise<string> {
    const stackInstructions = getStackInstructions(payload.preferredStack || 'supabase');

    const systemPrompt = `You are a senior software architect creating detailed, actionable prompts for AI coding assistants (Cursor, Windsurf, GitHub Copilot).

Your task is to generate a step-by-step implementation guide that another AI can follow to create backend infrastructure for a React frontend component.

${stackInstructions}

The output MUST be:
1. **Prescriptive**: Include exact file names, function signatures, table schemas, and code snippets
2. **Ordered by dependency**: Create database tables before API endpoints, services before components
3. **Complete**: Include error handling, validation, and type definitions
4. **Ready to copy-paste**: Format as clear markdown that works directly as an AI prompt

Structure your response as:
1. A brief summary of what will be created
2. Step-by-step instructions with code blocks
3. Verification steps at the end`;

    const userPrompt = `Create a backend implementation prompt based on this analysis:

## User Intent
"${payload.userIntent}"

## Analyzed Frontend Component: ${payload.uiIntentSchema.component}

### Form Fields
${formatFields(payload.uiIntentSchema.fields)}

### Actions
${formatActions(payload.uiIntentSchema.actions)}

### Data Flow
- Direction: ${payload.uiIntentSchema.dataFlow.direction}
- Inferred Entity: ${payload.uiIntentSchema.dataFlow.entityGuess} (${Math.round(payload.uiIntentSchema.dataFlow.confidence * 100)}% confidence)

## Required Backend Infrastructure

### Database Tables
${formatTables(payload.backendRequirements.tables)}

### API Endpoints
${formatEndpoints(payload.backendRequirements.endpoints)}

### Services
${formatServices(payload.backendRequirements.services)}

## Current Project State
- Has Backend: ${payload.projectStructure.hasBackend ? 'Yes' : 'No'}
- Current Stack: ${payload.projectStructure.stack.join(', ') || 'React/Vite only'}
- Existing Endpoints: ${payload.projectStructure.existingEndpoints.join(', ') || 'None'}

Generate a comprehensive, copy-paste-ready prompt for implementing this backend with ${payload.preferredStack || 'Supabase'}.`;

    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { role: 'user', parts: [{ text: systemPrompt }] },
                { role: 'user', parts: [{ text: userPrompt }] },
            ],
        });

        if (response.text) {
            return formatOutputPrompt(response.text, payload);
        }

        return generateFallbackPrompt(payload);
    } catch (error) {
        console.error('Prompt generation failed:', error);
        return generateFallbackPrompt(payload);
    }
}

/**
 * Generate a quick prompt without AI for simple cases.
 */
export function generateQuickPrompt(
    uiSchema: UIIntentSchema,
    requirements: BackendRequirements,
    missing: MissingDependency[],
    preferredStack: string = 'supabase'
): string {
    const lines: string[] = [
        `# Backend Implementation for ${uiSchema.component}`,
        '',
        `> Stack: ${preferredStack.toUpperCase()}`,
        '',
        '## What needs to be created:',
        '',
    ];

    // Missing tables
    const missingTables = missing.filter((m) => m.type === 'table');
    if (missingTables.length > 0) {
        lines.push('### Database Tables');
        for (const table of missingTables) {
            const tableReq = requirements.tables.find((t) => table.id.includes(t.name));
            if (tableReq) {
                lines.push(`\n#### \`${tableReq.name}\``);
                lines.push('```sql');
                lines.push(`CREATE TABLE ${tableReq.name} (`);
                lines.push('  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),');
                for (const col of tableReq.columns) {
                    if (col.name !== 'id') {
                        const constraints = col.constraints?.join(' ') || '';
                        lines.push(`  ${col.name} ${col.type.toUpperCase()} ${constraints},`.replace(/,\s*$/, ','));
                    }
                }
                lines.push('  created_at TIMESTAMPTZ DEFAULT NOW()');
                lines.push(');');
                lines.push('```');
            }
        }
    }

    // Missing endpoints
    const missingEndpoints = missing.filter((m) => m.type === 'endpoint');
    if (missingEndpoints.length > 0) {
        lines.push('\n### API Endpoints');
        for (const endpoint of requirements.endpoints) {
            lines.push(`- \`${endpoint.method} ${endpoint.path}\`: ${endpoint.description || 'Handle request'}`);
        }
    }

    // Missing services
    const missingServices = missing.filter((m) => m.type === 'service' || m.type === 'auth');
    if (missingServices.length > 0) {
        lines.push('\n### Services to Configure');
        for (const service of missingServices) {
            lines.push(`- **${service.name}** (${service.type}): ${service.description}`);
        }
    }

    // Instructions
    lines.push('\n---');
    lines.push('\n## Instructions for AI Assistant');
    lines.push('');
    lines.push(`1. Create the database schema in Supabase migrations`);
    lines.push(`2. Set up RLS (Row Level Security) policies`);
    lines.push(`3. Create Edge Functions or API routes for each endpoint`);
    lines.push(`4. Configure required services (${missingServices.map((s) => s.name).join(', ')})`);
    lines.push(`5. Update the frontend component to call these endpoints`);

    return lines.join('\n');
}

// ============================================
// Helper Functions
// ============================================

function getStackInstructions(stack: string): string {
    const instructions: Record<string, string> = {
        supabase: `Use Supabase patterns:
- Database: PostgreSQL with RLS policies
- Auth: Supabase Auth with email/password
- API: Supabase Edge Functions (Deno) or direct client calls
- Storage: Supabase Storage for files`,
        firebase: `Use Firebase patterns:
- Database: Firestore with security rules
- Auth: Firebase Auth with email/password
- API: Cloud Functions (Node.js)
- Storage: Firebase Storage for files`,
        express: `Use Express.js patterns:
- Database: PostgreSQL with Prisma ORM
- Auth: JWT with bcrypt
- API: Express routes with middleware
- Validation: Zod schemas`,
        nextjs: `Use Next.js patterns:
- Database: Prisma with PostgreSQL
- Auth: NextAuth.js or Clerk
- API: API Routes or Server Actions
- Validation: Zod schemas`,
    };
    return instructions[stack] || instructions.supabase;
}

function formatFields(fields: UIIntentSchema['fields']): string {
    if (fields.length === 0) return '- No form fields detected';
    return fields
        .map(
            (f) =>
                `- **${f.name}** (${f.type})${f.required ? ' [required]' : ''}${f.validation ? ` [${f.validation}]` : ''}`
        )
        .join('\n');
}

function formatActions(actions: UIIntentSchema['actions']): string {
    if (actions.length === 0) return '- No actions detected';
    return actions
        .map(
            (a) =>
                `- **${a.type}**: ${a.handler}${a.label ? ` ("${a.label}")` : ''}${a.apiCall ? ` → ${a.apiCall}` : ''}`
        )
        .join('\n');
}

function formatTables(tables: BackendRequirements['tables']): string {
    if (tables.length === 0) return '- No tables required';
    return tables
        .map((t) => {
            const cols = t.columns.map((c) => `${c.name}: ${c.type}`).join(', ');
            return `- **${t.name}**: ${cols}`;
        })
        .join('\n');
}

function formatEndpoints(endpoints: BackendRequirements['endpoints']): string {
    if (endpoints.length === 0) return '- No endpoints required';
    return endpoints.map((e) => `- \`${e.method} ${e.path}\`: ${e.description || ''}`).join('\n');
}

function formatServices(services: BackendRequirements['services']): string {
    if (services.length === 0) return '- No additional services required';
    return services.map((s) => `- **${s.name}** (${s.type}): ${s.description}`).join('\n');
}

function formatOutputPrompt(aiResponse: string, payload: PromptOptimizerPayload): string {
    return `# 🚀 Backend Prompt for ${payload.uiIntentSchema.component}

> Generated by Code Palantir | Stack: ${payload.preferredStack || 'Supabase'}

---

${aiResponse}

---

*Copy this entire prompt to Cursor, Windsurf, or your preferred AI coding assistant.*`;
}

function generateFallbackPrompt(payload: PromptOptimizerPayload): string {
    return `# Backend Implementation for ${payload.uiIntentSchema.component}

## User Intent
"${payload.userIntent}"

## Required Infrastructure

### Tables
${payload.backendRequirements.tables.map((t) => `- ${t.name}`).join('\n') || '- None specified'}

### Endpoints
${payload.backendRequirements.endpoints.map((e) => `- ${e.method} ${e.path}`).join('\n') || '- None specified'}

### Services
${payload.backendRequirements.services.map((s) => `- ${s.name} (${s.type})`).join('\n') || '- None specified'}

## Instructions
Please implement the backend infrastructure listed above using ${payload.preferredStack || 'Supabase'}.
Include proper error handling, validation, and type safety.`;
}
