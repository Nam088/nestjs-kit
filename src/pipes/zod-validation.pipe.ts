/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable complexity */
import type { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';

import type { core } from 'zod';
import { z } from 'zod';

/**
 * Function to format field names in error messages
 * @param field - The raw field path (e.g., "user.firstName", "items[0].name")
 * @returns Formatted field name for display
 *
 * @example
 * ```typescript
 * // Capitalize first letter
 * const formatter: FieldFormatter = (field) => field.charAt(0).toUpperCase() + field.slice(1);
 *
 * // Convert camelCase to Title Case
 * const formatter: FieldFormatter = (field) =>
 *   field.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
 *
 * // Add prefix
 * const formatter: FieldFormatter = (field) => `Field "${field}"`;
 * ```
 */
export type FieldFormatter = (field: string) => string;

/**
 * Validation error structure returned by the pipe
 */
export interface ValidationError {
    field: string;
    message: string;
}

/**
 * Options for ZodValidationPipe
 */
export interface ZodValidationPipeOptions {
    /**
     * Custom function to format field names in error messages
     * @default undefined (uses raw field path)
     */
    fieldFormatter?: FieldFormatter;
}

/**
 * Custom pipe for validating request data using Zod schemas
 *
 * Features:
 * - User-friendly error messages in English
 * - Detailed field-level validation errors
 * - Support for all Zod v4 validation types
 * - Customizable field name formatting
 *
 * @example
 * ```typescript
 * // Basic usage
 * @Post()
 * async create(@Body(new ZodValidationPipe(createUserSchema)) dto: CreateUserDto) {
 *   return this.service.create(dto);
 * }
 *
 * // With field formatter (capitalize)
 * @Post()
 * async create(
 *   @Body(new ZodValidationPipe(createUserSchema, {
 *     fieldFormatter: (field) => field.charAt(0).toUpperCase() + field.slice(1)
 *   })) dto: CreateUserDto
 * ) {
 *   return this.service.create(dto);
 * }
 *
 * // With custom display names
 * @Post()
 * async create(
 *   @Body(new ZodValidationPipe(createUserSchema, {
 *     fieldFormatter: (field) => `"${field.replace(/([A-Z])/g, ' $1').trim()}"`
 *   })) dto: CreateUserDto
 * ) {
 *   return this.service.create(dto);
 * }
 * ```
 */
export class ZodValidationPipe implements PipeTransform {
    private readonly fieldFormatter: FieldFormatter;

    constructor(
        private schema: z.ZodType,
        options?: ZodValidationPipeOptions,
    ) {
        this.fieldFormatter = options?.fieldFormatter ?? ((field) => field);
    }

    /**
     * Format a field path from Zod issue path array
     */
    private formatPath(path: PropertyKey[]): string {
        if (path.length === 0) return 'value';

        return path
            .map((segment, index) => {
                if (typeof segment === 'number') {
                    return `[${segment}]`;
                }

                return index === 0 ? String(segment) : `.${String(segment)}`;
            })
            .join('');
    }

    /**
     * Transform Zod errors into user-friendly format
     */
    private formatZodErrors(error: z.ZodError): ValidationError[] {
        return error.issues.map((issue) => this.formatZodIssue(issue));
    }

    /**
     * Transform a Zod issue into a user-friendly error message
     */
    private formatZodIssue(issue: core.$ZodIssue): ValidationError {
        const rawField = this.formatPath(issue.path);
        const field = this.fieldFormatter(rawField);
        const { code, message } = issue;

        // If user has set a custom message, preserve it
        if (!this.isDefaultZodMessage(message)) {
            return { field: rawField, message };
        }

        // Handle common cases with custom messages
        switch (code) {
            case 'custom':
                return { field: rawField, message: message || `${field} is invalid` };

            case 'invalid_element':
                return { field: rawField, message: `${field} has an invalid element` };

            case 'invalid_format': {
                const { format } = issue;

                switch (format) {
                    case 'datetime':
                        return { field: rawField, message: `${field} must be a valid datetime` };

                    case 'email':
                        return { field: rawField, message: `${field} must be a valid email address` };

                    case 'regex':
                        return { field: rawField, message: `${field} has an invalid format` };

                    case 'uri':
                        return { field: rawField, message: `${field} must be a valid URI` };

                    case 'url':
                        return { field: rawField, message: `${field} must be a valid URL` };

                    case 'uuid':
                        return { field: rawField, message: `${field} must be a valid UUID` };

                    default:
                        return { field: rawField, message: `${field} has an invalid format` };
                }
            }

            case 'invalid_key':
                return { field: rawField, message: `${field} has an invalid key` };

            case 'invalid_type': {
                const typedIssue = issue as core.$ZodIssueInvalidType;
                const { expected } = typedIssue;

                // Check for undefined (required field)
                if (message.includes('undefined')) {
                    return { field: rawField, message: `${field} is required` };
                }

                // Check for null
                if (message.includes('null')) {
                    return { field: rawField, message: `${field} cannot be null` };
                }

                return { field: rawField, message: `${field} must be ${expected}` };
            }

            case 'invalid_union':
                return { field: rawField, message: `${field} does not match any of the expected types` };

            case 'invalid_value': {
                const typedIssue = issue as core.$ZodIssueInvalidValue;

                if (typedIssue.values && typedIssue.values.length > 0) {
                    return { field: rawField, message: `${field} must be one of: ${typedIssue.values.join(', ')}` };
                }

                return { field: rawField, message: `${field} has an invalid value` };
            }

            case 'not_multiple_of': {
                const typedIssue = issue as core.$ZodIssueNotMultipleOf;

                return { field: rawField, message: `${field} must be a multiple of ${typedIssue.divisor}` };
            }

            case 'too_big': {
                const typedIssue = issue as core.$ZodIssueTooBig;
                const { origin } = typedIssue;
                const max = typedIssue.maximum;

                if (origin === 'string') {
                    return { field: rawField, message: `${field} must be at most ${max} character(s)` };
                }

                if (origin === 'number') {
                    const comparison = typedIssue.inclusive ? 'at most' : 'less than';

                    return { field: rawField, message: `${field} must be ${comparison} ${max}` };
                }

                if (origin === 'array') {
                    return { field: rawField, message: `${field} must have at most ${max} item(s)` };
                }

                return { field: rawField, message };
            }

            case 'too_small': {
                const typedIssue = issue as core.$ZodIssueTooSmall;
                const { origin } = typedIssue;
                const min = typedIssue.minimum;

                if (origin === 'string') {
                    if (min === 1) {
                        return { field: rawField, message: `${field} cannot be empty` };
                    }

                    return { field: rawField, message: `${field} must be at least ${min} character(s)` };
                }

                if (origin === 'number') {
                    const comparison = typedIssue.inclusive ? 'at least' : 'greater than';

                    return { field: rawField, message: `${field} must be ${comparison} ${min}` };
                }

                if (origin === 'array') {
                    return { field: rawField, message: `${field} must have at least ${min} item(s)` };
                }

                return { field: rawField, message };
            }

            case 'unrecognized_keys': {
                const typedIssue = issue;

                return { field: rawField, message: `Unknown field(s): ${typedIssue.keys.join(', ')}` };
            }

            default:
                return { field: rawField, message };
        }
    }

    transform(value: unknown, _metadata: ArgumentMetadata) {
        // Handle undefined or null values
        if (value === undefined || value === null) {
            throw new BadRequestException({
                errors: [{ field: 'body', message: 'Request body is required' }],
                message: 'Validation failed',
            });
        }

        try {
            return this.schema.parse(value);
        } catch (error) {
            if (error instanceof z.ZodError) {
                const formattedErrors = this.formatZodErrors(error);
                const errorSummary = formattedErrors.map((e) => e.message).join('; ');

                throw new BadRequestException({
                    errors: formattedErrors,
                    message: `Validation failed: ${errorSummary}`,
                });
            }

            throw error;
        }
    }

    /**
     * Check if message is a default Zod message (not custom)
     * Default Zod v4 messages start with specific patterns
     */
    private isDefaultZodMessage(message: string): boolean {
        const defaultPatterns = [
            /^Invalid input:/,
            /^Invalid option:/,
            /^Invalid number:/,
            /^Invalid string:/,
            /^Invalid /, // Catch generic "Invalid [noun]" messages
            /^Too big:/,
            /^Too small:/,
            /^Unrecognized key/,
            /^Invalid union/,
        ];

        return defaultPatterns.some((pattern) => pattern.test(message));
    }
}
