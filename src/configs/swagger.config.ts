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
    const {
        title,
        apiKey,
        autoAuthApiPattern = '/login',
        autoAuthTokenKey = 'accessToken',
        customJs,
        description,
        enableAutoAuth,
        jwt,
        nodeEnv,
        oauth2,
        version,
    } = options;

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

    // Auto-auth script with support for nested token paths (e.g., 'data.accessToken')
    const autoAuthScript = `
    (function() {
      // Helper function to get nested property by path (e.g., 'data.accessToken')
      function getNestedValue(obj, path) {
        if (!obj || !path) return undefined;
        var keys = path.split('.');
        var current = obj;
        for (var i = 0; i < keys.length; i++) {
          if (current == null) return undefined;
          current = current[keys[i]];
        }
        return current;
      }

      var originalFetch = window.fetch;
      window.fetch = function(input, init) {
        return originalFetch(input, init).then(function(response) {
          if (input && input.toString().endsWith('${autoAuthApiPattern}') && response.ok) {
            response.clone().json().then(function(data) {
              var token = getNestedValue(data, '${autoAuthTokenKey}');
              if (token) {
                setTimeout(function() {
                  if (window.ui && window.ui.authActions) {
                    var authObj = {
                      bearer: {
                        name: "bearer",
                        schema: {
                          type: "http",
                          scheme: "bearer",
                          bearerFormat: "JWT",
                          description: "JWT access token"
                        },
                        value: token
                      }
                    };
                    window.ui.authActions.authorize(authObj);
                    console.log('Auto-authorized with new token');
                    
                    // Optional: Force persist if persistAuthorization is on
                    try {
                      localStorage.setItem('authorized', JSON.stringify(authObj));
                    } catch (e) {}
                  }
                }, 100);
              }
            }).catch(function() {});
          }
          return response;
        });
      };
    })();
    `;

    let finalCustomJs = getCustomJsStr(topbarHtml);

    if (enableAutoAuth) {
        finalCustomJs += autoAuthScript;
    }

    if (customJs) {
        finalCustomJs += customJs;
    }

    const customOptions: SwaggerCustomOptions = {
        customCss: CUSTOM_CSS,
        customCssUrl: ['https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&display=swap'],
        customJsStr: finalCustomJs,
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
