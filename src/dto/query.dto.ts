import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Expose, Type } from 'class-transformer';

import { OrderDto } from './order.dto';

/**
 * Base Data Transfer Object for query operations.
 * Provides common query functionality like ordering and field selection.
 * Use with Zod schema for validation.
 */
class BaseQueryDto {
    /**
     * Array of fields to sort by with their directions.
     */
    @ApiPropertyOptional({
        type: [OrderDto],
        description: 'Array of fields to sort by.',
    })
    @Expose()
    @Type(() => OrderDto)
    order?: OrderDto[];

    /**
     * Array of field names to include in the response.
     */
    @ApiPropertyOptional({
        type: [String],
        description: 'Array of field names to include in the response.',
        example: ['id', 'email', 'firstName', 'lastName'],
    })
    @Expose()
    select?: string[];
}

/**
 * Factory function to create a custom query DTO with specific filter examples.
 * @param {Record<string, unknown>} filterExample - Example filter object for API documentation
 * @returns {typeof CustomQueryDto} Custom query DTO class with filter example
 * @example
 * const UserQueryDto = createCustomQueryDto({
 *   and: [{ '==': [{ var: 'status' }, 'active'] }]
 * });
 */
export const createCustomQueryDto = (filterExample: Record<string, unknown>) => {
    /**
     * Custom Query DTO with filtering capabilities.
     * Extends BaseQueryDto with JsonLogic filtering support.
     */
    class CustomQueryDto extends BaseQueryDto {
        /**
         * JsonLogic rule for filtering records.
         */
        @ApiProperty({
            type: 'object',
            additionalProperties: true,
            description: 'JsonLogic rule for filtering records.',
            example: filterExample,
        })
        @Expose()
        filter?: Record<string, unknown>;
    }

    return CustomQueryDto;
};

/**
 * Standard Query DTO with default filter example.
 * Provides filtering, ordering, and field selection capabilities.
 */
export class QueryDto extends createCustomQueryDto({ and: [{ '==': [{ var: 'email' }, 'test@example.com'] }] }) {}
