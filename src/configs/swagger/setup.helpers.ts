import type { DocumentBuilder } from '@nestjs/swagger';

import type { ApiKeyConfig, JwtConfig, OAuth2Config, SwaggerConfigOptions } from './interfaces';

/**
 * Configure JWT Authentication
 */
export const configureJwtAuth = (documentBuilder: DocumentBuilder, jwt?: JwtConfig): void => {
    // Single provider fallback
    documentBuilder.addBearerAuth(
        {
            type: 'http',
            bearerFormat: jwt?.bearerFormat || 'JWT',
            description: jwt?.description || 'JWT access token',
            scheme: 'bearer',
        },
        'bearer',
    );

    // Multiple providers
    if (jwt?.providers) {
        jwt.providers.forEach((provider) => {
            documentBuilder.addBearerAuth(
                {
                    type: 'http',
                    bearerFormat: provider.bearerFormat || 'JWT',
                    description: provider.description || `JWT authentication for ${provider.name}`,
                    scheme: 'bearer',
                },
                provider.name,
            );
        });
    }
};

/**
 * Configure API Key Authentication
 */
export const configureApiKeyAuth = (documentBuilder: DocumentBuilder, apiKey?: ApiKeyConfig): void => {
    // Single provider fallback
    documentBuilder.addApiKey(
        {
            name: apiKey?.keyName || 'api-key',
            type: 'apiKey',
            description: apiKey?.description || 'API Key for authentication',
            in: apiKey?.in || 'header',
        },
        'api-key',
    );

    // Multiple providers
    if (apiKey?.providers) {
        apiKey.providers.forEach((provider) => {
            documentBuilder.addApiKey(
                {
                    name: provider.keyName,
                    type: 'apiKey',
                    description: provider.description || `API Key authentication for ${provider.name}`,
                    in: provider.in,
                },
                provider.name,
            );
        });
    }
};

/**
 * Configure OAuth2 Authentication
 */
export const configureOAuth2Auth = (documentBuilder: DocumentBuilder, oauth2?: OAuth2Config): void => {
    if (oauth2?.providers) {
        oauth2.providers.forEach((provider) => {
            documentBuilder.addOAuth2(
                {
                    type: 'oauth2',
                    description: provider.description || `OAuth2 authentication for ${provider.name}`,
                    flows: {
                        authorizationCode: {
                            authorizationUrl: provider.authorizationUrl,
                            scopes: provider.scopes,
                            tokenUrl: provider.tokenUrl,
                        },
                        clientCredentials: {
                            scopes: provider.scopes,
                            tokenUrl: provider.tokenUrl,
                        },
                    },
                },
                provider.name,
            );
        });
    } else {
        // Fallback to single provider (backward compatibility)
        documentBuilder.addOAuth2(
            {
                type: 'oauth2',
                description: oauth2?.description || 'OAuth2 authentication with various scopes',
                flows: {
                    authorizationCode: {
                        authorizationUrl: oauth2?.authorizationUrl || 'https://example.com/oauth/authorize',
                        scopes: oauth2?.scopes || {
                            read: 'Read access',
                            timeout: 'Timeout',
                            'user:read': 'Read user data',
                            'user:write': 'Write user data',
                            write: 'Write access',
                        },
                        tokenUrl: oauth2?.tokenUrl || 'https://example.com/oauth/token',
                    },
                    clientCredentials: {
                        scopes: oauth2?.scopes || {
                            read: 'Read access',
                            write: 'Write access',
                        },
                        tokenUrl: oauth2?.tokenUrl || 'https://example.com/oauth/token',
                    },
                },
            },
            'oauth2',
        );
    }
};

/**
 * Configure Servers
 */
export const configureServers = (documentBuilder: DocumentBuilder, options: SwaggerConfigOptions): void => {
    const { port, servers } = options;

    if (servers && servers.length > 0) {
        servers.forEach((server) => {
            documentBuilder.addServer(server.url, server.description);
        });
    } else {
        documentBuilder.addServer(`http://localhost:${port}`, 'Local');
    }
};
