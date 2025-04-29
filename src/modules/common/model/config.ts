export interface Config {

    readonly API_PORT: number;

    readonly API_PREFIX: string;

    readonly SWAGGER_ENABLE: number;

    readonly JWT_SECRET: string;

    readonly JWT_ISSUER: string;

    readonly HEALTH_TOKEN: string;

    readonly PASSENGERS_ALLOWED: string;
    
    readonly REDIS_HOST: string;

    readonly REDIS_PORT: number;

    readonly BREVO_API_KEY: string;

    readonly SENDER_EMAIL: string;
    readonly SENDER_NAME: string;

    readonly GOOGLE_CLIENT_ID: string;
    readonly GOOGLE_CLIENT_SECRET: string;
}
