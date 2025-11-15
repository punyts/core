export type JsonPrimitiveType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';

export interface JsonSchemaDefinition {
    type?: JsonPrimitiveType | JsonPrimitiveType[];
    title?: string;
    description?: string;
    default?: unknown;
    enum?: unknown[];
    const?: unknown;
    format?: string;
    minimum?: number;
    maximum?: number;
    exclusiveMinimum?: number;
    exclusiveMaximum?: number;
    multipleOf?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    minItems?: number;
    maxItems?: number;
    uniqueItems?: boolean;
    items?: JsonSchemaDefinition | JsonSchemaDefinition[];
    properties?: Record<string, JsonSchemaDefinition>;
    required?: string[];
    additionalProperties?: boolean | JsonSchemaDefinition;
    anyOf?: JsonSchemaDefinition[];
    oneOf?: JsonSchemaDefinition[];
    allOf?: JsonSchemaDefinition[];
    not?: JsonSchemaDefinition;
}

export type JsonSchema<T = unknown> = JsonSchemaDefinition & { readonly __type?: T };

export function defineSchema<T>(schema: JsonSchemaDefinition): JsonSchema<T> {
    return schema as JsonSchema<T>;
}

export type InferSchema<TSchema extends JsonSchema<unknown>> = TSchema extends JsonSchema<infer T> ? T : never;
