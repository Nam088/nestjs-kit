/* eslint-disable max-lines */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable max-lines-per-function */
import type { ArgumentMetadata } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';

import { z } from 'zod';

import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
    let pipe: ZodValidationPipe;
    let mockMetadata: ArgumentMetadata;

    beforeEach(() => {
        mockMetadata = {
            type: 'body',
            data: undefined,
            metatype: Object,
        };
    });

    describe('constructor', () => {
        it('should create an instance with a schema', () => {
            const schema = z.object({
                name: z.string(),
                age: z.number(),
            });

            pipe = new ZodValidationPipe(schema);

            expect(pipe).toBeInstanceOf(ZodValidationPipe);
        });

        it('should create an instance with options', () => {
            const schema = z.object({ name: z.string() });

            pipe = new ZodValidationPipe(schema, {
                fieldFormatter: (field) => field.toUpperCase(),
            });

            expect(pipe).toBeInstanceOf(ZodValidationPipe);
        });
    });

    describe('transform', () => {
        beforeEach(() => {
            const schema = z.object({
                name: z.string().min(1),
                email: z.string().email().optional(),
                age: z.number().min(0),
            });

            pipe = new ZodValidationPipe(schema);
        });

        describe('valid data', () => {
            it('should return parsed data for valid input', () => {
                const validData = {
                    name: 'John Doe',
                    email: 'john@example.com',
                    age: 25,
                };

                const result = pipe.transform(validData, mockMetadata);

                expect(result).toEqual(validData);
            });

            it('should return parsed data for valid input without optional fields', () => {
                const validData = {
                    name: 'Jane Doe',
                    age: 30,
                };

                const result = pipe.transform(validData, mockMetadata);

                expect(result).toEqual(validData);
            });

            it('should handle primitive values when schema allows', () => {
                const stringSchema = z.string();
                const stringPipe = new ZodValidationPipe(stringSchema);

                const result = stringPipe.transform('hello world', mockMetadata);

                expect(result).toBe('hello world');
            });

            it('should handle arrays when schema allows', () => {
                const arraySchema = z.array(z.string());
                const arrayPipe = new ZodValidationPipe(arraySchema);

                const validArray = ['item1', 'item2', 'item3'];
                const result = arrayPipe.transform(validArray, mockMetadata);

                expect(result).toEqual(validArray);
            });
        });

        describe('invalid data with custom messages', () => {
            it('should throw BadRequestException with user-friendly message for invalid type', () => {
                const invalidData = {
                    name: 123,
                    age: 'not a number',
                };

                expect(() => pipe.transform(invalidData, mockMetadata)).toThrow(BadRequestException);

                try {
                    pipe.transform(invalidData, mockMetadata);
                } catch (error) {
                    expect(error).toBeInstanceOf(BadRequestException);
                    const response = (error as BadRequestException).getResponse() as any;

                    expect(response.message).toContain('Validation failed');
                    expect(response.errors).toEqual(
                        expect.arrayContaining([
                            expect.objectContaining({
                                field: 'age',
                                message: expect.stringContaining('age'),
                            }),
                            expect.objectContaining({
                                field: 'name',
                                message: expect.stringContaining('name'),
                            }),
                        ]),
                    );
                }
            });

            it('should show "is required" message for missing required fields', () => {
                const incompleteData = {
                    name: 'John Doe',
                    // age is missing
                };

                expect(() => pipe.transform(incompleteData, mockMetadata)).toThrow(BadRequestException);

                try {
                    pipe.transform(incompleteData, mockMetadata);
                } catch (error) {
                    expect(error).toBeInstanceOf(BadRequestException);
                    const response = (error as BadRequestException).getResponse() as any;

                    expect(response.errors).toEqual(
                        expect.arrayContaining([
                            expect.objectContaining({
                                field: 'age',
                                message: 'age is required',
                            }),
                        ]),
                    );
                }
            });

            it('should show "cannot be empty" message for empty strings', () => {
                const dataWithEmptyString = {
                    name: '', // empty string violates min(1)
                    age: 25,
                };

                try {
                    pipe.transform(dataWithEmptyString, mockMetadata);
                } catch (error) {
                    const response = (error as BadRequestException).getResponse() as any;

                    expect(response.errors).toEqual(
                        expect.arrayContaining([
                            expect.objectContaining({
                                field: 'name',
                                message: 'name cannot be empty',
                            }),
                        ]),
                    );
                }
            });

            it('should show "must be a valid email address" message for invalid email', () => {
                const dataWithInvalidEmail = {
                    name: 'John',
                    email: 'invalid-email',
                    age: 25,
                };

                try {
                    pipe.transform(dataWithInvalidEmail, mockMetadata);
                } catch (error) {
                    const response = (error as BadRequestException).getResponse() as any;

                    expect(response.errors).toEqual(
                        expect.arrayContaining([
                            expect.objectContaining({
                                field: 'email',
                                message: 'email must be a valid email address',
                            }),
                        ]),
                    );
                }
            });

            it('should show "must be at least X" message for too_small number errors', () => {
                const dataWithNegativeAge = {
                    name: 'John',
                    age: -5,
                };

                try {
                    pipe.transform(dataWithNegativeAge, mockMetadata);
                } catch (error) {
                    const response = (error as BadRequestException).getResponse() as any;

                    expect(response.errors).toEqual(
                        expect.arrayContaining([
                            expect.objectContaining({
                                field: 'age',
                                message: expect.stringMatching(/age must be (at least|greater than) 0/),
                            }),
                        ]),
                    );
                }
            });
        });

        describe('null and undefined values', () => {
            it('should throw BadRequestException for null value', () => {
                expect(() => pipe.transform(null, mockMetadata)).toThrow(BadRequestException);

                try {
                    pipe.transform(null, mockMetadata);
                } catch (error) {
                    expect(error).toBeInstanceOf(BadRequestException);
                    expect((error as BadRequestException).getResponse()).toEqual({
                        errors: [
                            {
                                field: 'body',
                                message: 'Request body is required',
                            },
                        ],
                        message: 'Validation failed',
                    });
                }
            });

            it('should throw BadRequestException for undefined value', () => {
                expect(() => pipe.transform(undefined, mockMetadata)).toThrow(BadRequestException);

                try {
                    pipe.transform(undefined, mockMetadata);
                } catch (error) {
                    expect(error).toBeInstanceOf(BadRequestException);
                    expect((error as BadRequestException).getResponse()).toEqual({
                        errors: [
                            {
                                field: 'body',
                                message: 'Request body is required',
                            },
                        ],
                        message: 'Validation failed',
                    });
                }
            });
        });

        describe('non-ZodError exceptions', () => {
            it('should re-throw non-ZodError exceptions', () => {
                const customError = new Error('Custom error');

                // Mock the schema.parse to throw a non-ZodError
                const mockSchema = {
                    parse: jest.fn().mockImplementation(() => {
                        throw customError;
                    }),
                } as any;

                const customPipe = new ZodValidationPipe(mockSchema);

                expect(() => customPipe.transform({}, mockMetadata)).toThrow('Custom error');
            });
        });

        describe('nested object paths', () => {
            it('should format nested object paths correctly', () => {
                const nestedSchema = z.object({
                    user: z.object({
                        name: z.string().min(1),
                        profile: z.object({
                            age: z.number(),
                        }),
                    }),
                });

                const nestedPipe = new ZodValidationPipe(nestedSchema);

                const invalidNestedData = {
                    user: {
                        name: '',
                        profile: {
                            age: 'not a number',
                        },
                    },
                };

                try {
                    nestedPipe.transform(invalidNestedData, mockMetadata);
                } catch (error) {
                    const response = (error as BadRequestException).getResponse() as any;

                    expect(response.errors).toEqual(
                        expect.arrayContaining([
                            expect.objectContaining({
                                field: 'user.name',
                                message: 'user.name cannot be empty',
                            }),
                            expect.objectContaining({
                                field: 'user.profile.age',
                                message: expect.stringContaining('user.profile.age'),
                            }),
                        ]),
                    );
                }
            });

            it('should format array paths correctly', () => {
                const arraySchema = z.object({
                    items: z.array(
                        z.object({
                            name: z.string().min(1),
                        }),
                    ),
                });

                const arrayPipe = new ZodValidationPipe(arraySchema);

                const invalidArrayData = {
                    items: [{ name: 'valid' }, { name: '' }],
                };

                try {
                    arrayPipe.transform(invalidArrayData, mockMetadata);
                } catch (error) {
                    const response = (error as BadRequestException).getResponse() as any;

                    expect(response.errors).toEqual(
                        expect.arrayContaining([
                            expect.objectContaining({
                                field: 'items[1].name',
                                message: 'items[1].name cannot be empty',
                            }),
                        ]),
                    );
                }
            });
        });
    });

    describe('fieldFormatter option', () => {
        it('should use custom fieldFormatter to capitalize field names', () => {
            const schema = z.object({
                email: z.string().email(),
            });

            const customPipe = new ZodValidationPipe(schema, {
                fieldFormatter: (field) => field.charAt(0).toUpperCase() + field.slice(1),
            });

            try {
                customPipe.transform({ email: 'invalid' }, mockMetadata);
            } catch (error) {
                const response = (error as BadRequestException).getResponse() as any;

                // The message should use capitalized field name
                expect(response.errors[0].message).toBe('Email must be a valid email address');
                // But the field property should still be the raw path
                expect(response.errors[0].field).toBe('email');
            }
        });

        it('should use custom fieldFormatter to convert camelCase to Title Case', () => {
            const schema = z.object({
                firstName: z.string().min(1),
            });

            const customPipe = new ZodValidationPipe(schema, {
                fieldFormatter: (field) =>
                    field
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^./, (s) => s.toUpperCase())
                        .trim(),
            });

            try {
                customPipe.transform({ firstName: '' }, mockMetadata);
            } catch (error) {
                const response = (error as BadRequestException).getResponse() as any;

                expect(response.errors[0].message).toBe('First Name cannot be empty');
            }
        });

        it('should use custom fieldFormatter with label mapping', () => {
            const schema = z.object({
                firstName: z.string().min(1),
                lastName: z.string().min(1),
            });

            const labelMap: Record<string, string> = {
                firstName: 'Họ',
                lastName: 'Tên',
            };

            const customPipe = new ZodValidationPipe(schema, {
                // eslint-disable-next-line security/detect-object-injection
                fieldFormatter: (field) => labelMap[field] ?? field,
            });

            try {
                customPipe.transform({ firstName: '', lastName: '' }, mockMetadata);
            } catch (error) {
                const response = (error as BadRequestException).getResponse() as any;

                expect(response.errors).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({ message: 'Họ cannot be empty' }),
                        expect.objectContaining({ message: 'Tên cannot be empty' }),
                    ]),
                );
            }
        });

        it('should apply fieldFormatter to nested paths', () => {
            const schema = z.object({
                user: z.object({
                    firstName: z.string().min(1),
                }),
            });

            const customPipe = new ZodValidationPipe(schema, {
                fieldFormatter: (field) => `"${field}"`,
            });

            try {
                customPipe.transform({ user: { firstName: '' } }, mockMetadata);
            } catch (error) {
                const response = (error as BadRequestException).getResponse() as any;

                expect(response.errors[0].message).toBe('"user.firstName" cannot be empty');
            }
        });
    });

    describe('all Zod v4 issue codes', () => {
        it('should handle invalid_union', () => {
            const unionSchema = z.union([z.string(), z.number()]);
            const unionPipe = new ZodValidationPipe(unionSchema);

            try {
                unionPipe.transform(true, mockMetadata);
            } catch (error) {
                const response = (error as BadRequestException).getResponse() as any;

                expect(response.errors[0].message).toContain('does not match any of the expected types');
            }
        });

        it('should handle invalid_value (enum)', () => {
            const enumSchema = z.enum(['red', 'green', 'blue']);
            const enumPipe = new ZodValidationPipe(enumSchema);

            try {
                enumPipe.transform('yellow', mockMetadata);
            } catch (error) {
                const response = (error as BadRequestException).getResponse() as any;

                expect(response.errors[0].message).toContain('must be one of');
            }
        });

        it('should handle too_big for strings', () => {
            const maxSchema = z.object({ name: z.string().max(5) });
            const maxPipe = new ZodValidationPipe(maxSchema);

            try {
                maxPipe.transform({ name: 'too long name' }, mockMetadata);
            } catch (error) {
                const response = (error as BadRequestException).getResponse() as any;

                expect(response.errors[0].message).toBe('name must be at most 5 character(s)');
            }
        });

        it('should handle too_big for arrays', () => {
            const maxArraySchema = z.object({ items: z.array(z.string()).max(2) });
            const maxArrayPipe = new ZodValidationPipe(maxArraySchema);

            try {
                maxArrayPipe.transform({ items: ['a', 'b', 'c', 'd'] }, mockMetadata);
            } catch (error) {
                const response = (error as BadRequestException).getResponse() as any;

                expect(response.errors[0].message).toBe('items must have at most 2 item(s)');
            }
        });

        it('should handle too_small for arrays', () => {
            const minArraySchema = z.object({ items: z.array(z.string()).min(3) });
            const minArrayPipe = new ZodValidationPipe(minArraySchema);

            try {
                minArrayPipe.transform({ items: ['a'] }, mockMetadata);
            } catch (error) {
                const response = (error as BadRequestException).getResponse() as any;

                expect(response.errors[0].message).toBe('items must have at least 3 item(s)');
            }
        });

        it('should handle unrecognized_keys', () => {
            const strictSchema = z.object({ name: z.string() }).strict();
            const strictPipe = new ZodValidationPipe(strictSchema);

            try {
                strictPipe.transform({ name: 'John', extraField: 'value' }, mockMetadata);
            } catch (error) {
                const response = (error as BadRequestException).getResponse() as any;

                expect(response.errors[0].message).toContain('Unknown field(s)');
                expect(response.errors[0].message).toContain('extraField');
            }
        });

        it('should handle not_multiple_of', () => {
            const multipleSchema = z.object({ value: z.number().multipleOf(5) });
            const multiplePipe = new ZodValidationPipe(multipleSchema);

            try {
                multiplePipe.transform({ value: 7 }, mockMetadata);
            } catch (error) {
                const response = (error as BadRequestException).getResponse() as any;

                expect(response.errors[0].message).toBe('value must be a multiple of 5');
            }
        });

        it('should handle invalid_format for uuid', () => {
            const uuidSchema = z.object({ id: z.string().uuid() });
            const uuidPipe = new ZodValidationPipe(uuidSchema);

            try {
                uuidPipe.transform({ id: 'not-a-uuid' }, mockMetadata);
            } catch (error) {
                const response = (error as BadRequestException).getResponse() as any;

                expect(response.errors[0].message).toBe('id must be a valid UUID');
            }
        });

        it('should handle invalid_format for url', () => {
            const urlSchema = z.object({ website: z.string().url() });
            const urlPipe = new ZodValidationPipe(urlSchema);

            try {
                urlPipe.transform({ website: 'not-a-url' }, mockMetadata);
            } catch (error) {
                const response = (error as BadRequestException).getResponse() as any;

                expect(response.errors[0].message).toBe('website must be a valid URL');
            }
        });

        it('should handle invalid_format for datetime', () => {
            const datetimeSchema = z.object({ createdAt: z.string().datetime() });
            const datetimePipe = new ZodValidationPipe(datetimeSchema);

            try {
                datetimePipe.transform({ createdAt: 'not-a-date' }, mockMetadata);
            } catch (error) {
                const response = (error as BadRequestException).getResponse() as any;

                expect(response.errors[0].message).toBe('createdAt must be a valid datetime');
            }
        });

        it('should handle custom refinements', () => {
            const customSchema = z.object({
                password: z.string().refine((val) => val.includes('@'), {
                    message: 'Password must contain @',
                }),
            });
            const customPipe = new ZodValidationPipe(customSchema);

            try {
                customPipe.transform({ password: 'weak' }, mockMetadata);
            } catch (error) {
                const response = (error as BadRequestException).getResponse() as any;

                expect(response.errors[0].message).toBe('Password must contain @');
            }
        });
    });

    describe('integration scenarios', () => {
        it('should handle complex real-world schema', () => {
            const userSchema = z.object({
                id: z.string().uuid().optional(),
                name: z.string().min(2).max(50),
                email: z.string().email(),
                isActive: z.boolean().default(true),
                address: z
                    .object({
                        city: z.string().min(1),
                        street: z.string().min(1),
                        zipCode: z.string().regex(/^\d{5}$/),
                    })
                    .optional(),
                age: z.number().int().min(18).max(120),
                tags: z.array(z.string()).max(10).optional(),
            });

            const complexPipe = new ZodValidationPipe(userSchema);

            const validUserData = {
                name: 'John Doe',
                email: 'john@example.com',
                isActive: true,
                address: {
                    city: 'New York',
                    street: '123 Main St',
                    zipCode: '12345',
                },
                age: 25,
                tags: ['developer', 'typescript'],
            };

            const result = complexPipe.transform(validUserData, mockMetadata);

            expect(result).toEqual(validUserData);
        });

        it('should provide clear error summary', () => {
            const schema = z.object({
                email: z.string().email(),
                age: z.number(),
            });
            const testPipe = new ZodValidationPipe(schema);

            try {
                testPipe.transform({ email: 'invalid', age: 'invalid' }, mockMetadata);
            } catch (error) {
                const response = (error as BadRequestException).getResponse() as any;

                // The message should contain a summary of all errors
                expect(response.message).toContain('Validation failed');
                expect(response.message).toContain('age');
                expect(response.message).toContain('email');
            }
        });
    });

    describe('preserve custom messages', () => {
        it('should preserve custom message on min validation', () => {
            const schema = z.object({
                password: z.string().min(8, { error: 'Mật khẩu phải có ít nhất 8 ký tự' }),
            });
            const customPipe = new ZodValidationPipe(schema);

            try {
                customPipe.transform({ password: '123' }, mockMetadata);
            } catch (error) {
                const response = (error as BadRequestException).getResponse() as any;

                expect(response.errors[0].message).toBe('Mật khẩu phải có ít nhất 8 ký tự');
            }
        });

        it('should preserve custom message on max validation', () => {
            const schema = z.object({
                name: z.string().max(10, { error: 'Tên không được quá 10 ký tự' }),
            });
            const customPipe = new ZodValidationPipe(schema);

            try {
                customPipe.transform({ name: 'This is a very long name' }, mockMetadata);
            } catch (error) {
                const response = (error as BadRequestException).getResponse() as any;

                expect(response.errors[0].message).toBe('Tên không được quá 10 ký tự');
            }
        });

        it('should preserve custom message on email validation', () => {
            const schema = z.object({
                email: z.string().email({ error: 'Email không hợp lệ' }),
            });
            const customPipe = new ZodValidationPipe(schema);

            try {
                customPipe.transform({ email: 'invalid' }, mockMetadata);
            } catch (error) {
                const response = (error as BadRequestException).getResponse() as any;

                expect(response.errors[0].message).toBe('Email không hợp lệ');
            }
        });

        it('should use default message when no custom message is set', () => {
            const schema = z.object({
                email: z.string().email(), // No custom message
            });
            const defaultPipe = new ZodValidationPipe(schema);

            try {
                defaultPipe.transform({ email: 'invalid' }, mockMetadata);
            } catch (error) {
                const response = (error as BadRequestException).getResponse() as any;

                // Should use our custom default message
                expect(response.errors[0].message).toBe('email must be a valid email address');
            }
        });

        it('should preserve Vietnamese custom messages', () => {
            const schema = z.object({
                age: z.number().min(18, { error: 'Bạn phải đủ 18 tuổi trở lên' }),
            });
            const customPipe = new ZodValidationPipe(schema);

            try {
                customPipe.transform({ age: 15 }, mockMetadata);
            } catch (error) {
                const response = (error as BadRequestException).getResponse() as any;

                expect(response.errors[0].message).toBe('Bạn phải đủ 18 tuổi trở lên');
            }
        });

        it('should preserve custom message with fieldFormatter still applying to field', () => {
            const schema = z.object({
                password: z.string().min(8, { error: 'Mật khẩu yếu quá!' }),
            });
            const customPipe = new ZodValidationPipe(schema, {
                fieldFormatter: (field) => field.toUpperCase(),
            });

            try {
                customPipe.transform({ password: '123' }, mockMetadata);
            } catch (error) {
                const response = (error as BadRequestException).getResponse() as any;

                // Custom message is preserved, field is still raw (not formatted in message)
                expect(response.errors[0].message).toBe('Mật khẩu yếu quá!');
                expect(response.errors[0].field).toBe('password');
            }
        });
    });

    describe('edge cases and advanced features', () => {
        it('should handle Zod coercion (z.coerce)', () => {
            const schema = z.object({
                isActive: z.coerce.boolean(),
                age: z.coerce.number(),
                date: z.coerce.date(),
            });
            const pipe = new ZodValidationPipe(schema);

            const input = {
                isActive: 'true',
                age: '25',
                date: '2023-01-01T00:00:00Z',
            };

            const result = pipe.transform(input, mockMetadata) as {
                age: number;
                date: Date;
                isActive: boolean;
            };

            expect(result).toEqual({
                isActive: true,
                age: 25,
                date: expect.any(Date),
            });
            expect(result.date.toISOString()).toBe('2023-01-01T00:00:00.000Z');
        });

        it('should handle strip/passthrough/strict handling', () => {
            const input = { keep: 'val', remove: 'extra' };

            // Default (Strip)
            const stripSchema = z.object({ keep: z.string() });

            expect(new ZodValidationPipe(stripSchema).transform(input, mockMetadata)).toEqual({ keep: 'val' });

            // Passthrough
            const passSchema = z.object({ keep: z.string() }).passthrough();

            expect(new ZodValidationPipe(passSchema).transform(input, mockMetadata)).toEqual({
                keep: 'val',
                remove: 'extra',
            });

            // Strict
            const strictSchema = z.object({ keep: z.string() }).strict();

            try {
                new ZodValidationPipe(strictSchema).transform(input, mockMetadata);
            } catch (e) {
                expect(e).toBeInstanceOf(BadRequestException);
                const response = (e as BadRequestException).getResponse() as any;

                expect(response.errors[0].message).toContain('Unknown field(s)');
            }
        });

        it('should handle schema defaults', () => {
            const schema = z.object({
                page: z.number().default(1),
                role: z.string().default('user'),
            });
            const pipe = new ZodValidationPipe(schema);

            expect(pipe.transform({}, mockMetadata)).toEqual({ page: 1, role: 'user' });
            expect(pipe.transform({ role: 'admin' }, mockMetadata)).toEqual({ page: 1, role: 'admin' });
        });

        it('should handle preprocess transformations', () => {
            const schema = z.preprocess(
                (val) => {
                    if (typeof val === 'string') return JSON.parse(val);

                    return val;
                },
                z.object({ id: z.number() }),
            );

            const pipe = new ZodValidationPipe(schema);

            expect(pipe.transform('{"id": 123}', mockMetadata)).toEqual({ id: 123 });
        });

        describe('Global Error Map interaction', () => {
            const originalErrorMap = z.getErrorMap();

            afterAll(() => {
                z.setErrorMap(originalErrorMap as any);
            });

            it('should respect Zod Global Error Map if message differs from default pattern', () => {
                const customErrorMap = (issue: any, ctx: any) => {
                    if (issue.code === 'invalid_type' && issue.expected === 'string') {
                        return { message: 'Custom Logic: Expected a string!' };
                    }

                    return { message: ctx.defaultError };
                };

                z.setErrorMap(customErrorMap as any);

                const schema = z.string();
                const pipe = new ZodValidationPipe(schema);

                try {
                    pipe.transform(123, mockMetadata);
                } catch (e) {
                    const response = (e as BadRequestException).getResponse() as any;

                    expect(response.errors[0].message).toBe('Custom Logic: Expected a string!');
                }
            });
        });
    });
});
