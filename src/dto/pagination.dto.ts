import { ApiPropertyOptional } from '@nestjs/swagger';

import { Expose } from 'class-transformer';

/** Minimum allowed limit value */
const MIN_LIMIT = 1;
/** Maximum allowed limit value */
const MAX_LIMIT = 100;

/**
 * Data Transfer Object for pagination parameters.
 * Provides standardized pagination with limit, page, and search functionality.
 * Use with Zod schema for validation.
 */
export class PaginationDto {
    /**
     * Number of items per page.
     * @default 10
     */
    @ApiPropertyOptional({
        type: Number,
        default: 10,
        description: 'Number of items per page',
        maximum: MAX_LIMIT,
        minimum: MIN_LIMIT,
    })
    @Expose()
    limit? = 10;

    /**
     * Page number (1-based).
     * @default 1
     */
    @ApiPropertyOptional({
        type: Number,
        default: 1,
        description: 'Page number',
        minimum: 1,
    })
    @Expose()
    page? = 1;

    /**
     * Search query string for filtering results.
     */
    @ApiPropertyOptional({ description: 'Search query string', example: 'Myriad Pro' })
    @Expose()
    q?: string;
}
