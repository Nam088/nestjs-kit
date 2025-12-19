import 'reflect-metadata';

/**
 * Metadata key for PreserveValue decorator
 */
export const PRESERVE_VALUE_KEY = 'preserveValue';

/**
 * Gets all property names marked with @PreserveValue() decorator for a class.
 * @param {object} target - Class constructor or instance
 * @returns {string[]} Array of property names marked for preservation
 * @example
 * const preservedFields = getPreserveValueMetadata(ApiResponseData);
 * // ['metadata']
 */
export function getPreserveValueMetadata(target: object): string[] {
    const constructor = typeof target === 'function' ? target : target.constructor;
    const keys: (string | symbol)[] =
        (Reflect.getMetadata(PRESERVE_VALUE_KEY, constructor) as (string | symbol)[] | undefined) ?? [];

    return keys.filter((key): key is string => typeof key === 'string');
}

/**
 * Decorator to mark a property that should be preserved during serialization.
 * When used with ApiResponseSerializerInterceptor, properties marked with this
 * decorator will not have excludeExtraneousValues applied recursively.
 *
 * This is useful for Record<string, unknown> or plain object properties like metadata.
 *
 * @returns {PropertyDecorator} Property decorator
 * @example
 * class ApiResponseData<T> {
 *   @Expose()
 *   @PreserveValue()
 *   metadata?: Record<string, unknown>;
 * }
 */
export function PreserveValue(): PropertyDecorator {
    return (target: object, propertyKey: string | symbol): void => {
        const existingKeys =
            (Reflect.getMetadata(PRESERVE_VALUE_KEY, target.constructor) as (string | symbol)[] | undefined) ?? [];

        if (!existingKeys.includes(propertyKey)) {
            Reflect.defineMetadata(PRESERVE_VALUE_KEY, [...existingKeys, propertyKey], target.constructor);
        }
    };
}
