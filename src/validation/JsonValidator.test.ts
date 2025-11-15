import { describe, expect, it } from 'vitest';
import {
    assertValid,
    defineSchema,
    type JsonSchema,
    validate,
    ValidationError,
} from './index.js';

describe('JsonValidator', () => {
    it('validates required string properties', () => {
        const schema = defineSchema<{ title: string }>({
            type: 'object',
            properties: {
                title: { type: 'string', minLength: 1 },
            },
            required: ['title'],
            additionalProperties: false,
        });

        const result = validate(schema, { title: 'Test' });
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ title: 'Test' });
    });

    it('reports missing required properties', () => {
        const schema = defineSchema<{ title: string }>({
            type: 'object',
            properties: {
                title: { type: 'string' },
            },
            required: ['title'],
        });

        const result = validate(schema, {});
        expect(result.success).toBe(false);
        expect(result.issues).toEqual([
            { path: '$.title', message: 'Property is required' },
        ]);
    });

    it('applies default values when enabled', () => {
        interface Payload {
            title: string;
            description?: string;
        }

        const schema: JsonSchema<Payload> = defineSchema({
            type: 'object',
            properties: {
                title: { type: 'string' },
                description: { type: 'string', default: 'n/a' },
            },
            required: ['title'],
            additionalProperties: false,
        });

        const result = assertValid(schema, { title: 'Example' });
        expect(result).toEqual({ title: 'Example', description: 'n/a' });
    });

    it('validates numeric constraints', () => {
        const schema = defineSchema<{ count: number }>({
            type: 'object',
            properties: {
                count: { type: 'integer', minimum: 0, maximum: 5 },
            },
            required: ['count'],
        });

        const success = validate(schema, { count: 3 });
        expect(success.success).toBe(true);

        const failure = validate(schema, { count: 6 });
        expect(failure.success).toBe(false);
        expect(failure.issues[0]).toEqual({ path: '$.count', message: 'Value must be <= 5' });
    });

    it('validates arrays and nested objects', () => {
        const schema = defineSchema<{ tags: Array<{ label: string }> }>({
            type: 'object',
            properties: {
                tags: {
                    type: 'array',
                    minItems: 1,
                    items: {
                        type: 'object',
                        properties: {
                            label: { type: 'string', minLength: 1 },
                        },
                        required: ['label'],
                        additionalProperties: false,
                    },
                },
            },
            required: ['tags'],
        });

        const result = assertValid(schema, { tags: [{ label: 'alpha' }] });
        expect(result).toEqual({ tags: [{ label: 'alpha' }] });

        const failure = validate(schema, { tags: [{ label: '' }] });
        expect(failure.success).toBe(false);
        expect(failure.issues[0].path).toBe('$.tags[0].label');
    });

    it('supports discriminated unions through oneOf', () => {
        type Payload =
            | { type: 'path'; path: string }
            | { type: 'url'; url: string };

        const schema: JsonSchema<Payload> = defineSchema({
            oneOf: [
                {
                    type: 'object',
                    properties: {
                        type: { const: 'path' },
                        path: { type: 'string', minLength: 1 },
                    },
                    required: ['type', 'path'],
                    additionalProperties: false,
                },
                {
                    type: 'object',
                    properties: {
                        type: { const: 'url' },
                        url: { type: 'string', format: 'uri' },
                    },
                    required: ['type', 'url'],
                    additionalProperties: false,
                },
            ],
        });

        const ok = assertValid(schema, { type: 'path', path: '/tmp/file.txt' });
        expect(ok).toEqual({ type: 'path', path: '/tmp/file.txt' });

        expect(() => assertValid(schema, { type: 'url', url: 'not-a-url' })).toThrow(ValidationError);
    });

    it('rejects unexpected properties when additionalProperties is false', () => {
        const schema = defineSchema<{ name: string }>({
            type: 'object',
            properties: {
                name: { type: 'string' },
            },
            required: ['name'],
            additionalProperties: false,
        });

        const result = validate(schema, { name: 'alpha', extra: true });
        expect(result.success).toBe(false);
        expect(result.issues[0]).toEqual({ path: '$.extra', message: 'Unexpected property' });
    });
});
