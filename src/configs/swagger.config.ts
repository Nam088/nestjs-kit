import type { NestApplication } from '@nestjs/core';

import type { SwaggerCustomOptions, SwaggerDocumentOptions } from '@nestjs/swagger';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { configureApiKeyAuth, configureJwtAuth, configureOAuth2Auth, configureServers } from './swagger/setup.helpers';
import { CUSTOM_CSS, getCustomJsStr, getTopbarHtml } from './swagger/ui.constants';

import type { SwaggerConfigOptions } from './swagger/interfaces';

// Re-export interfaces
export type * from './swagger/interfaces';

/**
 * Sets up Swagger documentation for a NestJS application.
 * @param {NestApplication} app - The NestJS application instance
 * @param {SwaggerConfigOptions} options - Swagger configuration options
 * @example
 * setUpSwagger(app, {
 *   title: 'My API',
 *   description: 'API documentation',
 *   version: '1.0.0',
 *   nodeEnv: 'development',
 *   port: 3000
 * });
 */
export const setUpSwagger = (app: NestApplication, options: SwaggerConfigOptions) => {
    const { title, apiKey, description, jwt, nodeEnv, oauth2, version } = options;

    const documentBuilder = new DocumentBuilder()
        .setTitle(title)
        .setDescription(description)
        .setVersion(version)
        .setContact('Ecom Backend', 'https://example.com', 'admin@ecom.com')
        .setLicense('UNLICENSED', 'https://choosealicense.com/licenses/unlicense/');

    // Configure Authentication
    configureJwtAuth(documentBuilder, jwt);
    configureApiKeyAuth(documentBuilder, apiKey);
    configureOAuth2Auth(documentBuilder, oauth2);

    // Additional standard Auth
    documentBuilder
        .addCookieAuth('refresh_token', {
            name: 'refresh_token',
            type: 'apiKey',
            description: 'Refresh token stored in httpOnly cookie',
            in: 'cookie',
        })
        .addBasicAuth(
            {
                type: 'http',
                description: 'Basic authentication with username and password',
                scheme: 'basic',
            },
            'basic',
        )
        .addSecurityRequirements('bearer');

    // Configure Servers
    configureServers(documentBuilder, options);

    const openApiConfig = documentBuilder.build();

    const documentOptions: SwaggerDocumentOptions = {
        deepScanRoutes: true,
        operationIdFactory: (_controllerKey: string, methodKey: string) => methodKey,
    };

    const document = SwaggerModule.createDocument(app, openApiConfig, documentOptions);

    const topbarHtml = getTopbarHtml(title, nodeEnv);

    const customOptions: SwaggerCustomOptions = {
        customCss: CUSTOM_CSS,
        customCssUrl: ['https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&display=swap'],
        customJsStr: getCustomJsStr(topbarHtml),
        customSiteTitle: `${title} Docs`,
        swaggerOptions: {
            displayRequestDuration: true,
            docExpansion: 'list',
            filter: true,
            operationsSorter: 'alpha',
            persistAuthorization: true,
            tagsSorter: 'alpha',
        },
    };

    SwaggerModule.setup('docs', app, document, customOptions);
};
