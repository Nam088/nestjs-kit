import { Reflector } from '@nestjs/core';

import type {
    CallHandler,
    ClassSerializerInterceptorOptions,
    ExecutionContext,
    NestInterceptor,
    PlainLiteralObject,
} from '@nestjs/common';
import { ClassSerializerInterceptor, Injectable } from '@nestjs/common';

import type { ClassTransformOptions } from 'class-transformer';
import { instanceToPlain } from 'class-transformer';

import { cloneDeep, get, has, set } from 'lodash';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { getPreserveValueMetadata } from '../decorators/preserve-value.decorator';

/**
 * Options for ApiResponseSerializerInterceptor
 */
export interface ApiResponseSerializerOptions extends ClassSerializerInterceptorOptions {
    /**
     * Additional fields that should be preserved as-is without recursive transformation.
     * These are combined with fields marked by @PreserveValue() decorator.
     * @default []
     */
    preserveFields?: string[];
}

/**
 * Custom serializer interceptor that properly handles nested plain objects like metadata.
 * This interceptor extends ClassSerializerInterceptor but preserves fields marked with
 * @PreserveValue() decorator from being recursively transformed with excludeExtraneousValues.
 *
 * @example
 * // In main.ts
 * import { ApiResponseSerializerInterceptor } from '@nam088/nestjs-kit';
 *
 * const reflector = app.get(Reflector);
 * app.useGlobalInterceptors(
 *   new ApiResponseSerializerInterceptor(reflector, {
 *     excludeExtraneousValues: true,
 *     strategy: 'excludeAll',
 *   }),
 * );
 */
@Injectable()
export class ApiResponseSerializerInterceptor extends ClassSerializerInterceptor implements NestInterceptor {
    private readonly additionalPreserveFields: string[];

    /**
     * Creates an instance of ApiResponseSerializerInterceptor.
     * @param {Reflector} reflector - NestJS reflector for metadata
     * @param {ApiResponseSerializerOptions} options - Serialization options
     * @example
     * const interceptor = new ApiResponseSerializerInterceptor(reflector, {
     *   excludeExtraneousValues: true,
     *   strategy: 'excludeAll',
     * });
     */
    constructor(reflector: Reflector, options: ApiResponseSerializerOptions = {}) {
        super(reflector, options);
        this.additionalPreserveFields = options.preserveFields ?? [];
    }

    /**
     * Gets all fields to preserve for a given object.
     * Combines fields from @PreserveValue() decorator with additional preserveFields from options.
     * @param {PlainLiteralObject} data - Object to check
     * @returns {string[]} Array of field names to preserve
     */
    private getFieldsToPreserve(data: PlainLiteralObject): string[] {
        const decoratorFields = getPreserveValueMetadata(data);

        return [...new Set([...decoratorFields, ...this.additionalPreserveFields])];
    }

    /**
     * Serializes data while preserving fields marked with @PreserveValue() decorator.
     * @param {PlainLiteralObject | PlainLiteralObject[]} data - Data to serialize
     * @param {ClassTransformOptions} options - Transform options
     * @returns {PlainLiteralObject | PlainLiteralObject[]} Serialized data
     * @example
     * const result = this.serializeWithPreservation(responseData, transformOptions);
     */
    private serializeWithPreservation(
        data: PlainLiteralObject | PlainLiteralObject[],
        options: ClassTransformOptions,
    ): PlainLiteralObject | PlainLiteralObject[] {
        if (Array.isArray(data)) {
            return data.map((item: PlainLiteralObject) =>
                this.serializeWithPreservation(item, options),
            ) as PlainLiteralObject[];
        }

        if (data === null || data === undefined) {
            return data;
        }

        if (typeof data !== 'object') {
            return data;
        }

        // Get fields to preserve from decorator and options
        const fieldsToPreserve = this.getFieldsToPreserve(data);

        // Extract fields to preserve before transformation
        const preservedValues: Record<string, unknown> = {};

        for (const field of fieldsToPreserve) {
            if (has(data, field)) {
                // Deep clone to avoid mutation
                const value = get(data, field) as unknown;

                set(preservedValues, field, value !== undefined && value !== null ? cloneDeep(value) : value);
            }
        }

        // Apply standard class-transformer serialization
        const serialized = instanceToPlain(data, options) as PlainLiteralObject;

        // Restore preserved fields
        for (const field of fieldsToPreserve) {
            if (has(preservedValues, field)) {
                set(serialized, field, get(preservedValues, field));
            }
        }

        return serialized;
    }

    /**
     * Intercepts the response and applies serialization with field preservation.
     * @param {ExecutionContext} context - Execution context
     * @param {CallHandler} next - Next handler in the chain
     * @returns {Observable<unknown>} Observable with serialized response
     * @example
     * // Automatically called by NestJS when used as global interceptor
     */
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const contextOptions = this.getContextOptions(context);
        const options = {
            ...this.defaultOptions,
            ...contextOptions,
        };

        return next
            .handle()
            .pipe(
                map((data: PlainLiteralObject | PlainLiteralObject[]) => this.serializeWithPreservation(data, options)),
            );
    }
}
