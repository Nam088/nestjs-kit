import { Reflector } from '@nestjs/core';

import type {
    CallHandler,
    ClassSerializerInterceptorOptions,
    ExecutionContext,
    NestInterceptor,
    PlainLiteralObject,
} from '@nestjs/common';
import { ClassSerializerInterceptor, Injectable, StreamableFile } from '@nestjs/common';

import type { ClassTransformOptions } from 'class-transformer';
import { instanceToPlain } from 'class-transformer';

import { cloneDeep, get, has, isObject, set } from 'lodash';

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
 * Based on NestJS ClassSerializerInterceptor implementation.
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
     * Serializes responses that are non-null objects nor streamable files.
     * Based on NestJS ClassSerializerInterceptor.serialize()
     * @param {PlainLiteralObject | PlainLiteralObject[]} response - Response data
     * @param {ClassTransformOptions} options - Transform options
     * @returns {PlainLiteralObject | PlainLiteralObject[]} Serialized response
     */
    serialize(
        response: PlainLiteralObject | PlainLiteralObject[],
        options: ClassTransformOptions,
    ): PlainLiteralObject | PlainLiteralObject[] {
        if (!isObject(response) || response instanceof StreamableFile) {
            return response;
        }

        return Array.isArray(response)
            ? response.map((item) => this.transformToPlain(item, options))
            : this.transformToPlain(response, options);
    }

    /**
     * Transforms a class instance to plain object with field preservation.
     * Based on NestJS ClassSerializerInterceptor.transformToPlain()
     * @param {PlainLiteralObject} plainOrClass - Object to transform
     * @param {ClassTransformOptions} options - Transform options
     * @returns {PlainLiteralObject} Transformed plain object
     */
    transformToPlain(plainOrClass: PlainLiteralObject, options: ClassTransformOptions): PlainLiteralObject {
        if (!plainOrClass) {
            return plainOrClass;
        }

        // Get fields to preserve from decorator and options
        const fieldsToPreserve = this.getFieldsToPreserve(plainOrClass);

        // Extract fields to preserve before transformation
        const preservedValues: Record<string, unknown> = {};

        for (const field of fieldsToPreserve) {
            if (has(plainOrClass, field)) {
                const value = get(plainOrClass, field) as unknown;

                set(preservedValues, field, value !== undefined && value !== null ? cloneDeep(value) : value);
            }
        }

        // Apply standard class-transformer serialization
        const serialized = instanceToPlain(plainOrClass, options) as PlainLiteralObject;

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
     * Based on NestJS ClassSerializerInterceptor.intercept()
     * @param {ExecutionContext} context - Execution context
     * @param {CallHandler} next - Next handler in the chain
     * @returns {Observable<unknown>} Observable with serialized response
     */
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const contextOptions = this.getContextOptions(context);
        const options = {
            ...this.defaultOptions,
            ...contextOptions,
        };

        return next.handle().pipe(map((res: PlainLiteralObject) => this.serialize(res, options)));
    }
}
