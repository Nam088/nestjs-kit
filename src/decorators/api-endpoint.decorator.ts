import type { Type } from '@nestjs/common';
import { applyDecorators, HttpStatus, SetMetadata } from '@nestjs/common';

import {
    ApiConsumes,
    ApiForbiddenResponse,
    ApiOperation,
    ApiProduces,
    ApiTags,
    ApiTooManyRequestsResponse,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { isArray, isEmpty, isNumber } from 'lodash';

// Import constants
import { ErrorResponseDto } from '../dto/error.response.dto';

import {
    createAuthDecorators,
    createBodyDecorators,
    createCommonErrorDecorators,
    createCustomErrorDecorators,
    createHeaderDecorators,
    createParamDecorators,
    createQueryDecorators,
    createResponseDecorators,
    createValidationDecorators,
} from './api-endpoint/builders';
import {
    type ApiEndpointOptions,
    type AuthConfig,
    type ResponseConfig,
    type ValidationErrorExample,
} from './api-endpoint/interfaces';
import { normalizeResponseConfig } from './api-endpoint/utils';

import type { PaginationType } from '../constants/pagination.constants';

// Re-export interfaces for consumers
export type * from './api-endpoint/interfaces';

const getOperationDecorators = <T>(options: ApiEndpointOptions<T>) => {
    const {
        apiUrl,
        consumes,
        deprecated = false,
        description = '',
        externalDocs,
        produces,
        summary,
        tags,
        operationId,
    } = options;

    const decorators: (ClassDecorator | MethodDecorator | PropertyDecorator)[] = [];

    const operationOptions: Record<string, unknown> = {
        description: description ? `${description}\n\n**API URL:** \`${apiUrl}\`` : `**API URL:** \`${apiUrl}\``,
        summary,
    };

    if (operationId) operationOptions.operationId = operationId;

    if (deprecated) operationOptions.deprecated = deprecated;

    if (externalDocs) operationOptions.externalDocs = externalDocs;

    decorators.push(ApiOperation(operationOptions));

    if (tags) {
        decorators.push(ApiTags(...(isArray(tags) ? tags : [tags])));
    }

    if (!isEmpty(consumes)) decorators.push(ApiConsumes(...(consumes as string[])));

    if (!isEmpty(produces)) decorators.push(ApiProduces(...(produces as string[])));

    return decorators;
};

const getRequestDecorators = <T>(options: ApiEndpointOptions<T>) => {
    const { body, headers = [], params = [], queries = [] } = options;
    const decorators: MethodDecorator[] = [];

    if (body) decorators.push(...createBodyDecorators(body));

    decorators.push(...createQueryDecorators(queries));
    decorators.push(...createParamDecorators(params));
    decorators.push(...createHeaderDecorators(headers));

    return decorators;
};

const getResponseDecorators = <T>(options: ApiEndpointOptions<T>) => {
    const { auth, errors = [], includeCommonErrors = false, paginationType, responses } = options;
    const decorators: MethodDecorator[] = [];

    if (responses) {
        decorators.push(...createResponseDecorators(responses, paginationType));
    }

    if (auth) {
        decorators.push(...createAuthDecorators(auth));
        const authConfigs = Array.isArray(auth) ? auth : [auth];

        if (authConfigs.some((config) => config.required !== false)) {
            decorators.push(
                ApiUnauthorizedResponse({
                    type: ErrorResponseDto,
                    description: 'Unauthorized - Invalid or missing authentication',
                }),
                ApiForbiddenResponse({
                    type: ErrorResponseDto,
                    description: 'Forbidden - Insufficient permissions',
                }),
            );
        }
    }

    if (includeCommonErrors) decorators.push(...createCommonErrorDecorators());

    if (!isEmpty(errors)) decorators.push(...createCustomErrorDecorators(errors));

    return decorators;
};

const getMetadataDecorators = <T>(options: ApiEndpointOptions<T>) => {
    const { cache, errors = [], rateLimit, validation } = options;
    const decorators: (ClassDecorator | MethodDecorator | PropertyDecorator)[] = [];

    if (validation) {
        decorators.push(...createValidationDecorators(validation));

        if (validation.groups) {
            decorators.push(SetMetadata('validationGroups', validation.groups));
        }
    }

    if (rateLimit) {
        decorators.push(SetMetadata('rateLimit', rateLimit));

        if (
            !errors.some((e) =>
                isNumber(e) ? e === HttpStatus.TOO_MANY_REQUESTS : e.status === HttpStatus.TOO_MANY_REQUESTS,
            )
        ) {
            decorators.push(
                ApiTooManyRequestsResponse({
                    type: ErrorResponseDto,
                    description: rateLimit.message || 'Rate limit exceeded',
                }),
            );
        }
    }

    if (cache) decorators.push(SetMetadata('cacheTtl', cache.ttl));

    return decorators;
};

/**
 * Enhanced decorator to standardize Swagger documentation and API response structure.
 * Provides comprehensive configuration options for modern API documentation.
 *
 * @param {ApiEndpointOptions<T>} options - The configuration for the endpoint's documentation
 * @returns {MethodDecorator} - A decorator that applies comprehensive Swagger documentation
 */
export const ApiEndpoint = <T>(options: ApiEndpointOptions<T>): MethodDecorator => {
    const decorators = [
        ...getOperationDecorators(options),
        ...getRequestDecorators(options),
        ...getResponseDecorators(options),
        ...getMetadataDecorators(options),
    ];

    return applyDecorators(...decorators);
};

// --- Helper decorators for common patterns ---

/**
 * Creates a generic endpoint decorator for a specific HTTP method.
 */
const createMethodEndpoint = <T>(
    methodStatus: HttpStatus,
    options: Omit<ApiEndpointOptions<T>, 'responses'> & {
        response?: null | ResponseConfig<T> | Type<T>;
    },
) => {
    const responses = options.response
        ? { [methodStatus]: normalizeResponseConfig(options.response) || { type: null } }
        : undefined;

    return ApiEndpoint({ ...options, responses });
};

/**
 * Shorthand decorator for GET endpoints with simplified response configuration.
 */
export const ApiGetEndpoint = <T>(
    options: Omit<ApiEndpointOptions<T>, 'responses'> & { response?: null | ResponseConfig<T> | Type<T> },
) => createMethodEndpoint(HttpStatus.OK, options);

/**
 * Shorthand decorator for POST endpoints with simplified response configuration.
 */
export const ApiPostEndpoint = <T>(
    options: Omit<ApiEndpointOptions<T>, 'responses'> & { response?: null | ResponseConfig<T> | Type<T> },
) => createMethodEndpoint(HttpStatus.CREATED, options);

/**
 * Shorthand decorator for PUT endpoints with simplified response configuration.
 */
export const ApiPutEndpoint = <T>(
    options: Omit<ApiEndpointOptions<T>, 'responses'> & { response?: null | ResponseConfig<T> | Type<T> },
) => createMethodEndpoint(HttpStatus.OK, options);

/**
 * Shorthand decorator for PATCH endpoints with simplified response configuration.
 */
export const ApiPatchEndpoint = <T>(
    options: Omit<ApiEndpointOptions<T>, 'responses'> & { response?: null | ResponseConfig<T> | Type<T> },
) => createMethodEndpoint(HttpStatus.OK, options);

/**
 * Shorthand decorator for DELETE endpoints with no content response.
 */
export const ApiDeleteEndpoint = <T>(options: Omit<ApiEndpointOptions<T>, 'responses'>) =>
    ApiEndpoint({
        ...options,
        responses: { [HttpStatus.NO_CONTENT]: { type: null, description: 'Deleted successfully' } },
    });

/**
 * Shorthand decorator for paginated endpoints with specified pagination type.
 */
export const ApiPaginatedEndpoint = <T>(
    options: Omit<ApiEndpointOptions<T>, 'paginationType'> & {
        paginationType: PaginationType;
    },
) => ApiEndpoint(options);

/**
 * Shorthand decorator for authenticated endpoints with automatic common error responses.
 */
export const ApiAuthEndpoint = <T>(
    options: Omit<ApiEndpointOptions<T>, 'auth'> & {
        auth: AuthConfig | AuthConfig[];
    },
) => ApiEndpoint({ ...options, includeCommonErrors: true });

/**
 * Shorthand decorator for endpoints with validation error documentation.
 */
export const ApiValidationEndpoint = <T>(
    options: Omit<ApiEndpointOptions<T>, 'validation'> & {
        validation?: {
            errorExamples?: ValidationErrorExample[];
            groups?: string[];
        };
    },
) =>
    ApiEndpoint({
        ...options,
        validation: {
            ...options.validation,
            includeValidationErrors: true,
        },
    });
