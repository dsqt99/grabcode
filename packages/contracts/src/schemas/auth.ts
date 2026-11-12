import { z } from 'zod';
import { CoderStatsSchema } from './order';

// Runtime contract for auth + profile (web/coder -> core-api). Session is an httpOnly cookie, never exposed to JS.

/** Roles a user can pick (sign-up, POST /v1/me/roles). ADMIN is granted only in the DB (or dev-login). */
export const UserRoleSchema = z.enum(['CUSTOMER', 'CODER']);
export const AccountRoleSchema = z.enum(['CUSTOMER', 'CODER', 'ADMIN']);
export const CurrencySchema = z.enum(['VND', 'USD']);

export const ExperienceLevelSchema = z.enum(['ENTRY', 'INTERMEDIATE', 'EXPERT']);
export const HoursPerWeekSchema = z.enum(['LT_10', 'H10_30', 'GT_30']);
export const LanguageLevelSchema = z.enum(['BASIC', 'CONVERSATIONAL', 'FLUENT', 'NATIVE']);
export const CompanySizeSchema = z.enum(['SOLO', 'S2_10', 'S11_50', 'S51_200', 'S200_PLUS']);
const UrlSchema = z.string().trim().url().max(300);

export const NotificationPrefsSchema = z.object({
  email: z.boolean(),
  zalo: z.boolean(),
  push: z.boolean(),
});

/** Coder public profile (Upwork-style). Matching reads skills/rate/availability from here. */
export const CoderProfileDetailsSchema = z.object({
  headline: z.string().trim().max(80),
  bio: z.string().trim().max(2000),
  hourlyRateVnd: z.number().int().min(0).max(10_000_000),
  experienceLevel: ExperienceLevelSchema,
  skills: z.array(z.string().trim().min(1).max(40)).max(20),
  hoursPerWeek: HoursPerWeekSchema,
  languages: z.array(z.object({ language: z.string().trim().min(1).max(40), level: LanguageLevelSchema })).max(10),
  githubUrl: UrlSchema.nullable(),
  portfolioUrls: z.array(UrlSchema).max(5),
  /** false = hidden from customers and from matching. */
  isPublic: z.boolean(),
  availableForWork: z.boolean(),
});

export const CustomerProfileSchema = z.object({
  companyName: z.string().trim().max(120),
  companySize: CompanySizeSchema,
  website: UrlSchema.nullable(),
});

export const MeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  /** Set for email/password and Google accounts. */
  email: z.string().nullable(),
  /** Set for GitHub accounts (and dev logins). */
  githubLogin: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  roles: z.array(AccountRoleSchema),
  currency: CurrencySchema,
  phone: z.string().nullable(),
  /** ISO 3166-1 alpha-2. */
  country: z.string(),
  /** IANA timezone, e.g. Asia/Ho_Chi_Minh. */
  timezone: z.string(),
  notifications: NotificationPrefsSchema,
  /** True for email/password accounts (they can change password). */
  hasPassword: z.boolean(),
  loginMethod: z.enum(['email', 'github', 'google', 'dev']),
  /** null until the user saves that profile. */
  coderProfile: CoderProfileDetailsSchema.nullable(),
  customerProfile: CustomerProfileSchema.nullable(),
  /** Set when the user has the CODER role. */
  coderStats: CoderStatsSchema.nullable(),
  createdAt: z.string(),
});

export const UpdateMeSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    avatarUrl: UrlSchema.nullable(),
    phone: z.string().trim().regex(/^\+?[0-9 ]{8,16}$/).nullable(),
    country: z.string().regex(/^[A-Z]{2}$/),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine((tz) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      }, 'Unknown IANA timezone'),
    currency: CurrencySchema,
    notifications: NotificationPrefsSchema,
  })
  .partial();

/** Adds a role to the signed-in account (e.g. a customer who also wants to code). */
export const AddRoleSchema = z.object({ role: UserRoleSchema });

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

/** Which login methods core-api has enabled, so the UI only offers working buttons. */
export const AuthProvidersSchema = z.object({
  password: z.boolean(),
  github: z.boolean(),
  google: z.boolean(),
  dev: z.boolean(),
});

/** OAuth providers reachable via GET /v1/auth/{provider}. */
export const OAuthProviderSchema = z.enum(['github', 'google']);

const EmailSchema = z.string().trim().toLowerCase().email().max(254);

/** Email/password sign-up. Password 8-128 chars; never echoed back. */
export const RegisterSchema = z.object({
  email: EmailSchema,
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(80),
  role: UserRoleSchema,
});

/** Login never changes roles: they are picked at sign-up or added via POST /v1/me/roles. */
export const PasswordLoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(128),
});

/** Local-only login (AUTH_DEV_LOGIN=true, never in production). */
export const DevLoginSchema = z.object({
  login: z.string().trim().regex(/^[a-z0-9-]{2,39}$/i),
  role: AccountRoleSchema,
});

export type UserRole = z.infer<typeof UserRoleSchema>;
export type AccountRole = z.infer<typeof AccountRoleSchema>;
export type Me = z.infer<typeof MeSchema>;
export type UpdateMe = z.infer<typeof UpdateMeSchema>;
export type AuthProviders = z.infer<typeof AuthProvidersSchema>;
export type OAuthProvider = z.infer<typeof OAuthProviderSchema>;
export type Register = z.infer<typeof RegisterSchema>;
export type PasswordLogin = z.infer<typeof PasswordLoginSchema>;
export type NotificationPrefs = z.infer<typeof NotificationPrefsSchema>;
export type ExperienceLevel = z.infer<typeof ExperienceLevelSchema>;
export type HoursPerWeek = z.infer<typeof HoursPerWeekSchema>;
export type LanguageLevel = z.infer<typeof LanguageLevelSchema>;
export type CompanySize = z.infer<typeof CompanySizeSchema>;
export type CoderProfileDetails = z.infer<typeof CoderProfileDetailsSchema>;
export type CustomerProfile = z.infer<typeof CustomerProfileSchema>;
export type AddRole = z.infer<typeof AddRoleSchema>;
export type ChangePassword = z.infer<typeof ChangePasswordSchema>;
