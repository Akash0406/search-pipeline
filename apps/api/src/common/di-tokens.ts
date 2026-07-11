/**
 * Dependency-injection tokens for provider bindings that are interfaces or
 * plain values (which NestJS cannot infer from a class type).
 */
export const CONFIG = Symbol('CONFIG');
export const DB = Symbol('DB');
export const LOGGER = Symbol('LOGGER');
export const CLOCK = Symbol('CLOCK');
export const CRYPTO = Symbol('CRYPTO');
export const SESSION_STORE = Symbol('SESSION_STORE');
export const MAGIC_LINK_STORE = Symbol('MAGIC_LINK_STORE');
export const IDEMPOTENCY_STORE = Symbol('IDEMPOTENCY_STORE');
