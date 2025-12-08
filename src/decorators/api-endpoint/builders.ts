import type { HttpStatus } from '@nestjs/common';

import {
    ApiBadRequestResponse,
    ApiBasicAuth,
    ApiBearerAuth,
    ApiBody,
    ApiConflictResponse,
    ApiConsumes,
    ApiCookieAuth,
    ApiHeader,
    ApiInternalServerErrorResponse,
    ApiNotFoundResponse,
    ApiOAuth2,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiSecurity,
    ApiTooManyRequestsResponse,
} from '@nestjs/swagger';

import { isEmpty, isNumber, keyBy, map, mapValues } from 'lodash';

import { AUTH_TYPE } from '../../constants';
import { ErrorResponseDto } from '../../dto/error.response.dto';

import {
    createValidationErrorExample,
    getDefaultErrorMessage,
    getHttpStatusDescription,
    getPaginatedType,
    normalizeResponseConfig,
} from './utils';

import type {
    ApiKeyAuthConfig,
    AuthConfig,
    BodyConfig,
    CustomErrorConfig,
    HeaderConfig,
    ParamConfig,
    QueryConfig,
    ResponseConfig,
    ValidationErrorExample,
} from './interfaces';
import type { PaginationType } from '../../constants/pagination.constants';

/**
 * Creates API Key authentication decorators based on configuration.
 * @param {ApiKeyAuthConfig} config - API key authentication configuration
 * @returns {MethodDecorator[]} Array of method decorators for API key auth
 */
export const createApiKeyDecorator = (config: ApiKeyAuthConfig): MethodDecorator[] => {
    const decorators: MethodDecorator[] = [];
    const providerName = config.provider || 'api-key';

    // Add API Security decorator
    decorators.push(ApiSecurity(providerName));

    return decorators;
};

/**
 * Creates authentication decorators based on auth configuration.
 * @param {AuthConfig | AuthConfig[]} authConfig - Single or multiple auth configurations
 * @returns {MethodDecorator[]} Array of method decorators for authentication
 */
export const createAuthDecorators = (authConfig: AuthConfig | AuthConfig[]): MethodDecorator[] => {
    const decorators: MethodDecorator[] = [];
    const authConfigs = Array.isArray(authConfig) ? authConfig : [authConfig];

    // Add JWT providers
    const jwtProviders = authConfigs.filter((config) => config.type === AUTH_TYPE.JWT);

    if (jwtProviders.length > 0) {
        // Add individual Bearer Auth for each provider
        jwtProviders.forEach((provider) => {
            const providerName = provider.provider || 'bearer';

            decorators.push(ApiBearerAuth(providerName));
        });
    }

    // Add other auth types
    authConfigs.forEach((config) => {
        switch (config.type) {
            case AUTH_TYPE.API_KEY: {
                const apiKeyDecorators = createApiKeyDecorator(config);

                decorators.push(...apiKeyDecorators);
                break;
            }

            case AUTH_TYPE.BASIC: {
                decorators.push(ApiBasicAuth());
                break;
            }

            case AUTH_TYPE.COOKIE: {
                const cookieName = config.name || 'refresh_token';

                decorators.push(ApiCookieAuth(cookieName));
                break;
            }

            case AUTH_TYPE.OAUTH2: {
                const scopes = config.scopes || ['read', 'write'];
                const providerName = config.provider || 'oauth2';

                decorators.push(ApiOAuth2(scopes, providerName));
                break;
            }

            default: {
                break;
            }
        }
    });

    return decorators;
};

/**
 * Creates body configuration decorators.
 */
