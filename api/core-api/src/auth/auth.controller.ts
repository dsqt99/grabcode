import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import {
  AddRoleSchema,
  ChangePasswordSchema,
  CoderProfileDetailsSchema,
  CustomerProfileSchema,
  DevLoginSchema,
  OAuthProviderSchema,
  PasswordLoginSchema,
  RegisterSchema,
  UpdateMeSchema,
  UserRoleSchema,
  type AuthProviders,
  type Me,
  type UserRole,
} from '@grabcode/contracts/schemas';
import { API_PUBLIC_URL, DEV_LOGIN_ENABLED, IS_PROD, WEB_ORIGINS } from '../config';
import { AuthService, SESSION_COOKIE, SESSION_TTL_MS } from './auth.service';
import { OAUTH_PROVIDERS } from './oauth';

const OAUTH_COOKIE = 'gc_oauth';
const callbackUrl = (provider: string) => `${API_PUBLIC_URL}/v1/auth/${provider}/callback`;
const cookieBase: CookieOptions = { httpOnly: true, sameSite: 'lax', secure: IS_PROD, path: '/' };
const oauthCookie: CookieOptions = { ...cookieBase, path: '/v1/auth' };

export const readCookie = (req: Request, name: string): string | undefined => {
  const raw = req.headers.cookie
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${name}=`));
  return raw ? decodeURIComponent(raw.slice(name.length + 1)) : undefined;
};

/** Only redirect back to our own web origins (prevents open redirect). */
const safeRedirect = (url: string | undefined): string => {
  try {
    if (url && WEB_ORIGINS.includes(new URL(url).origin)) return url;
  } catch {}
  return `${WEB_ORIGINS[0]}/`;
};

const invalid = (issues: unknown) => new BadRequestException({ message: 'Invalid request', issues });

@Controller('v1')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  private setSession(res: Response, token: string) {
    res.cookie(SESSION_COOKIE, token, { ...cookieBase, maxAge: SESSION_TTL_MS });
  }

  @Get('auth/providers')
  providers(): AuthProviders {
    return { password: true, github: OAUTH_PROVIDERS.github.configured, google: OAUTH_PROVIDERS.google.configured, dev: DEV_LOGIN_ENABLED };
  }

  @Post('auth/register')
  @HttpCode(201)
  async register(@Body() body: unknown, @Res({ passthrough: true }) res: Response): Promise<Me> {
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) throw invalid(parsed.error.issues);
    const { token, user } = await this.auth.register(parsed.data);
    this.setSession(res, token);
    return this.auth.me(user);
  }

  @Post('auth/login')
  @HttpCode(200)
  async passwordLogin(@Body() body: unknown, @Res({ passthrough: true }) res: Response): Promise<Me> {
    const parsed = PasswordLoginSchema.safeParse(body);
    if (!parsed.success) throw invalid(parsed.error.issues);
    const { token, user } = await this.auth.passwordLogin(parsed.data);
    this.setSession(res, token);
    return this.auth.me(user);
  }

  @Get('auth/:provider')
  startOAuth(
    @Param('provider') providerName: string,
    @Query('role') role: string,
    @Query('redirect') redirect: string | undefined,
    @Res() res: Response,
  ) {
    const name = OAuthProviderSchema.safeParse(providerName);
    if (!name.success || !OAUTH_PROVIDERS[name.data].configured) throw new NotFoundException({ message: 'Login provider is not configured' });
    const parsedRole = UserRoleSchema.optional().safeParse(role || undefined);
    if (!parsedRole.success) throw invalid(parsedRole.error.issues);
    const state = randomBytes(16).toString('base64url');
    // state is checked against this httpOnly cookie on callback (CSRF protection for the OAuth flow).
    res.cookie(OAUTH_COOKIE, JSON.stringify({ state, provider: name.data, role: parsedRole.data, redirect: safeRedirect(redirect) }), {
      ...oauthCookie,
      maxAge: 10 * 60 * 1000,
    });
    res.redirect(OAUTH_PROVIDERS[name.data].authorizeUrl(callbackUrl(name.data), state));
  }

  @Get('auth/:provider/callback')
  async oauthCallback(
    @Param('provider') providerName: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    let pending: { state?: string; provider?: string; role?: UserRole; redirect?: string } = {};
    try {
      pending = JSON.parse(readCookie(req, OAUTH_COOKIE) ?? '{}');
    } catch {}
    res.clearCookie(OAUTH_COOKIE, oauthCookie);
    const back = new URL(safeRedirect(pending.redirect));
    const name = OAuthProviderSchema.safeParse(providerName);
    const role = UserRoleSchema.optional().safeParse(pending.role);
    if (!code || !state || state !== pending.state || !name.success || pending.provider !== name.data || !role.success) {
      back.searchParams.set('auth_error', 'state');
      return res.redirect(back.toString());
    }
    try {
      // Auth is core-api's job; the code exchange is two short calls with 5s timeouts, not heavy lifting.
      const identity = await OAUTH_PROVIDERS[name.data].exchange(code, callbackUrl(name.data));
      const { token } = await this.auth.login(identity, role.data);
      this.setSession(res, token);
    } catch (err) {
      console.error(`${name.data} login failed`, err);
      back.searchParams.set('auth_error', 'oauth');
    }
    res.redirect(back.toString());
  }

  @Post('auth/dev-login')
  @HttpCode(200)
  async devLogin(@Body() body: unknown, @Res({ passthrough: true }) res: Response): Promise<Me> {
    if (!DEV_LOGIN_ENABLED) throw new NotFoundException();
    const parsed = DevLoginSchema.safeParse(body);
    if (!parsed.success) throw invalid(parsed.error.issues);
    const { login, role } = parsed.data;
    const { token, user } = await this.auth.login(
      { providerKey: `dev:${login.toLowerCase()}`, githubLogin: login, email: null, name: login, avatarUrl: null },
      role,
    );
    this.setSession(res, token);
    return this.auth.me(user);
  }

  @Post('auth/logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(readCookie(req, SESSION_COOKIE));
    res.clearCookie(SESSION_COOKIE, cookieBase);
  }

  private user(req: Request) {
    return this.auth.requireUser(readCookie(req, SESSION_COOKIE));
  }

  @Get('me')
  async me(@Req() req: Request): Promise<Me> {
    return this.auth.me(await this.user(req));
  }

  @Patch('me')
  async updateMe(@Req() req: Request, @Body() body: unknown): Promise<Me> {
    const user = await this.user(req);
    const parsed = UpdateMeSchema.safeParse(body);
    if (!parsed.success) throw invalid(parsed.error.issues);
    return this.auth.me(await this.auth.update(user.id, parsed.data));
  }

  @Post('me/roles')
  @HttpCode(200)
  async addRole(@Req() req: Request, @Body() body: unknown): Promise<Me> {
    const user = await this.user(req);
    const parsed = AddRoleSchema.safeParse(body);
    if (!parsed.success) throw invalid(parsed.error.issues);
    return this.auth.me(await this.auth.addRole(user.id, parsed.data.role));
  }

  @Put('me/coder-profile')
  async saveCoderProfile(@Req() req: Request, @Body() body: unknown): Promise<Me> {
    const user = await this.user(req);
    const parsed = CoderProfileDetailsSchema.safeParse(body);
    if (!parsed.success) throw invalid(parsed.error.issues);
    await this.auth.saveCoderProfile(user, parsed.data);
    return this.auth.me(user);
  }

  @Put('me/customer-profile')
  async saveCustomerProfile(@Req() req: Request, @Body() body: unknown): Promise<Me> {
    const user = await this.user(req);
    const parsed = CustomerProfileSchema.safeParse(body);
    if (!parsed.success) throw invalid(parsed.error.issues);
    await this.auth.saveCustomerProfile(user, parsed.data);
    return this.auth.me(user);
  }

  @Post('me/password')
  @HttpCode(204)
  async changePassword(@Req() req: Request, @Body() body: unknown): Promise<void> {
    const token = readCookie(req, SESSION_COOKIE);
    const user = await this.auth.requireUser(token);
    const parsed = ChangePasswordSchema.safeParse(body);
    if (!parsed.success) throw invalid(parsed.error.issues);
    await this.auth.changePassword(user, token!, parsed.data);
  }
}
