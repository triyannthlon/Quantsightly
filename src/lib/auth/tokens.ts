import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";
import { JWT_SECRET } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";

export type AccessTokenPayload = {
  userId: string;
  email: string;
  sid: string;
}; /* Payload contenu dans l'access token */

/******************** signAccessToken *****/
export async function signAccessToken(payload: AccessTokenPayload) {
  /* Génère un access token JWT (court) */

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(JWT_SECRET);
}

/******************** verifyAccessToken *****/
export async function verifyAccessToken(token: string) {
  /* Vérifie et décode un access token JWT */

  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as AccessTokenPayload;
}

/************** generateRefreshToken *****/
export function generateRefreshToken() {
  /* Génère un refresh token opaque (long) */

  return crypto.randomBytes(32).toString("base64url");
}

/************** hashRefreshToken *****/
export function hashRefreshToken(token: string) {
  /* Hash un refresh token avant stockage DB */

  return crypto.createHash("sha256").update(token).digest("hex");
}

/******************** verifyRefreshTokenOpaque *****/
export async function verifyRefreshTokenOpaque(refreshToken: string, sid: string) {
  const hashed = hashRefreshToken(refreshToken);

  const session = await prisma.session.findUnique({ where: { id: sid } });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.refreshHash !== hashed) return null;

  return session;
}
