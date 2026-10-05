import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import jwt from "jsonwebtoken";
import { config, isGoogleConfigured } from "./config";
import { prisma } from "./db";

export function initPassport() {
  if (!isGoogleConfigured) {
    console.warn("[auth] Google OAuth not configured — /auth/google will 501. Set GOOGLE_CLIENT_ID/SECRET.");
    return;
  }
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.googleClientId,
        clientSecret: config.googleClientSecret,
        callbackURL: config.googleCallbackUrl,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value ?? `${profile.id}@google.local`;
          const user = await prisma.user.upsert({
            where: { email },
            update: {
              googleId: profile.id,
              name: profile.displayName,
              avatar: profile.photos?.[0]?.value,
            },
            create: {
              googleId: profile.id,
              email,
              name: profile.displayName,
              avatar: profile.photos?.[0]?.value,
            },
          });
          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: "7d" });
}