export const createBodyDecorators = (body: BodyConfig): MethodDecorator[] => {
    const decorators: MethodDecorator[] = [];
    const bodyOptions: Record<string, unknown> = {};

    if (body.type) bodyOptions.type = body.type;

    if (body.description) bodyOptions.description = body.description;

    if (body.required !== undefined) bodyOptions.required = body.required;

    if (body.examples) bodyOptions.examples = body.examples;

    if (body.files && !isEmpty(body.files)) {
        decorators.push(ApiConsumes('multipart/form-data'));
        bodyOptions.schema = {
            type: 'object',
            properties: mapValues(keyBy(body.files, 'name'), (file) => ({
                type: file.isArray ? 'array' : 'string',
                description: file.description,
                format: 'binary',
            })),
            required: body.files.filter((f) => f.required).map((f) => f.name),
        };
    }

    decorators.push(ApiBody(bodyOptions));

    return decorators;
};

/**
 * Creates query parameter decorators.
 */
export const createQueryDecorators = (queries: QueryConfig[]): MethodDecorator[] =>
    queries.map((query) => {
        const queryOptions: Record<string, unknown> = {
            name: query.name,
            required: query.required || false,
        };

        if (query.type) queryOptions.type = query.type;

        if (query.description) queryOptions.description = query.description;

        if (query.example !== undefined) queryOptions.example = query.example;

        if (query.enum) queryOptions.enum = query.enum;

        return ApiQuery(queryOptions);
    });

/**
 * Creates path parameter decorators.
 */
export const createParamDecorators = (params: ParamConfig[]): MethodDecorator[] =>
    params.map((param) => {
        const isUuid = param.type === 'uuid';
        const schema: { example?: number | string; format?: string; type: 'number' | 'string' } = {
            type: (isUuid ? 'string' : (param.type ?? 'string')) as 'number' | 'string',
            ...(param.format || isUuid ? { format: param.format ?? 'uuid' } : {}),
            ...(param.example !== undefined ? { example: param.example } : {}),
        };

        return ApiParam({
            name: param.name,
            description: param.description,
            required: true,
            schema,
        });
    });

/**
 * Creates header decorators.
 */
export const createHeaderDecorators = (headers: HeaderConfig[]): MethodDecorator[] =>
    headers.map((header) =>
        ApiHeader({
            name: header.name,
            required: header.required || false,
            ...(header.description && { description: header.description }),
            ...(header.example && { example: header.example }),
        }),
    );

/**
 * Creates response decorators.
 */
export const createResponseDecorators = <T>(
    responses: Partial<Record<number, ResponseConfig<T>>>,
    paginationType?: PaginationType,
): MethodDecorator[] => {
    const decorators: MethodDecorator[] = [];

    Object.entries(responses).forEach(([statusCode, config]) => {
        const numStatus = Number(statusCode);
        const responseConfig = normalizeResponseConfig(config);

        if (responseConfig) {
            const responseOptions: Record<string, unknown> = {
                status: numStatus,
                description: responseConfig.description,
            };

            if (responseConfig.type) {
                responseOptions.type = getPaginatedType(paginationType, responseConfig.type);
                responseOptions.isArray = responseConfig.isArray || false;
            }

            if (responseConfig.examples) responseOptions.examples = responseConfig.examples;

            if (responseConfig.headers) responseOptions.headers = responseConfig.headers;

            decorators.push(ApiResponse(responseOptions));
        }
    });

    return decorators;
};

/**
 * Create common error response decorators
 */
