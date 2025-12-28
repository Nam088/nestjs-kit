/* eslint-disable complexity */
/* eslint-disable sonarjs/cognitive-complexity */
import { Reflector } from '@nestjs/core';

import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

import { get, isArray, isObject, isString, size } from 'lodash';

import { v4 as uuidv4 } from 'uuid';

import { ErrorResponseDto } from '../dto/error.response.dto';

import type { Request, Response } from 'express';

/**
 * Interface for error metrics tracking functionality.
 */
export interface ErrorMetrics {
    /** Function to increment error count metrics */
    increment: (status: number, path: string, method: string) => void;
}

/**
 * Configuration options for HttpExceptionFilter.
 */
export interface HttpExceptionFilterOptions {
    /** Custom error messages for specific HTTP status codes */
    customErrorMessages?: Record<number, string>;
    /** Whether to enable error metrics tracking */
    enableMetrics?: boolean;
    /** Whether to enable rate limit tracking */
    enableRateLimitTracking?: boolean;
    /** Whether to enable sensitive data sanitization */
    enableSanitization?: boolean;
    /** Whether the application is running in development mode */
    isDevelopment: boolean;
}

/**
 * Interface for rate limit tracking functionality.
 */
export interface RateLimitTracker {
    /** Function to track rate limit violations */
    track: (ip: string, path: string) => void;
}

/**
 * Interface for sanitized error objects.
 */
interface SanitizedError {
    /** Sanitized error message */
    message: string;
    /** Sanitized stack trace (optional) */
    stack?: string;
}

