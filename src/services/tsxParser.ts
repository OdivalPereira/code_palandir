import {
    UIIntentSchema,
    UIField,
    UIAction,
    DataFlowIntent,
} from '../types';

// ============================================
// Field Type Inference Heuristics
// ============================================

const FIELD_TYPE_PATTERNS: Record<string, UIField['type']> = {
    email: 'email',
    password: 'password',
    senha: 'password',
    phone: 'string',
    telefone: 'string',
    date: 'date',
    data: 'date',
    birthday: 'date',
    nascimento: 'date',
    age: 'number',
    idade: 'number',
    price: 'number',
    preco: 'number',
    valor: 'number',
    quantity: 'number',
    quantidade: 'number',
    name: 'string',
    nome: 'string',
    title: 'string',
    titulo: 'string',
    description: 'textarea',
    descricao: 'textarea',
    message: 'textarea',
    mensagem: 'textarea',
    bio: 'textarea',
    cpf: 'string',
    cnpj: 'string',
    cep: 'string',
    zip: 'string',
};

// Entity inference from field combinations
const ENTITY_HEURISTICS: { fields: string[]; entity: string; confidence: number }[] = [
    { fields: ['email', 'password'], entity: 'User', confidence: 0.9 },
    { fields: ['email', 'password', 'name'], entity: 'User', confidence: 0.95 },
    { fields: ['email', 'senha'], entity: 'User', confidence: 0.9 },
    { fields: ['nome', 'email', 'senha'], entity: 'User', confidence: 0.95 },
    { fields: ['title', 'description', 'price'], entity: 'Product', confidence: 0.85 },
    { fields: ['titulo', 'descricao', 'preco'], entity: 'Product', confidence: 0.85 },
    { fields: ['street', 'city', 'zip'], entity: 'Address', confidence: 0.8 },
    { fields: ['rua', 'cidade', 'cep'], entity: 'Address', confidence: 0.8 },
    { fields: ['card', 'cvv', 'expiry'], entity: 'Payment', confidence: 0.9 },
    { fields: ['cartao', 'cvv', 'validade'], entity: 'Payment', confidence: 0.9 },
    { fields: ['subject', 'message'], entity: 'Contact', confidence: 0.75 },
    { fields: ['assunto', 'mensagem'], entity: 'Contact', confidence: 0.75 },
];

// ============================================
// Regex-based TSX Parser (Browser Compatible)
// ============================================

/**
 * Parse a React TSX component and extract UI intent schema.
 * Uses regex patterns instead of TypeScript Compiler API for browser compatibility.
 */
export function parseComponentIntent(code: string, filename: string): UIIntentSchema {
    const fields = extractFields(code);
    const actions = extractActions(code);
    const hooks = extractHooks(code);
    const componentName = extractComponentName(code, filename);

    return {
        component: componentName,
        fields,
        actions,
        dataFlow: inferDataFlow(fields, actions),
        hooks,
    };
}

/**
 * Extract form fields from JSX input elements
 */