export const createCommonErrorDecorators = (): MethodDecorator[] => [
    ApiBadRequestResponse({
        type: ErrorResponseDto,
        description: 'Bad Request - Invalid input data',
        examples: {
            'Bad Request': {
                summary: 'Bad Request Example',
                value: {
                    error: 'Bad Request',
                    message: 'Invalid input data provided',
                    path: '/api/example',
                    statusCode: 400,
                    timestamp: '2025-01-15T10:30:00.000Z',
                    requestId: 'abc123-def456-ghi789',
                },
            },
        },
    }),
    ApiNotFoundResponse({
        type: ErrorResponseDto,
        description: 'Resource not found',
        examples: {
            'Not Found': {
                summary: 'Not Found Example',
                value: {
                    error: 'Not Found',
                    message: 'The requested resource was not found',
                    path: '/api/example',
                    statusCode: 404,
                    timestamp: '2025-01-15T10:30:00.000Z',
                    requestId: 'abc123-def456-ghi789',
                },
            },
        },
    }),
    ApiConflictResponse({
        type: ErrorResponseDto,
        description: 'Conflict - Resource already exists or constraint violation',
        examples: {
            Conflict: {
                summary: 'Conflict Example',
                value: {
                    error: 'Conflict',
                    message: 'Resource already exists or constraint violation',
                    path: '/api/example',
                    statusCode: 409,
                    timestamp: '2025-01-15T10:30:00.000Z',
                    requestId: 'abc123-def456-ghi789',
                },
            },
        },
    }),
    ApiInternalServerErrorResponse({
        type: ErrorResponseDto,
        description: 'Internal Server Error',
        examples: {
            'Internal Server Error': {
                summary: 'Internal Server Error Example',
                value: {
                    error: 'Internal Server Error',
                    message: 'An unexpected error occurred while processing your request',
                    path: '/api/example',
                    statusCode: 500,
                    timestamp: '2025-01-15T10:30:00.000Z',
                    requestId: 'abc123-def456-ghi789',
                },
            },
        },
    }),
    ApiTooManyRequestsResponse({
        type: ErrorResponseDto,
        description: 'Too Many Requests - Rate limit exceeded',
        examples: {
            'Too Many Requests': {
                summary: 'Rate Limit Exceeded Example',
                value: {
                    error: 'Too Many Requests',
                    message: 'Rate limit exceeded. Please try again later',
                    path: '/api/example',
                    statusCode: 429,
                    timestamp: '2025-01-15T10:30:00.000Z',
                    requestId: 'abc123-def456-ghi789',
                },
            },
        },
    }),
];

/**
 * Create custom error decorators
 */
export const createCustomErrorDecorators = (errors: (CustomErrorConfig | HttpStatus)[]): MethodDecorator[] =>
    map(errors, (error) => {
        if (isNumber(error)) {
            // Simple HttpStatus
            return ApiResponse({
                status: error,
                type: ErrorResponseDto,
                description: getHttpStatusDescription(error),
                examples: {
                    [getHttpStatusDescription(error)]: {
                        summary: `${getHttpStatusDescription(error)} Example`,
                        value: {
                            error: getHttpStatusDescription(error),
                            message: getDefaultErrorMessage(error),
                            path: '/api/example',
                            statusCode: error,
                            timestamp: '2025-01-15T10:30:00.000Z',
                            requestId: 'abc123-def456-ghi789',
                        },
                    },
                },
            });
        }

        // Custom error configuration
        return ApiResponse({
            status: error.status,
            type: error.type || ErrorResponseDto,
            description: error.description || getHttpStatusDescription(error.status),
            ...(error.examples && { examples: error.examples }),
        });
    });

/**
 * Create validation decorators
 */
export const createValidationDecorators = (validation: {
    errorExamples?: ValidationErrorExample[];
    includeValidationErrors?: boolean;
}): MethodDecorator[] => {
    const decorators: MethodDecorator[] = [];

    if (validation.includeValidationErrors || validation.errorExamples) {
        const validationErrorExamples: ValidationErrorExample[] = validation.errorExamples || [
            { constraint: 'isEmail', field: 'email', message: 'email must be an email' },
            {
                constraint: 'minLength',
                field: 'password',
                message: 'password must be longer than or equal to 8 characters',
            },
        ];

        const validationErrorExample = createValidationErrorExample(validationErrorExamples);

        decorators.push(
            ApiBadRequestResponse({
                type: ErrorResponseDto,
                description: 'Validation Error - Invalid input data',
                examples: {
                    'Validation Error': {
                        summary: 'Validation Error Example',
                        value: validationErrorExample,
                    },
                },
            }),
        );
    }

    return decorators;
};
