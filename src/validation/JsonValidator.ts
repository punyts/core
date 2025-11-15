import { defineSchema, type JsonPrimitiveType, type JsonSchema, type JsonSchemaDefinition } from './JsonSchema.js';

export interface ValidationIssue {
    path: string;
    message: string;
}

export interface ValidationOptions {
    applyDefaults?: boolean;
}

export interface ValidationResult<T> {
    success: boolean;
    data?: T;
    issues: ValidationIssue[];
}

export class ValidationError extends Error {
    readonly issues: ValidationIssue[];

    constructor(message: string, issues: ValidationIssue[]) {
        super(message);
        this.name = 'ValidationError';
        this.issues = issues;
    }
}

interface InternalValidationOptions {
    applyDefaults: boolean;
}

interface NodeValidationResult {
    success: boolean;
    value?: unknown;
    issues: ValidationIssue[];
}

type SchemaTuple = JsonSchemaDefinition[];

export function validate<T>(schema: JsonSchema<T>, input: unknown, options?: ValidationOptions): ValidationResult<T> {
    const internal: InternalValidationOptions = {
        applyDefaults: options?.applyDefaults ?? true,
    };

    const result = validateNode(schema, input, '$', internal);

    if (result.success) {
        return {
            success: true,
            data: result.value as T,
            issues: [],
        };
    }

    return {
        success: false,
        issues: result.issues,
    };
}

export function assertValid<T>(schema: JsonSchema<T>, input: unknown, options?: ValidationOptions): T {
    const result = validate(schema, input, options);
    if (!result.success) {
        throw new ValidationError('Validation failed', result.issues);
    }
    return result.data as T;
}

export function withDefaults<T>(schema: JsonSchemaDefinition, defaults: Partial<T>): JsonSchema<T> {
    const clone = deepClone(schema) as JsonSchemaDefinition;
    if (!clone.properties) {
        clone.properties = {};
    }

    for (const [key, value] of Object.entries(defaults)) {
        const property = clone.properties[key] ?? defineSchema({});
        property.default = deepClone(value);
        clone.properties[key] = property;
    }

    return clone as JsonSchema<T>;
}

function validateNode(schema: JsonSchemaDefinition, value: unknown, path: string, options: InternalValidationOptions): NodeValidationResult {
    if (value === undefined) {
        if (options.applyDefaults && schema.default !== undefined) {
            return {
                success: true,
                value: deepClone(schema.default),
                issues: [],
            };
        }

        return {
            success: true,
            value: value,
            issues: [],
        };
    }

    const unionResult = handleCompositeSchemas(schema, value, path, options);
    if (unionResult) {
        return unionResult;
    }

    const issues: ValidationIssue[] = [];

    if (schema.const !== undefined && !areEqual(value, schema.const)) {
        issues.push({ path, message: `Value must equal ${JSON.stringify(schema.const)}` });
        return { success: false, issues };
    }

    if (schema.enum && !schema.enum.some((candidate) => areEqual(candidate, value))) {
        issues.push({ path, message: `Value must be one of: ${schema.enum.map((item) => JSON.stringify(item)).join(', ')}` });
        return { success: false, issues };
    }

    const allowedTypes = normalizeTypes(schema.type);

    if (!typeMatches(value, allowedTypes)) {
        if (allowedTypes.length === 0) {
            // Schema without explicit type accepts any value
        } else {
            const expected = allowedTypes.join(' or ');
            issues.push({ path, message: `Expected value of type ${expected}` });
            return { success: false, issues };
        }
    }

    const inferredType = inferType(value);

    switch (inferredType) {
        case 'string':
            return validateString(schema, value as string, path);
        case 'number':
        case 'integer':
            return validateNumber(schema, value as number, path);
        case 'boolean':
            return { success: true, value, issues: [] };
        case 'array':
            return validateArray(schema, value as unknown[], path, options);
        case 'object':
            return validateObject(schema, value as Record<string, unknown>, path, options);
        case 'null':
            if (!allowedTypes.includes('null') && allowedTypes.length > 0) {
                issues.push({ path, message: 'Null value is not permitted' });
                return { success: false, issues };
            }
            return { success: true, value: null, issues: [] };
        default:
            return { success: true, value, issues: [] };
    }
}

function validateString(schema: JsonSchemaDefinition, value: string, path: string): NodeValidationResult {
    const issues: ValidationIssue[] = [];

    if (schema.minLength !== undefined && value.length < schema.minLength) {
        issues.push({ path, message: `String must have at least ${schema.minLength} characters` });
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        issues.push({ path, message: `String must have at most ${schema.maxLength} characters` });
    }

    if (schema.pattern) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(value)) {
            issues.push({ path, message: `String does not match required pattern ${schema.pattern}` });
        }
    }

    if (schema.format) {
        if (schema.format === 'uri' && !isValidUri(value)) {
            issues.push({ path, message: 'String is not a valid URI' });
        }
        if (schema.format === 'uuid' && !isValidUuid(value)) {
            issues.push({ path, message: 'String is not a valid UUID' });
        }
    }

    return {
        success: issues.length === 0,
        issues,
        value,
    };
}

