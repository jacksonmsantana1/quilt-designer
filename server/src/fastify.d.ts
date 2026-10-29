// What the API adds to Fastify's request (for the type checks).
import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    /** the signed-in user (auth.js); set on every /v1 request */
    user: { id: string };
  }
}
