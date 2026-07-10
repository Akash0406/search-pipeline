/**
 * Types describing what the auth guards attach to the incoming request.
 */
import type { FastifyRequest } from 'fastify';
import type { StoredSession } from '@careerstack/auth';

/** The authenticated user as loaded by the session guard. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string | null;
  role: 'user' | 'admin';
  timezone: string | null;
}

/** A Fastify request after the session guard has run. */
export interface AuthenticatedRequest extends FastifyRequest {
  authUser?: AuthenticatedUser;
  authSession?: StoredSession;
}
