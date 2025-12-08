import type { HttpStatus, Type } from '@nestjs/common';

import type { AUTH_TYPE } from '../../constants';
import type { PaginationType } from '../../constants/pagination.constants';
import type { ApiRoute } from '../../types/api-route.type';

/**
 * Enhanced options for configuring the ApiEndpoint decorator.
 * Provides comprehensive configuration for API endpoint documentation and behavior.
 * @template T - Type of the response data
 */
export interface ApiEndpointOptions<T> {
    // API Route for tracing and documentation (required for better code tracing)
    // Format: @METHOD /path/to/endpoint (e.g., @POST /api/v1/auth/register)
    apiUrl: ApiRoute;

    // Authentication
    auth?: AuthConfig | AuthConfig[];
    // Request configuration
    body?: BodyConfig;
    // Caching
    cache?: {
        description?: string;
        ttl?: number;
    };
    // Content type configuration
    consumes?: string[];

    // Basic configuration
    deprecated?: boolean;
    description?: string;

    // Error handling
    errors?: (CustomErrorConfig | HttpStatus)[];

    // Additional metadata
    externalDocs?: {
        description: string;
        url: string;
    };
    headers?: HeaderConfig[];
    includeCommonErrors?: boolean; // Auto-include 400, 404, 500 etc.
    operationId?: string;

    // Response configuration
    paginationType?: PaginationType;
    params?: ParamConfig[];

    produces?: string[];
    queries?: QueryConfig[];

    // Rate limiting
    rateLimit?: {
        limit: number;
        message?: string;
        window: string;
    };

    responses?: Partial<Record<HttpStatus, ResponseConfig<T>>>;

    summary: string;
    tags?: string | string[];

    // Validation
    validation?: {
        errorExamples?: ValidationErrorExample[];
        groups?: string[];
        includeValidationErrors?: boolean; // Auto-include 400 with validation error format
    };
}

// --- Enhanced Types for configuration ---
/**
 * Individual authentication configurations.
 * Defines authentication settings for API key-based security.
 */
export interface ApiKeyAuthConfig {
    /** Name of the API Key provider */
    provider?: string;
    /** Whether authentication is required */
    required?: boolean;
    /** Authentication type identifier */
    type: typeof AUTH_TYPE.API_KEY;
}

/**
 * Union type for all supported authentication configurations.
 * @example
 * const authConfig: AuthConfig = {
 *   type: AUTH_TYPE.JWT,
 *   provider: 'access-token',
 *   required: true
 * };
 */
export type AuthConfig = ApiKeyAuthConfig | BasicAuthConfig | CookieAuthConfig | JwtAuthConfig | OAuth2AuthConfig;

/**
 * Basic authentication configuration.
 * Defines settings for HTTP Basic authentication.
 */
export interface BasicAuthConfig {
    /** Whether authentication is required */
    required?: boolean;
    /** Authentication type identifier */
    type: typeof AUTH_TYPE.BASIC;
}

/**
 * Request body configuration.
 * Defines how request body should be documented and validated.
 */
export interface BodyConfig {
    /** Description of the request body */
    description?: string;
    /** Example request body values */
    examples?: Record<string, unknown>;
    /** File upload configuration if applicable */
    files?: { description?: string; isArray?: boolean; name: string; required?: boolean }[];
    /** Whether the request body is required */
    required?: boolean;
    /** Type class for the request body */
    type?: Type<unknown>;
}

/**
 * Cookie-based authentication configuration.
 * Defines settings for cookie-based authentication.
 */
export interface CookieAuthConfig {
    /** Name of the cookie */
    name?: string;
    /** Whether authentication is required */
    required?: boolean;
    /** Authentication type identifier */
    type: typeof AUTH_TYPE.COOKIE;
}

/**
 * Custom error response configuration.
 * Defines how custom error responses should be documented.
 */
export interface CustomErrorConfig {
    /** Description of the error */
    description?: string;
    /** Example error responses */
    examples?: Record<string, unknown>;
    /** HTTP status code for the error */
    status: HttpStatus;
    /** Type class for the error response */
    type?: Type<unknown>;
}

/**
 * Header configuration.
 * Defines how custom headers should be documented.
 */
export interface HeaderConfig {
    /** Description of the header */
    description?: string;
    /** Example value for the header */
    example?: string;
    /** Name of the header */
    name: string;
    /** Whether the header is required */
    required?: boolean;
}

/**
 * JWT authentication configuration.
 * Defines settings for JWT Bearer token authentication.
 */
export interface JwtAuthConfig {
    /** Name of the JWT provider */
    provider?: string;
    /** Whether authentication is required */
    required?: boolean;
    /** Authentication type identifier */
    type: typeof AUTH_TYPE.JWT;
}

/**
 * OAuth2 authentication configuration.
 * Defines settings for OAuth2-based authentication with optional scopes.
 */
export interface OAuth2AuthConfig {
    /** Name of the OAuth2 provider */
    provider?: string;
    /** Whether authentication is required */
    required?: boolean;
    /** OAuth2 scopes required for access */
    scopes?: string[];
    /** Authentication type identifier */
    type: typeof AUTH_TYPE.OAUTH2;
}

/**
 * Path parameter configuration.
 * Defines how URL path parameters should be documented and validated.
 */
export interface ParamConfig {
    /** Description of the path parameter */
    description?: string;
    /** Example value for the parameter */
    example?: number | string;
    /** Format specification for the parameter */
    format?: string;
    /** Name of the path parameter */
    name: string;
    /** Type of the parameter */
    type?: 'number' | 'string' | 'uuid';
}

/**
 * Query parameter configuration.
 * Defines how query parameters should be documented and validated.
 */
export interface QueryConfig {
    /** Description of the query parameter */
    description?: string;
    /** Enum values if parameter has restricted values */
    enum?: unknown[];
    /** Example value for the parameter */
    example?: unknown;
    /** Name of the query parameter */
    name: string;
    /** Whether the parameter is required */
    required?: boolean;
    /** Type of the parameter */
    type?: 'array' | 'boolean' | 'number' | 'string';
}

/**
 * Response configuration with multiple status codes.
 * @template T - Type of the response data
 */
export interface ResponseConfig<T> {
    /** Description of the response */
    description?: string;
    /** Example response values */
    examples?: Record<string, unknown>;
    /** Response headers configuration */
    headers?: Record<string, unknown>;
    /** Whether the response is an array */
    isArray?: boolean;
    /** Type class for the response data */
    type: null | Type<T>;
}

/**
 * Validation error example configuration.
 * Defines structure for validation error examples in API documentation.
 */
export interface ValidationErrorExample {
    /** Name of the validation constraint that failed */
    constraint: string;
    /** Field name that failed validation */
    field: string;
    /** Error message for the validation failure */
    message: string;
}
