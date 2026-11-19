import { createRemoteJWKSet, errors as joseErrors, jwtVerify, type JWTPayload } from "jose";
import { config } from "./env.js";
import { HttpError } from "../utils/http-error.js";

type RemoteJwks = ReturnType<typeof createRemoteJWKSet>;

let remoteJwks: RemoteJwks | null = null;

function getJwtVerificationSettings(): {
  jwks: RemoteJwks;
  issuer: string;
  audience: string;
} {
  const jwksUrlValue = config.betterAuthJwksUrl?.trim();
  const issuer = config.betterAuthIssuer?.trim();
  const audience = config.betterAuthAudience?.trim();

  if (!jwksUrlValue || !issuer || !audience) {
    throw new HttpError(
      503,
      "Authentication Unavailable",
      "Authentication is not configured.",
    );
  }

  let jwksUrl: URL;
  try {
    jwksUrl = new URL(jwksUrlValue);
  } catch {
    throw new HttpError(
      503,
      "Authentication Unavailable",
      "Authentication is not configured.",
    );
  }

  const httpAllowedInEnvironment =
    config.nodeEnv !== "production" && jwksUrl.protocol === "http:";
  if (
    (jwksUrl.protocol !== "https:" && !httpAllowedInEnvironment) ||
    jwksUrl.username !== "" ||
    jwksUrl.password !== ""
  ) {
    throw new HttpError(
      503,
      "Authentication Unavailable",
      "Authentication is not configured.",
    );
  }

  remoteJwks ??= createRemoteJWKSet(jwksUrl, { timeoutDuration: 5000 });
  return { jwks: remoteJwks, issuer, audience };
}

export async function verifyAccessToken(token: string): Promise<JWTPayload> {
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
    throw new HttpError(
      401,
      "Unauthorized",
      "The access token is malformed.",
    );
  }

  const { jwks, issuer, audience } = getJwtVerificationSettings();

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience,
      requiredClaims: ["exp"],
    });
    return payload;
  } catch (error: unknown) {
    if (
      error instanceof TypeError ||
      error instanceof joseErrors.JWKSTimeout ||
      error instanceof joseErrors.JWKSInvalid ||
      error instanceof joseErrors.JWKSMultipleMatchingKeys
    ) {
      throw new HttpError(
        503,
        "Authentication Unavailable",
        "The authentication key service is unavailable.",
      );
    }

    throw new HttpError(
      401,
      "Unauthorized",
      "The access token is invalid or expired.",
    );
  }
}
