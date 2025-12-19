import { Type } from '@nestjs/common';

import { ApiProperty, ApiPropertyOptions } from '@nestjs/swagger';

import { Expose } from 'class-transformer';

/**
 * Interface for the standardized API response structure.
 * @template T The type of the data payload.
 */
export interface IApiResponse<T> {
    data?: null | T; // Allow null or undefined for responses like delete
    message: string;
    metadata?: Record<string, unknown>; // Additional contextual information
    statusCode: number;
}

/**
 * A factory function to create a class for Swagger documentation of standardized API responses.
 * This helps Swagger understand the generic `data` property.
 * @template T - The type of the data payload
 * @param {Type<T> | null} dataType - The class or type of the data payload. Pass null for empty data response
 * @returns {Type<IApiResponse<T>>} The class definition of the API response
 * @example
 * // For responses with data
 * const UserResponseDto = ApiResponseDto(UserDto);
 *
 * // For responses without data (e.g., delete operations)
 * const DeleteResponseDto = ApiResponseDto(null);
 */
export const ApiResponseDto = <T>(dataType: null | Type<T>): Type<IApiResponse<T>> => {
    /**
     * This function determines the correct options for the @ApiProperty decorator
     * based on whether a data type is provided.
     * @returns {ApiPropertyOptions} The configured API property options
     */
    const getApiPropertyOptions = (): ApiPropertyOptions => {
        if (dataType) {
            // If we have a data type, specify it
            return { type: dataType, nullable: true };
        }

        // If data type is null, we just indicate it can be null and provide an example
        return { example: null, nullable: true, required: false };
    };

    /**
     * A concrete implementation class for creating standardized API responses within services.
     * @template T - The type of the data payload
     */
    class ApiResponse implements IApiResponse<T> {
        @ApiProperty(getApiPropertyOptions())
        @Expose()
        data?: null | T;

        @ApiProperty({ description: 'A descriptive message for the result.', example: 'Success' })
        @Expose()
        message!: string;

        @ApiProperty({
            description: 'Additional contextual information',
            example: { timestamp: '2024-01-01T00:00:00Z' },
            required: false,
        })
        @Expose()
        metadata?: Record<string, unknown>;

        @ApiProperty({ description: 'HTTP Status Code', example: 200 })
        @Expose()
        statusCode!: number;
    }

    // Give the dynamically generated class a unique name for Swagger to avoid conflicts.
    const uniqueClassName = `ApiResponseOf${dataType ? dataType.name : 'Null'}`;

    Object.defineProperty(ApiResponse, 'name', { value: uniqueClassName });

    return ApiResponse;
};

/**
 * Interface for ApiResponseData constructor options
 * @template T The type of the data payload.
 */
export interface ApiResponseDataOptions<T> {
    data?: T;
    message?: string;
    metadata?: Record<string, unknown>;
    statusCode?: number;
}

/**
 * A concrete implementation class for creating standardized API responses within services.
 * @template T - The type of the data payload
 */
export class ApiResponseData<T> implements IApiResponse<T> {
    /** The response data payload */
    @Expose()
    data?: T;

    /** Descriptive message for the response */
    @Expose()
    message: string;

    /** Additional contextual information */
    @Expose()
    metadata?: Record<string, unknown>;

    /** HTTP status code */
    @Expose()
    statusCode: number;

    /**
     * Creates a new ApiResponseData instance.
     * @param {ApiResponseDataOptions<T>} options - Configuration options for the response
     * @example
     * // With data and metadata
     * const response = new ApiResponseData({
     *   data: { id: 1, name: 'John' },
     *   message: 'User retrieved successfully',
     *   metadata: { executionTime: '15ms' }
     * });
     *
     * // Without data
     * const responseWithoutData = new ApiResponseData({
     *   message: 'Operation completed successfully'
     * });
     */
    constructor(options: ApiResponseDataOptions<T>) {
        this.statusCode = options.statusCode ?? 200;
        this.message = options.message ?? 'Success';
        this.data = options.data;
        this.metadata = options.metadata;
    }

    /**
     * Static factory method for backward compatibility.
     * @template T - The type of the data payload
     * @param {T} data - The response data (optional)
     * @param {string} message - Success message
     * @param {number} statusCode - HTTP status code
     * @param {Record<string, unknown>} metadata - Additional information (optional)
     * @returns {ApiResponseData<T>} New ApiResponseData instance
     * @deprecated Use constructor with object parameter instead
     * @example
     * const response = ApiResponseData.create(userData, 'Success', 200, { debug: true });
     */
    static create<T>(
        data?: T,
        message = 'Success',
        statusCode = 200,
        metadata?: Record<string, unknown>,
    ): ApiResponseData<T> {
        return new ApiResponseData({ data, message, metadata, statusCode });
    }
}
