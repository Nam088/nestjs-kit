/* eslint-disable max-lines-per-function */
import 'reflect-metadata';

import { Reflector } from '@nestjs/core';

import { Expose } from 'class-transformer';

import { of } from 'rxjs';

import { PreserveValue } from '../decorators/preserve-value.decorator';

import { ApiResponseSerializerInterceptor, ApiResponseSerializerOptions } from './api-response-serializer.interceptor';

// Mock ExecutionContext
const createMockExecutionContext = (): unknown => ({
    getArgs: jest.fn().mockReturnValue([]),
    getClass: jest.fn().mockReturnValue({}),
    getHandler: jest.fn().mockReturnValue({}),
    getType: jest.fn().mockReturnValue('http'),
    switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({}),
        getResponse: jest.fn().mockReturnValue({}),
    }),
});

// Mock CallHandler
const createMockCallHandler = <T>(data: T): unknown => ({
    handle: jest.fn().mockReturnValue(of(data)),
});

describe('ApiResponseSerializerInterceptor', () => {
    let reflector: Reflector;

    beforeEach(() => {
        reflector = new Reflector();
    });

    describe('constructor', () => {
        it('should create instance with default options', () => {
            const interceptor = new ApiResponseSerializerInterceptor(reflector);

            expect(interceptor).toBeDefined();
        });

        it('should create instance with custom options', () => {
            const options: ApiResponseSerializerOptions = {
                excludeExtraneousValues: true,
                preserveFields: ['custom'],
            };
            const interceptor = new ApiResponseSerializerInterceptor(reflector, options);

            expect(interceptor).toBeDefined();
        });
    });

    describe('intercept', () => {
        it('should preserve metadata field from decorated class', (done) => {
            class TestResponse {
                @Expose()
                message!: string;

                @Expose()
                @PreserveValue()
                metadata?: Record<string, unknown>;
            }

            const testData = new TestResponse();

            testData.message = 'Success';
            testData.metadata = { timestamp: '2024-01-01', version: '1.0' };

            const interceptor = new ApiResponseSerializerInterceptor(reflector, {
                excludeExtraneousValues: true,
            });

            const context = createMockExecutionContext();
            const next = createMockCallHandler(testData);

            interceptor
                .intercept(
                    context as Parameters<typeof interceptor.intercept>[0],
                    next as Parameters<typeof interceptor.intercept>[1],
                )
                .subscribe((result) => {
                    const response = result as Record<string, unknown>;

                    expect(response.message).toBe('Success');
                    expect(response.metadata).toEqual({
                        timestamp: '2024-01-01',
                        version: '1.0',
                    });
                    done();
                });
        });

        it('should preserve fields specified in options', (done) => {
            class TestResponse {
                @Expose()
                customField?: Record<string, unknown>;

                @Expose()
                data!: string;
            }

            const testData = new TestResponse();

            testData.data = 'test';
            testData.customField = { key: 'value' };

            const interceptor = new ApiResponseSerializerInterceptor(reflector, {
                excludeExtraneousValues: true,
                preserveFields: ['customField'],
            });

            const context = createMockExecutionContext();
            const next = createMockCallHandler(testData);

            interceptor
                .intercept(
                    context as Parameters<typeof interceptor.intercept>[0],
                    next as Parameters<typeof interceptor.intercept>[1],
                )
                .subscribe((result) => {
                    const response = result as Record<string, unknown>;

                    expect(response.data).toBe('test');
                    expect(response.customField).toEqual({ key: 'value' });
                    done();
                });
        });

        it('should handle array responses', (done) => {
            class TestItem {
                @Expose()
                id!: number;

                @Expose()
                @PreserveValue()
                metadata?: Record<string, unknown>;
            }

            const item1 = new TestItem();

            item1.id = 1;
            item1.metadata = { a: 1 };

            const item2 = new TestItem();

            item2.id = 2;
            item2.metadata = { b: 2 };

            const testData = [item1, item2];

            const interceptor = new ApiResponseSerializerInterceptor(reflector, {
                excludeExtraneousValues: true,
            });

            const context = createMockExecutionContext();
            const next = createMockCallHandler(testData);

            interceptor
                .intercept(
                    context as Parameters<typeof interceptor.intercept>[0],
                    next as Parameters<typeof interceptor.intercept>[1],
                )
                .subscribe((result) => {
                    const response = result as Record<string, unknown>[];

                    expect(response.length).toBe(2);
                    expect(response[0].metadata).toEqual({ a: 1 });
                    expect(response[1].metadata).toEqual({ b: 2 });
                    done();
                });
        });

        it('should handle null data', (done) => {
            const interceptor = new ApiResponseSerializerInterceptor(reflector);

            const context = createMockExecutionContext();
            const next = createMockCallHandler(null);

            interceptor
                .intercept(
                    context as Parameters<typeof interceptor.intercept>[0],
                    next as Parameters<typeof interceptor.intercept>[1],
                )
                .subscribe((result) => {
                    expect(result).toBeNull();
                    done();
                });
        });

        it('should handle undefined data', (done) => {
            const interceptor = new ApiResponseSerializerInterceptor(reflector);

            const context = createMockExecutionContext();
            const next = createMockCallHandler(undefined);

            interceptor
                .intercept(
                    context as Parameters<typeof interceptor.intercept>[0],
                    next as Parameters<typeof interceptor.intercept>[1],
                )
                .subscribe((result) => {
                    expect(result).toBeUndefined();
                    done();
                });
        });

        it('should deep clone preserved metadata', (done) => {
            class TestResponse {
                @Expose()
                @PreserveValue()
                metadata?: Record<string, unknown>;
            }

            const originalMetadata = {
                nested: { deep: { value: 'test' } },
            };

            const testData = new TestResponse();

            testData.metadata = originalMetadata;

            const interceptor = new ApiResponseSerializerInterceptor(reflector, {
                excludeExtraneousValues: true,
            });

            const context = createMockExecutionContext();
            const next = createMockCallHandler(testData);

            interceptor
                .intercept(
                    context as Parameters<typeof interceptor.intercept>[0],
                    next as Parameters<typeof interceptor.intercept>[1],
                )
                .subscribe((result) => {
                    const response = result as Record<string, unknown>;

                    // Should have same values
                    expect(response.metadata).toEqual(originalMetadata);

                    // But should be a different object (deep cloned)
                    expect(response.metadata).not.toBe(originalMetadata);
                    done();
                });
        });
    });
});
