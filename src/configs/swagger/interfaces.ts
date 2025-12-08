export interface ApiKeyConfig {
    /** Fallback description for single provider (backward compatibility) */
    description?: string;
    /** Fallback location for single provider */
    in?: ApiKeyLocation;
    /** Fallback key name for single provider */
    keyName?: string;
    /** Array of API key providers */
    providers?: ApiKeyProvider[];
}

/** API key location type for authentication */
export type ApiKeyLocation = 'cookie' | 'header' | 'query';

export interface ApiKeyProvider {
    /** Description of the API key provider */
    description?: string;
    /** Location where the API key is expected */
    in: ApiKeyLocation;
    /** Name of the key parameter */
    keyName: string;
    /** Name of the provider */
    name: string;
}

export interface JwtConfig {
    /** Fallback bearer format for single provider */
    bearerFormat?: string;
    /** Fallback description for single provider */
    description?: string;
    /** Array of JWT providers */
    providers?: JwtProvider[];
}

export interface JwtProvider {
    /** Bearer token format */
    bearerFormat?: string;
    /** Description of the JWT provider */
    description?: string;
    /** Name of the provider */
    name: string;
}

export interface OAuth2Config {
    /** Fallback authorization URL for single provider */
    authorizationUrl?: string;
    /** Fallback description for single provider */
    description?: string;
    /** Array of OAuth2 providers */
    providers?: OAuth2Provider[];
    /** Fallback scopes for single provider */
    scopes?: Record<string, string>;
    /** Fallback token URL for single provider */
    tokenUrl?: string;
}

export interface OAuth2Provider {
    /** OAuth2 authorization URL */
    authorizationUrl: string;
    /** Description of the OAuth2 provider */
    description?: string;
    /** Name of the provider */
    name: string;
    /** Available OAuth2 scopes */
    scopes: Record<string, string>;
    /** OAuth2 token URL */
    tokenUrl: string;
}

export interface SwaggerConfigOptions {
    /** API key authentication configuration */
    apiKey?: ApiKeyConfig;
    /** API description */
    description: string;
    /** JWT authentication configuration */
    jwt?: JwtConfig;
    /** Node environment */
    nodeEnv: string;
    /** OAuth2 authentication configuration */
    oauth2?: OAuth2Config;
    /** Application port */
    port: number | string;
    /** Available servers configuration */
    servers?: SwaggerServer[];
    /** API title */
    title: string;
    /** API version */
    version: string;
}

export interface SwaggerServer {
    /** Optional description of the server */
    description?: string;
    /** Server URL */
    url: string;
}