/**
 * Global exception filter for handling and formatting HTTP exceptions.
 * Provides comprehensive error handling with sanitization, metrics, and development features.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly customErrorMessages: Record<number, string>;
    private readonly enableMetrics: boolean;
    private readonly enableRateLimitTracking: boolean;
    private readonly enableSanitization: boolean;
    private readonly errorMetrics?: ErrorMetrics;
    private readonly isDevelopment: boolean;
    private readonly logger = new Logger(HttpExceptionFilter.name);
    private readonly rateLimitTracker?: RateLimitTracker;
    private readonly reflector: Reflector;

    // Sensitive information patterns to sanitize
    private readonly sensitivePatterns = [
        /password[s]?[:\s=]+[^\s]+/gi,
        /token[s]?[:\s=]+[^\s]+/gi,
        /key[s]?[:\s=]+[^\s]+/gi,
        /secret[s]?[:\s=]+[^\s]+/gi,
        /api[_-]?key[s]?[:\s=]+[^\s]+/gi,
        /authorization[:\s=]+[^\s]+/gi,
        /bearer\s+[^\s]+/gi,
        /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card numbers
        /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    ];

    /**
     * Creates a new HttpExceptionFilter instance.
     * @param {Reflector} reflector - NestJS reflector for metadata access
     * @param {HttpExceptionFilterOptions} options - Optional filter configuration
     * @param {ErrorMetrics} errorMetrics - Optional error metrics tracker
     * @param {RateLimitTracker} rateLimitTracker - Optional rate limit tracker
     * @example
     * const filter = new HttpExceptionFilter(
     *   reflector,
     *   { isDevelopment: true, enableSanitization: true }
     * );
     */
    constructor(
        reflector: Reflector,
        options?: HttpExceptionFilterOptions,
        errorMetrics?: ErrorMetrics,
        rateLimitTracker?: RateLimitTracker,
    ) {
        this.reflector = reflector;
        this.isDevelopment = options?.isDevelopment ?? false;
        this.enableSanitization = options?.enableSanitization ?? true;
        this.enableRateLimitTracking = options?.enableRateLimitTracking ?? false;
        this.enableMetrics = options?.enableMetrics ?? false;
        this.customErrorMessages = options?.customErrorMessages ?? {};
        this.errorMetrics = errorMetrics;
        this.rateLimitTracker = rateLimitTracker;
    }

    /**
     * Builds the error payload for response formatting.
     * @param {number} status - HTTP status code
     * @param {string | object} errorResponse - Error response data
     * @param {Request} request - Express request object
     * @param {string} correlationId - Correlation ID for request tracking
     * @param {unknown} exception - The original exception
     * @returns {ErrorResponseDto} Formatted error response
     */
    private buildErrorPayload(
        status: HttpStatus,
        errorResponse:
            | string
            | {
                  code?: string;
                  data?: Record<string, unknown>;
                  details?: Record<string, unknown>;
                  error: string;
                  message: string | string[];
              },
        request: Request,
        correlationId: string,
        exception: unknown,
    ): ErrorResponseDto {
        // Handle Zod validation errors (from BadRequestException with errors array)
        if (
            exception instanceof HttpException &&
            status === HttpStatus.BAD_REQUEST &&
            typeof errorResponse === 'object' &&
            'errors' in errorResponse &&
            isArray(errorResponse.errors)
        ) {
            const basePayload: ErrorResponseDto = {
                error: 'Validation failed',
                errors: errorResponse.errors,
                message: isString(errorResponse.message) ? errorResponse.message : 'Validation failed',
                path: request.url,
                statusCode: status,
                timestamp: new Date().toISOString(),
                requestId: correlationId,
            };

            // Sanitize in production
            if (!this.isDevelopment && this.enableSanitization) {
                basePayload.message = this.sanitizeString(basePayload.message);
            }

            return basePayload;
        }

        // Handle other error types
        let message: string;
        let errors: string[] | undefined;

        if (isString(errorResponse)) {
            message = errorResponse;
        } else if (isArray(errorResponse.message)) {
            const firstMessage = get(errorResponse, 'message[0]', 'Validation failed');
            const remainingMessages = get(errorResponse, 'message.slice(1)', []);

            message = firstMessage;
            errors = size(remainingMessages) > 0 ? remainingMessages : undefined;
        } else if (isString(errorResponse.message)) {
            const { message: errorMessage } = errorResponse;

            message = errorMessage;
        } else {
            const { message: errorMessage } = errorResponse;

            message = String(errorMessage || 'An error occurred');
        }

        const { url } = request;
        const basePayload: ErrorResponseDto = {
            code: isObject(errorResponse) && 'code' in errorResponse ? String(errorResponse.code) : undefined,
            error: isString(errorResponse) ? errorResponse : errorResponse.error,
            errors,
            message,
            path: url,
            statusCode: status,
            timestamp: new Date().toISOString(),
            requestId: correlationId,
        };

        if (isObject(errorResponse) && 'data' in errorResponse && errorResponse.data) {
            basePayload.data = errorResponse.data;
        }

        // Add additional details in development mode
        if (this.isDevelopment) {
            if (exception instanceof Error && exception.stack) {
                basePayload.stack = this.enableSanitization
                    ? this.sanitizeError({ message: exception.message, stack: exception.stack }).stack
                    : exception.stack;
            }

            if (isObject(errorResponse) && 'details' in errorResponse && errorResponse.details) {
                basePayload.details = errorResponse.details;
            }

            const { headers, method } = request;

            basePayload.method = method;
            basePayload.userAgent = headers['user-agent'];
        }

        // Sanitize error messages in production
        if (!this.isDevelopment && this.enableSanitization) {
            // Sanitize main message
            const sanitized = this.sanitizeError({
                message: basePayload.message,
                stack: basePayload.stack,
            });

            basePayload.message = sanitized.message;

            if (basePayload.stack) {
                basePayload.stack = sanitized.stack;
            }

            // Sanitize validation errors if present
            if (basePayload.errors && isArray(basePayload.errors)) {
                basePayload.errors = basePayload.errors.map((error) => this.sanitizeString(error));
            }
        }

        return basePayload;
    }

    private getClientIp(request: Request): string {
        return (
            (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
            (request.headers['x-real-ip'] as string) ||
            request.socket.remoteAddress ||
            'unknown'
        );
    }

    private getErrorNameByStatus(status: number): string {
        const statusNames: Record<number, string> = {
            [HttpStatus.BAD_GATEWAY]: 'Bad Gateway',
            [HttpStatus.BAD_REQUEST]: 'Bad Request',
            [HttpStatus.CONFLICT]: 'Conflict',
            [HttpStatus.FORBIDDEN]: 'Forbidden',
            [HttpStatus.GATEWAY_TIMEOUT]: 'Gateway Timeout',
            [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
            [HttpStatus.METHOD_NOT_ALLOWED]: 'Method Not Allowed',
            [HttpStatus.NOT_FOUND]: 'Not Found',
            [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
            [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
            [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
            [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
        };

        return get(statusNames, status, 'Unknown Error');
    }

    private getErrorResponse(
        exception: unknown,
        status: number,
    ):
        | string
        | {
              data?: Record<string, unknown>;
              details?: Record<string, unknown>;
              error: string;
              message: string | string[];
          } {
        if (exception instanceof HttpException) {
            return exception.getResponse() as
                | string
                | {
                      code?: string;
                      data?: Record<string, unknown>;
                      details?: Record<string, unknown>;
                      error: string;
                      message: string | string[];
                  };
        }

        const { customErrorMessages } = this;
        const customMessage = get(customErrorMessages, status);

        if (customMessage) {
            return {
                error: this.getErrorNameByStatus(status),
                message: customMessage,
            };
        }

        return {
            error: this.getErrorNameByStatus(status),
            message: exception instanceof Error ? exception.message : 'An unexpected error occurred',
        };
    }

    private getHttpStatus(exception: unknown): number {
        if (exception instanceof HttpException) {
            return exception.getStatus();
        }

        // Handle specific error types
        if (exception instanceof Error) {
            switch (exception.name) {
                case 'ConflictError':
                    return HttpStatus.CONFLICT;

                case 'ForbiddenError':
                    return HttpStatus.FORBIDDEN;

                case 'JsonWebTokenError':
                    return HttpStatus.UNAUTHORIZED;

                case 'NotFoundError':
                    return HttpStatus.NOT_FOUND;

                case 'PayloadTooLargeError':
                    return HttpStatus.PAYLOAD_TOO_LARGE;

                case 'TimeoutError':
                    return HttpStatus.REQUEST_TIMEOUT;

                case 'TokenExpiredError':
                    return HttpStatus.UNAUTHORIZED;

                case 'TooManyRequestsError':
                    return HttpStatus.TOO_MANY_REQUESTS;

                case 'UnauthorizedError':
                    return HttpStatus.UNAUTHORIZED;

                case 'ValidationError':
                    return HttpStatus.BAD_REQUEST;

                default:
                    return HttpStatus.INTERNAL_SERVER_ERROR;
            }
        }

        return HttpStatus.INTERNAL_SERVER_ERROR;
    }

    private getOrCreateCorrelationId(request: Request, response: Response): string {
        const existingId =
            (request.headers['x-correlation-id'] as string) ||
            (request.headers['x-request-id'] as string) ||
            (request.headers['x-trace-id'] as string);

        const correlationId = existingId || uuidv4();

        response.setHeader('x-correlation-id', correlationId);
        response.setHeader('x-request-id', correlationId);

        return correlationId;
    }

    private setSecurityHeaders(response: Response): void {
        // Prevent information leakage
        response.removeHeader('X-Powered-By');
        response.setHeader('X-Content-Type-Options', 'nosniff');
        response.setHeader('X-Frame-Options', 'DENY');
        response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        response.setHeader('Pragma', 'no-cache');
        response.setHeader('Expires', '0');
    }

    /**
     * Sanitizes error objects by removing sensitive information.
     * @param {SanitizedError} error - Error object to sanitize
     * @returns {SanitizedError} Sanitized error object
     */
    private sanitizeError(error: SanitizedError): SanitizedError {
        const sanitizedMessage = this.sanitizeString(error.message);
        const sanitizedStack = this.sanitizeString(error.stack || '');

        return {
            message: sanitizedMessage,
            stack: sanitizedStack,
        };
    }

    /**
     * Sanitizes strings by removing sensitive information patterns.
     * @param {string} input - String to sanitize
     * @returns {string} Sanitized string with sensitive data replaced
     */
    private sanitizeString(input: string): string {
        if (!isString(input)) {
            return String(input || '');
        }

        let sanitized = input;

        this.sensitivePatterns.forEach((pattern) => {
            sanitized = sanitized.replace(pattern, '[REDACTED]');
        });

        return sanitized;
    }

    /**
     * Main exception handler method implementing ExceptionFilter interface.
     * @param {unknown} exception - The caught exception
     * @param {ArgumentsHost} host - NestJS arguments host for context
     */
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        // Early return if response already sent
        if (response.headersSent) {
            this.logger.warn('Cannot send error response - headers already sent');

            return;
        }

        try {
            const status = this.getHttpStatus(exception);
            const errorResponse = this.getErrorResponse(exception, status);
            const correlationId = this.getOrCreateCorrelationId(request, response);
            const clientIp = this.getClientIp(request);

            // Track rate limits if enabled
            if (this.enableRateLimitTracking && this.rateLimitTracker) {
                this.rateLimitTracker.track(clientIp, request.url);
            }

            // Record metrics if enabled
            if (this.enableMetrics && this.errorMetrics) {
                this.errorMetrics.increment(status, request.url, request.method);
            }

            const errorPayload = this.buildErrorPayload(status, errorResponse, request, correlationId, exception);

            // Add security headers
            this.setSecurityHeaders(response);

            // Log the error with appropriate level
            this.logError(exception, status, request, correlationId, clientIp);

            // Send response with timeout protection
            this.sendErrorResponse(response, status, errorPayload);
        } catch (filterError) {
            // Fallback error handling if the filter itself fails
            this.handleFilterError(filterError, response, request);
        }
    }

    private handleFilterError(filterError: unknown, response: Response, request: Request): void {
        this.logger.error('Exception filter itself failed', filterError);

        // Send minimal error response to prevent hanging
        try {
            if (!response.headersSent) {
                const fallbackError: ErrorResponseDto = {
                    error: 'Internal Server Error',
                    message: 'An unexpected error occurred while processing the request',
                    path: request.url,
                    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                    timestamp: new Date().toISOString(),
                    requestId: uuidv4(),
                };

                response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(fallbackError);
            }
        } catch (finalError) {
            this.logger.error('Failed to send fallback error response', finalError);

            // Last resort - just end the response
            if (!response.headersSent) {
                response.status(500).end('Internal Server Error');
            }
        }
    }

    private logError(
        exception: unknown,
        status: number,
        request: Request,
        correlationId: string,
        clientIp: string,
    ): void {
        const { headers, method, url } = request;
        const logContext = {
            status,
            clientIp,
            method,
            timestamp: new Date().toISOString(),
            url,
            userAgent: headers['user-agent'],
            correlationId,
        };

        if (exception instanceof HttpException) {
            // Client errors (4xx) - log as warning
            if (status >= 400 && status < 500) {
                this.logger.warn(
                    `[${correlationId}] Client Error: ${status} ${request.method} ${request.url} - ${exception.message}`,
                    logContext,
                );
            } else {
                // Server errors (5xx) - log as error
                this.logger.error(
                    `[${correlationId}] Server Error: ${status} ${request.method} ${request.url} - ${exception.message}`,
                    exception.stack,
                    logContext,
                );
            }
        } else {
            const errorMessage = exception instanceof Error ? exception.message : JSON.stringify(exception);

            const errorStack = exception instanceof Error ? exception.stack : JSON.stringify(exception);

            this.logger.error(
                `[${correlationId}] Unhandled Exception: ${status} ${request.method} ${request.url} - ${errorMessage}`,
                errorStack,
                logContext,
            );
        }
    }

    private sendErrorResponse(response: Response, status: number, errorPayload: ErrorResponseDto): void {
        // Set a reasonable timeout for error responses
        const timeout = setTimeout(() => {
            if (!response.headersSent) {
                this.logger.error('Error response timed out');
                response.end();
            }
        }, 5000);

        try {
            response.status(status).json(errorPayload);
            clearTimeout(timeout);
        } catch (error) {
            clearTimeout(timeout);
            this.logger.error('Failed to send error response', error);
        }
    }
}