function validateNumber(schema: JsonSchemaDefinition, value: number, path: string): NodeValidationResult {
    const issues: ValidationIssue[] = [];

    if (Number.isNaN(value) || !Number.isFinite(value)) {
        issues.push({ path, message: 'Value must be a finite number' });
    }

    if (schema.type === 'integer' || (Array.isArray(schema.type) && schema.type.includes('integer'))) {
        if (!Number.isInteger(value)) {
            issues.push({ path, message: 'Value must be an integer' });
        }
    }

    if (schema.minimum !== undefined && value < schema.minimum) {
        issues.push({ path, message: `Value must be >= ${schema.minimum}` });
    }

    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
        issues.push({ path, message: `Value must be > ${schema.exclusiveMinimum}` });
    }

    if (schema.maximum !== undefined && value > schema.maximum) {
        issues.push({ path, message: `Value must be <= ${schema.maximum}` });
    }

    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
        issues.push({ path, message: `Value must be < ${schema.exclusiveMaximum}` });
    }

    if (schema.multipleOf !== undefined && !isMultipleOf(value, schema.multipleOf)) {
        issues.push({ path, message: `Value must be a multiple of ${schema.multipleOf}` });
    }

    return {
        success: issues.length === 0,
        issues,
        value,
    };
}

function validateArray(
    schema: JsonSchemaDefinition,
    value: unknown[],
    path: string,
    options: InternalValidationOptions
): NodeValidationResult {
    const issues: ValidationIssue[] = [];

    if (schema.minItems !== undefined && value.length < schema.minItems) {
        issues.push({ path, message: `Array must contain at least ${schema.minItems} items` });
    }

    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        issues.push({ path, message: `Array must contain at most ${schema.maxItems} items` });
    }

    if (schema.uniqueItems) {
        const seen = new Set<string>();
        for (const item of value) {
            const key = stableStringify(item);
            if (seen.has(key)) {
                issues.push({ path, message: 'Array items must be unique' });
                break;
            }
            seen.add(key);
        }
    }

    if (schema.items === undefined) {
        return { success: issues.length === 0, issues, value: value.map((item) => deepClone(item)) };
    }

    if (Array.isArray(schema.items)) {
        return validateTuple(schema.items, value, path, options, issues);
    }

    const items: unknown[] = [];
    value.forEach((element, index) => {
        const childPath = `${path}[${index}]`;
        const outcome = validateNode(schema.items as JsonSchemaDefinition, element, childPath, options);
        issues.push(...outcome.issues);
        if (outcome.success) {
            items.push(outcome.value);
        }
    });

    return {
        success: issues.length === 0,
        issues,
        value: issues.length === 0 ? items : undefined,
    };
}

function validateTuple(
    items: SchemaTuple,
    value: unknown[],
    path: string,
    options: InternalValidationOptions,
    issues: ValidationIssue[]
): NodeValidationResult {
    const length = items.length;
    if (value.length !== length) {
        issues.push({ path, message: `Array must contain exactly ${length} items` });
        return { success: false, issues };
    }

    const tuple: unknown[] = [];

    items.forEach((schema, index) => {
        const childPath = `${path}[${index}]`;
        const outcome = validateNode(schema, value[index], childPath, options);
        issues.push(...outcome.issues);
        if (outcome.success) {
            tuple.push(outcome.value);
        }
    });

    return {
        success: issues.length === 0,
        issues,
        value: issues.length === 0 ? tuple : undefined,
    };
}

function validateObject(
    schema: JsonSchemaDefinition,
    value: Record<string, unknown>,
    path: string,
    options: InternalValidationOptions
): NodeValidationResult {
    if (value === null || Array.isArray(value)) {
        return {
            success: false,
            issues: [{ path, message: 'Expected object value' }],
        };
    }

    const issues: ValidationIssue[] = [];
    const result: Record<string, unknown> = {};
    const properties = schema.properties ?? {};
    const required = new Set(schema.required ?? []);

    for (const key of Object.keys(properties)) {
        const propertySchema = properties[key];
        const hasKey = Object.prototype.hasOwnProperty.call(value, key);
        const propertyPath = `${path}.${key}`;
        const propertyValue = hasKey ? value[key] : undefined;

        if (!hasKey && required.has(key) && propertySchema.default === undefined) {
            issues.push({ path: propertyPath, message: 'Property is required' });
            continue;
        }

        const outcome = validateNode(propertySchema, propertyValue, propertyPath, options);
        issues.push(...outcome.issues);
        if (outcome.success) {
            if (outcome.value !== undefined) {
                result[key] = outcome.value;
            } else if (hasKey && propertyValue !== undefined) {
                result[key] = propertyValue;
            }
        }
    }

    const knownKeys = new Set(Object.keys(properties));
    for (const key of Object.keys(value)) {
        if (knownKeys.has(key)) {
            continue;
        }

        const extraValue = value[key];
        const propertyPath = `${path}.${key}`;

        if (schema.additionalProperties === false) {
            issues.push({ path: propertyPath, message: 'Unexpected property' });
            continue;
        }

        if (typeof schema.additionalProperties === 'object') {
            const outcome = validateNode(schema.additionalProperties, extraValue, propertyPath, options);
            issues.push(...outcome.issues);
            if (outcome.success) {
                result[key] = outcome.value;
            }
            continue;
        }

        // Default behaviour: strip unknown properties similar to zod
    }

    return {
        success: issues.length === 0,
        issues,
        value: issues.length === 0 ? result : undefined,
    };
}

