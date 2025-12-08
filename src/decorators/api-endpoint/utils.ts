import type { Type } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';

import { get, isEmpty, set } from 'lodash';

import { PAGINATION_TYPE } from '../../constants/pagination.constants';
import { ApiResponseDto } from '../../dto/api.response.dto';
import { ApiCursorPaginatedResponseDto, ApiPaginatedResponseDto } from '../../dto/paginated.response.dto';

import type { ResponseConfig, ValidationErrorExample } from './interfaces';
import type { PaginationType } from '../../constants/pagination.constants';

/**
 * Get default description for HTTP status codes
 */
export const getHttpStatusDescription = (status: HttpStatus): string => {
    const statusDescriptions: Partial<Record<HttpStatus, string>> = {
        [HttpStatus.BAD_REQUEST]: 'Bad Request',
        [HttpStatus.CONFLICT]: 'Conflict',
        [HttpStatus.FORBIDDEN]: 'Forbidden',
        [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
        [HttpStatus.NOT_FOUND]: 'Not Found',
        [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
        [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
        [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
        [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
    };

    return get(statusDescriptions, status, `HTTP ${status}`);
};

/**
 * Get default error message for HTTP status codes
 */
export const getDefaultErrorMessage = (status: HttpStatus): string => {
    const errorMessages: Partial<Record<HttpStatus, string>> = {
        [HttpStatus.BAD_REQUEST]: 'Invalid input data provided',
        [HttpStatus.CONFLICT]: 'Resource already exists or constraint violation',
        [HttpStatus.FORBIDDEN]: 'Insufficient permissions',
        [HttpStatus.INTERNAL_SERVER_ERROR]: 'An unexpected error occurred while processing your request',
        [HttpStatus.NOT_FOUND]: 'The requested resource was not found',
        [HttpStatus.SERVICE_UNAVAILABLE]: 'Service is temporarily unavailable',
        [HttpStatus.TOO_MANY_REQUESTS]: 'Rate limit exceeded. Please try again later',
        [HttpStatus.UNAUTHORIZED]: 'Invalid or missing authentication',
        [HttpStatus.UNPROCESSABLE_ENTITY]: 'The request data is invalid',
    };

    return get(errorMessages, status, 'An error occurred');
};

/**
 * Normalize response configuration
 */
export const normalizeResponseConfig = <T>(
    response: null | ResponseConfig<T> | Type<T> | undefined,
): null | ResponseConfig<T> => {
    if (!response) return null;

    if (typeof response === 'function') {
        // It's a Type<T>
        return { type: response };
    }

    return response;
};

/**
 * Helper function to get paginated response type based on pagination configuration.
 * @template T - Type of the data items
 * @param {PaginationType | undefined} pagination - Type of pagination to use
 * @param {Type<T>} type - Data type class
 * @returns {Type<unknown>} Appropriate response DTO type for pagination
 */
export const getPaginatedType = <T>(pagination: PaginationType | undefined, type: Type<T>): Type<unknown> => {
    if (pagination === PAGINATION_TYPE.OFFSET) {
        return ApiPaginatedResponseDto(type);
    } else if (pagination === PAGINATION_TYPE.CURSOR) {
        return ApiCursorPaginatedResponseDto(type);
    }

    return ApiResponseDto(type);
};

/**
 * Create validation error response example
 */
export const createValidationErrorExample = (errorExamples: ValidationErrorExample[]) => {
    const fieldErrors: Record<string, Record<string, string>> = {};
    const errors: string[] = [];

    errorExamples.forEach(({ constraint, field, message }) => {
        if (isEmpty(get(fieldErrors, field))) {
            set(fieldErrors, field, {});
        }

        set(fieldErrors, [field, constraint], message);
        errors.push(message);
    });

    return {
        error: 'Validation failed',
        errors,
        fieldErrors,
        message: 'Validation failed',
        path: '/api/example',
        statusCode: 400,
        timestamp: '2025-01-15T10:30:00.000Z',
        requestId: 'abc123-def456-ghi789',
    };
};
