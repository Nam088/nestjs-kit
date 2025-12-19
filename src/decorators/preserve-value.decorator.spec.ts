import 'reflect-metadata';

import { getPreserveValueMetadata, PRESERVE_VALUE_KEY, PreserveValue } from './preserve-value.decorator';

describe('PreserveValue Decorator', () => {
    beforeEach(() => {
        // Clear metadata between tests
        jest.clearAllMocks();
    });

    describe('PreserveValue()', () => {
        it('should add property to metadata', () => {
            class TestClass {
                @PreserveValue()
                metadata?: Record<string, unknown>;
            }

            const keys = Reflect.getMetadata(PRESERVE_VALUE_KEY, TestClass) as string[];

            expect(keys).toContain('metadata');
        });

        it('should support multiple properties', () => {
            class TestClass {
                @PreserveValue()
                extra?: Record<string, unknown>;

                @PreserveValue()
                metadata?: Record<string, unknown>;
            }

            const keys = Reflect.getMetadata(PRESERVE_VALUE_KEY, TestClass) as string[];

            expect(keys).toContain('metadata');
            expect(keys).toContain('extra');
            expect(keys.length).toBe(2);
        });

        it('should not add duplicate keys', () => {
            class TestClass {
                metadata?: Record<string, unknown>;
            }

            // Manually apply decorator twice
            PreserveValue()(TestClass.prototype, 'metadata');
            PreserveValue()(TestClass.prototype, 'metadata');

            const keys = Reflect.getMetadata(PRESERVE_VALUE_KEY, TestClass) as string[];

            expect(keys.filter((k) => k === 'metadata').length).toBe(1);
        });

        it('should handle symbol property keys', () => {
            const symbolKey = Symbol('testSymbol');

            class TestClass {
                [symbolKey]?: Record<string, unknown>;
            }

            PreserveValue()(TestClass.prototype, symbolKey);

            const keys = Reflect.getMetadata(PRESERVE_VALUE_KEY, TestClass) as (string | symbol)[];

            expect(keys).toContain(symbolKey);
        });
    });

    describe('getPreserveValueMetadata()', () => {
        it('should return string property names', () => {
            class TestClass {
                @PreserveValue()
                metadata?: Record<string, unknown>;
            }

            const result = getPreserveValueMetadata(TestClass);

            expect(result).toEqual(['metadata']);
        });

        it('should return empty array for class without decorator', () => {
            class PlainClass {
                data?: string;
            }

            const result = getPreserveValueMetadata(PlainClass);

            expect(result).toEqual([]);
        });

        it('should filter out symbol keys', () => {
            const symbolKey = Symbol('testSymbol');

            class TestClass {
                @PreserveValue()
                metadata?: Record<string, unknown>;

                [symbolKey]?: Record<string, unknown>;
            }

            PreserveValue()(TestClass.prototype, symbolKey);

            const result = getPreserveValueMetadata(TestClass);

            // Only string keys should be returned
            expect(result).toEqual(['metadata']);
        });

        it('should work with class instance', () => {
            class TestClass {
                @PreserveValue()
                metadata?: Record<string, unknown>;
            }

            const instance = new TestClass();
            const result = getPreserveValueMetadata(instance);

            expect(result).toEqual(['metadata']);
        });

        it('should work with class constructor', () => {
            class TestClass {
                @PreserveValue()
                metadata?: Record<string, unknown>;
            }

            const result = getPreserveValueMetadata(TestClass);

            expect(result).toEqual(['metadata']);
        });
    });
});