function extractFields(code: string): UIField[] {
    const fields: UIField[] = [];
    const seen = new Set<string>();

    // Match input elements with name/id attributes
    // Pattern: <input ... name="fieldName" ... /> or <Input ... name="fieldName" ... />
    const inputPatterns = [
        /<(?:input|Input|TextField|TextInput)\s+[^>]*(?:name|id)=["']([^"']+)["'][^>]*>/gi,
        /<(?:input|Input|TextField|TextInput)\s+[^>]*(?:name|id)=\{["']([^"']+)["']\}[^>]*>/gi,
        // React Hook Form register pattern: {...register('fieldName')}
        /register\s*\(\s*["']([^"']+)["']/gi,
        // Formik field pattern: <Field name="fieldName" />
        /<Field\s+[^>]*name=["']([^"']+)["'][^>]*>/gi,
    ];

    for (const pattern of inputPatterns) {
        let match;
        while ((match = pattern.exec(code)) !== null) {
            const fieldName = match[1];
            if (!seen.has(fieldName)) {
                seen.add(fieldName);
                fields.push(createFieldFromName(fieldName, code));
            }
        }
    }

    // Match useState declarations that look like form state
    // Pattern: const [email, setEmail] = useState('')
    const statePattern = /const\s+\[(\w+),\s*set\w+\]\s*=\s*useState\s*[<(]/g;
    let stateMatch;
    while ((stateMatch = statePattern.exec(code)) !== null) {
        const stateName = stateMatch[1];
        // Only include if it looks like a form field
        if (isLikelyFormField(stateName) && !seen.has(stateName)) {
            seen.add(stateName);
            fields.push(createFieldFromName(stateName, code));
        }
    }

    return fields;
}

/**
 * Create a UIField from a field name, inferring type and validation
 */
function createFieldFromName(name: string, code: string): UIField {
    const lowerName = name.toLowerCase();

    // Infer type from name patterns
    let type: UIField['type'] = 'string';
    for (const [pattern, fieldType] of Object.entries(FIELD_TYPE_PATTERNS)) {
        if (lowerName.includes(pattern)) {
            type = fieldType;
            break;
        }
    }

    // Check for type attribute in the code
    const typeAttrPattern = new RegExp(
        `(?:name|id)=["']${name}["'][^>]*type=["']([^"']+)["']|type=["']([^"']+)["'][^>]*(?:name|id)=["']${name}["']`,
        'i'
    );
    const typeMatch = code.match(typeAttrPattern);
    if (typeMatch) {
        const inputType = typeMatch[1] || typeMatch[2];
        if (inputType === 'email') type = 'email';
        else if (inputType === 'password') type = 'password';
        else if (inputType === 'number') type = 'number';
        else if (inputType === 'date') type = 'date';
        else if (inputType === 'checkbox') type = 'checkbox';
    }

    // Check for required attribute
    const requiredPattern = new RegExp(
        `(?:name|id)=["']${name}["'][^>]*required|required[^>]*(?:name|id)=["']${name}["']`,
        'i'
    );
    const required = requiredPattern.test(code);

    // Check for validation patterns (Zod, Yup, etc.)
    let validation: string | undefined;
    if (type === 'email') validation = 'email';
    if (lowerName.includes('password') || lowerName.includes('senha')) {
        validation = 'min:8';
    }

    return {
        name,
        type,
        required,
        validation,
    };
}

/**
 * Check if a state variable name looks like a form field
 */
function isLikelyFormField(name: string): boolean {
    const formFieldPatterns = [
        'email', 'password', 'senha', 'nome', 'name', 'phone', 'telefone',
        'address', 'endereco', 'city', 'cidade', 'state', 'estado',
        'title', 'titulo', 'description', 'descricao', 'message', 'mensagem',
        'price', 'preco', 'quantity', 'quantidade', 'date', 'data'
    ];
    const lowerName = name.toLowerCase();
    return formFieldPatterns.some(pattern => lowerName.includes(pattern));
}

/**
 * Extract actions (button clicks, form submissions)
 */
function extractActions(code: string): UIAction[] {
    const actions: UIAction[] = [];
    const seen = new Set<string>();

    // Match onSubmit handlers
    const submitPattern = /onSubmit\s*=\s*\{?\s*(?:(?:\(\s*\w*\s*\)\s*=>)|(\w+))/gi;
    let submitMatch;
    while ((submitMatch = submitPattern.exec(code)) !== null) {
        const handler = submitMatch[1] || 'handleSubmit';
        if (!seen.has('submit')) {
            seen.add('submit');
            actions.push({
                type: 'submit',
                handler,
                apiCall: detectApiCall(code, handler),
            });
        }
    }

    // Match button onClick handlers
    const buttonPattern = /<(?:button|Button)[^>]*onClick\s*=\s*\{?\s*(?:(?:\(\s*\w*\s*\)\s*=>)|(\w+))[^>]*>([^<]*)</gi;
    let buttonMatch;
    while ((buttonMatch = buttonPattern.exec(code)) !== null) {
        const handler = buttonMatch[1] || 'onClick';
        const label = buttonMatch[2]?.trim();
        const key = `click_${handler}_${label}`;
        if (!seen.has(key)) {
            seen.add(key);
            actions.push({
                type: 'click',
                handler,
                label,
                apiCall: detectApiCall(code, handler),
            });
        }
    }

    return actions;
}

/**
 * Detect API calls associated with a handler function
 */
function detectApiCall(code: string, handlerName: string): string | undefined {
    // Look for fetch/axios calls near the handler
    const patterns = [
        /fetch\s*\(\s*['"`]([^'"`]+)['"`]/,
        /axios\s*\.\s*(?:get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/,
        /api\s*\.\s*(?:get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/,
        /supabase\s*\.\s*from\s*\(\s*['"`]([^'"`]+)['"`]/,
    ];

    // Find the handler function in code
    const handlerPattern = new RegExp(
        `(?:const|function|async\\s+function)\\s+${handlerName}[^{]*\\{([^}]+(?:\\{[^}]*\\}[^}]*)*)\\}`,
        'is'
    );
    const handlerMatch = code.match(handlerPattern);
    const searchCode = handlerMatch ? handlerMatch[1] : code;

    for (const pattern of patterns) {
        const match = searchCode.match(pattern);
        if (match) {
            return match[1];
        }
    }

    return undefined;
}

/**
 * Extract React hooks usage
 */
function extractHooks(code: string): string[] {
    const hooks: string[] = [];
    const hookPattern = /\b(use[A-Z]\w*)\s*\(/g;
    let match;
    while ((match = hookPattern.exec(code)) !== null) {
        if (!hooks.includes(match[1])) {
            hooks.push(match[1]);
        }
    }
    return hooks;
}

/**
 * Extract component name from code or filename
 */
function extractComponentName(code: string, filename: string): string {
    // Try to find export default function/const ComponentName
    const patterns = [
        /export\s+default\s+function\s+(\w+)/,
        /export\s+default\s+(\w+)/,
        /const\s+(\w+)\s*:\s*React\.FC/,
        /function\s+(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/,
    ];

    for (const pattern of patterns) {
        const match = code.match(pattern);
        if (match && match[1] !== 'function') {
            return match[1];
        }
    }

    // Fall back to filename
    return filename.replace(/\.(tsx?|jsx?)$/, '');
}

/**
 * Infer data flow direction and entity from fields and actions
 */
function inferDataFlow(fields: UIField[], actions: UIAction[]): DataFlowIntent {
    const hasSubmit = actions.some(a => a.type === 'submit');
    const fieldNames = fields.map(f => f.name.toLowerCase());

    // Check for API call patterns
    const hasCreateAction = actions.some(a =>
        a.apiCall?.includes('POST') ||
        a.apiCall?.includes('create') ||
        a.apiCall?.includes('register') ||
        a.apiCall?.includes('signup')
    );
    const hasUpdateAction = actions.some(a =>
        a.apiCall?.includes('PUT') ||
        a.apiCall?.includes('PATCH') ||
        a.apiCall?.includes('update')
    );
    const hasDeleteAction = actions.some(a =>
        a.apiCall?.includes('DELETE') ||
        a.apiCall?.includes('delete') ||
        a.apiCall?.includes('remove')
    );

    // Determine direction
    let direction: DataFlowIntent['direction'] = 'mixed';
    if (hasCreateAction || (hasSubmit && fields.length > 0)) {
        direction = 'create';
    } else if (hasUpdateAction) {
        direction = 'update';
    } else if (hasDeleteAction) {
        direction = 'delete';
    } else if (fields.length === 0 && !hasSubmit) {
        direction = 'read';
    }

    // Match against entity heuristics
    for (const heuristic of ENTITY_HEURISTICS) {
        const matches = heuristic.fields.filter(f =>
            fieldNames.some(fn => fn.includes(f))
        );
        const matchRatio = matches.length / heuristic.fields.length;
        if (matchRatio >= 0.6) {
            return {
                direction,
                entityGuess: heuristic.entity,
                confidence: matchRatio * heuristic.confidence,
            };
        }
    }

    // Default fallback
    return {
        direction,
        entityGuess: fields.length > 0 ? guessEntityFromFields(fields) : 'Entity',
        confidence: 0.3,
    };
}

/**
 * Guess entity name from field names
 */
function guessEntityFromFields(fields: UIField[]): string {
    // Look for common patterns
    const fieldNames = fields.map(f => f.name.toLowerCase());

    if (fieldNames.some(n => n.includes('user') || n.includes('usuario'))) return 'User';
    if (fieldNames.some(n => n.includes('product') || n.includes('produto'))) return 'Product';
    if (fieldNames.some(n => n.includes('order') || n.includes('pedido'))) return 'Order';
    if (fieldNames.some(n => n.includes('comment') || n.includes('comentario'))) return 'Comment';
    if (fieldNames.some(n => n.includes('post') || n.includes('artigo'))) return 'Post';

    // Default to generic
    return 'Entity';
}