function handleCompositeSchemas(
    schema: JsonSchemaDefinition,
    value: unknown,
    path: string,
    options: InternalValidationOptions
): NodeValidationResult | undefined {
    if (schema.oneOf) {
        const outcomes = schema.oneOf.map((candidate) => validateNode(candidate, value, path, options));
        const successes = outcomes.filter((outcome) => outcome.success);
        if (successes.length === 1) {
            return successes[0];
        }
        const issues: ValidationIssue[] = successes.length === 0
            ? outcomes.flatMap((outcome) => outcome.issues)
            : [{ path, message: 'Value matches multiple schemas (oneOf requires exactly one match)' }];
        return { success: false, issues };
    }

    if (schema.anyOf) {
        for (const candidate of schema.anyOf) {
            const outcome = validateNode(candidate, value, path, options);
            if (outcome.success) {
                return outcome;
            }
        }
        const issues = schema.anyOf.flatMap((candidate) => validateNode(candidate, value, path, options).issues);
        return { success: false, issues };
    }

    if (schema.allOf) {
        let current: NodeValidationResult | undefined;
        for (const candidate of schema.allOf) {
            const outcome = validateNode(candidate, current?.value ?? value, path, options);
            if (!outcome.success) {
                return outcome;
            }
            current = outcome;
        }
        return current ?? { success: true, value, issues: [] };
    }

    if (schema.not) {
        const outcome = validateNode(schema.not, value, path, options);
        if (outcome.success) {
            return {
                success: false,
                issues: [{ path, message: 'Value must not match the disallowed schema (not)' }],
            };
        }
        return {
            success: true,
            value,
            issues: [],
        };
    }

    return undefined;
}

function normalizeTypes(type: JsonSchemaDefinition['type']): JsonPrimitiveType[] {
    if (!type) {
        return [];
    }

    return Array.isArray(type) ? type : [type];
}

function typeMatches(value: unknown, allowed: JsonPrimitiveType[]): boolean {
    if (allowed.length === 0) {
        return true;
    }

    const actual = inferType(value);

    if (actual === 'integer') {
        return allowed.includes('integer') || allowed.includes('number');
    }

    if (actual === 'number') {
        if (allowed.includes('number')) {
            return true;
        }
        if (allowed.includes('integer') && Number.isInteger(value)) {
            return true;
        }
        return false;
    }

    if (actual === 'null') {
        return allowed.includes('null');
    }

    return allowed.includes(actual);
}

function inferType(value: unknown): JsonPrimitiveType {
    if (value === null) {
        return 'null';
    }

    if (Array.isArray(value)) {
        return 'array';
    }

    const type = typeof value;
    if (type === 'number') {
        return Number.isInteger(value as number) ? 'integer' : 'number';
    }

    if (type === 'string' || type === 'boolean') {
        return type;
    }

    if (type === 'object') {
        return 'object';
    }

    throw new Error(`Unsupported value type: ${type}`);
}

function deepClone<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map((item) => deepClone(item)) as unknown as T;
    }
    if (value && typeof value === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
            result[key] = deepClone(val);
        }
        return result as unknown as T;
    }
    return value;
}

function areEqual(a: unknown, b: unknown): boolean {
    if (a === b) {
        return true;
    }

    if (typeof a !== typeof b) {
        return false;
    }

    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            return false;
        }
        return a.every((item, index) => areEqual(item, b[index]));
    }

    if (a && b && typeof a === 'object' && typeof b === 'object') {
        const entriesA = Object.entries(a as Record<string, unknown>);
        const entriesB = Object.entries(b as Record<string, unknown>);
        if (entriesA.length !== entriesB.length) {
            return false;
        }
        return entriesA.every(([key, value]) => areEqual(value, (b as Record<string, unknown>)[key]));
    }

    return false;
}

function isMultipleOf(value: number, divisor: number): boolean {
    const quotient = value / divisor;
    return Number.isInteger(quotient);
}

function isValidUri(value: string): boolean {
    try {
        const url = new URL(value);
        return Boolean(url.protocol) && Boolean(url.host);
    } catch {
        return false;
    }
}

function isValidUuid(value: string): boolean {
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
    return uuidRegex.test(value);
}

function stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    }

    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const serialized = entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(',');
    return `{${serialized}}`;
}
