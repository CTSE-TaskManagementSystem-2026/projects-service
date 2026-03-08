// lib/auth.ts
// Lightweight JWT verification helper for projects-service.
// Uses the same JWT_SECRET as auth-service — no network call needed.

import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";

export interface TokenPayload {
    userId: string;
    role: string;
    iat?: number;
    exp?: number;
}

/**
 * Verifies the `Authorization: Bearer <token>` header on the incoming request.
 * Returns { userId, role } extracted from the token.
 * Throws a 401 NextResponse if the header is missing or the token is invalid.
 */
export function requireAuth(req: NextRequest): TokenPayload {
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
        throw NextResponse.json(
            { error: "Unauthorized", details: "Missing or malformed Authorization header" },
            { status: 401 }
        );
    }

    const token = authHeader.slice(7); // strip "Bearer "
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw NextResponse.json(
            { error: "Server misconfiguration", details: "JWT_SECRET is not set" },
            { status: 500 }
        );
    }

    try {
        const payload = jwt.verify(token, secret) as TokenPayload;
        return payload;
    } catch {
        throw NextResponse.json(
            { error: "Unauthorized", details: "Invalid or expired token" },
            { status: 401 }
        );
    }
}

/**
 * Verifies the `x-internal-secret` header for service-to-service calls.
 * Throws a 403 NextResponse if the secret is missing or does not match.
 */
export function requireInternalSecret(req: NextRequest): void {
    const internalSecret = process.env.INTERNAL_SECRET;
    const provided = req.headers.get("x-internal-secret");

    if (!internalSecret || provided !== internalSecret) {
        throw NextResponse.json(
            { error: "Forbidden", details: "Invalid or missing x-internal-secret header" },
            { status: 403 }
        );
    }
}
