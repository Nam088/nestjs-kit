import { ApiProperty } from '@nestjs/swagger';

import { Expose } from 'class-transformer';

/**
 * Defines the standardized shape for all API error responses.
 */
export class ErrorResponseDto {
    @ApiProperty({
        description: 'Additional data payload, if any.',
        required: false,
    })
    @Expose()
    data?: Record<string, unknown>;

    @ApiProperty({
        description: 'Additional error details, available only in development.',
        required: false,
    })
    @Expose()
    details?: Record<string, unknown>;

    @ApiProperty({
        description: 'A short description of the error, e.g., "Internal Server Error".',
        example: 'Internal Server Error',
    })
    @Expose()
    error!: string;

    @ApiProperty({
        description: 'Validation errors array, present when validation fails.',
        example: ['Email is required', 'Password must be at least 8 characters'],
        required: false,
    })
    @Expose()
    errors?: string[];

    @ApiProperty({
        description: 'Validation errors with original constraints format.',
        example: {
            name: {
                isNotEmpty: 'name should not be empty',
            },
            email: {
                isEmail: 'email must be an email',
            },
        },
        required: false,
    })
    @Expose()
    fieldErrors?: Record<string, Record<string, string>>;

    @ApiProperty({
        description: 'A detailed error message.',
        example: 'An unexpected error occurred while processing your request.',
    })
    @Expose()
    message!: string;

    @ApiProperty({
        description: 'The HTTP method of the request, available only in development.',
        example: 'GET',
        required: false,
    })
    @Expose()
    method?: string;

    @ApiProperty({
        description: 'The path of the request that resulted in an error.',
        example: '/api/v1/fonts/query',
    })
    @Expose()
    path!: string;

    @ApiProperty({
        description:
            'The stack trace of the error. This is only available in the development environment for security reasons.',
        example: 'Error: Something went wrong... at functionName (fileName:line:column)',
        required: false,
    })
    @Expose()
    stack?: string;

    @ApiProperty({
        description: 'The HTTP status code.',
        example: 500,
    })
    @Expose()
    statusCode!: number;

    @ApiProperty({
        description: 'The timestamp when the error occurred.',
        example: '2023-10-27T10:00:00.000Z',
    })
    @Expose()
    timestamp!: string;

    @ApiProperty({
        description: 'The user agent of the client, available only in development.',
        example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...',
        required: false,
    })
    @Expose()
    userAgent?: string;

    @ApiProperty({
        description: 'A unique identifier for the request, useful for tracing and correlation in logs.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    @Expose()
    requestId!: string;
}
