export interface JwtPayload {
	sub: string; // userId (CUID)
	tenantId: string; // tenant CUID — injected into req.user by JwtStrategy
	role: string; // 'TENANT_ADMIN' | 'GESTOR' | 'COLABORADOR'
	employeeId?: string | null; // Employee CUID — null when not linked, undefined in legacy tokens
	jti?: string; // JWT ID (CUID) — for token blacklist; undefined in legacy tokens
	exp?: number; // JWT expiration timestamp — injected by jsonwebtoken
}
