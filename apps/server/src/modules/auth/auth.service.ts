import { Injectable, UnauthorizedException, Logger, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../../database/prisma.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

export interface JwtPayload {
  sub: string;
  email: string;
  role?: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface GoogleProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
  accessToken: string;
  refreshToken?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const key = this.configService.get<string>('encryption.key');
    this.encryptionKey = crypto.scryptSync(key || 'default-key', 'salt', 32);
  }

  async validateGoogleUser(profile: GoogleProfile): Promise<AuthTokens> {
    let user = await this.usersService.findByEmail(profile.email);

    if (!user) {
      // Create new user
      user = await this.usersService.create({
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.picture,
        timezone: this.configService.get('defaults.timezone'),
        defaultTransportMode: 'sedan',
      });
      this.logger.log(`Created new user: ${user.email}`);
    }

    // Update Google tokens (encrypted)
    if (profile.refreshToken) {
      const encryptedRefreshToken = this.encrypt(profile.refreshToken);
      const encryptedAccessToken = this.encrypt(profile.accessToken);

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleRefreshToken: encryptedRefreshToken,
          googleAccessToken: encryptedAccessToken,
          googleTokenExpiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
          avatarUrl: profile.picture || user.avatarUrl,
          name: profile.name || user.name,
        },
      });
    }

    return this.generateTokens(user.id, user.email);
  }

  async validateGoogleAccessToken(accessToken: string): Promise<AuthTokens> {
    // Validate the Google access token by fetching user info
    const response = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      throw new UnauthorizedException('Invalid Google access token');
    }

    const googleUser = await response.json();

    if (!googleUser.email) {
      throw new UnauthorizedException('Could not get email from Google');
    }

    // Find or create user
    let user = await this.usersService.findByEmail(googleUser.email);

    if (!user) {
      user = await this.usersService.create({
        email: googleUser.email,
        name: googleUser.name || googleUser.email.split('@')[0],
        avatarUrl: googleUser.picture,
        timezone: this.configService.get('defaults.timezone'),
        defaultTransportMode: 'sedan',
      });
      this.logger.log(`Created new user from mobile: ${user.email}`);
    } else {
      // Update user info if needed
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          avatarUrl: googleUser.picture || user.avatarUrl,
          name: googleUser.name || user.name,
        },
      });
    }

    // Store the Google access token (no refresh token from this flow)
    const encryptedAccessToken = this.encrypt(accessToken);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        googleAccessToken: encryptedAccessToken,
        googleTokenExpiresAt: new Date(Date.now() + 3600 * 1000),
      },
    });

    return this.generateTokens(user.id, user.email);
  }

  async validateJwt(payload: JwtPayload): Promise<any> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get('jwt.refreshSecret'),
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return this.generateTokens(user.id, user.email);
    } catch (error) {
      this.logger.error('Failed to refresh tokens', error);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async exchangeMobileCode(
    code: string,
    codeVerifier: string,
    redirectUri: string,
  ): Promise<AuthTokens> {
    // This is called after mobile app completes Google OAuth flow
    // The code should be exchanged for tokens using Google's token endpoint
    // For now, we'll implement this once we have the Google module set up
    throw new Error('Not implemented - requires Google OAuth token exchange');
  }

  async exchangeGoogleCodeForMobile(code: string): Promise<AuthTokens> {
    const clientId = this.configService.get('google.clientId');
    const clientSecret = this.configService.get('google.clientSecret');
    // Use configured API URL or default to localhost for development
    const apiUrl = this.configService.get('API_URL') || 'http://localhost:3001';
    const redirectUri = `${apiUrl}/api/v1/auth/google/mobile-callback`;

    // Exchange code for Google tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      this.logger.error('Google token exchange failed:', error);
      throw new UnauthorizedException('Failed to exchange code');
    }

    const googleTokens = await tokenResponse.json();

    // Get user info from Google
    const userInfoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${googleTokens.access_token}` },
      },
    );

    if (!userInfoResponse.ok) {
      throw new UnauthorizedException('Failed to get user info');
    }

    const googleUser = await userInfoResponse.json();

    // Create or update user
    return this.validateGoogleUser({
      id: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture,
      accessToken: googleTokens.access_token,
      refreshToken: googleTokens.refresh_token,
    });
  }

  generateTokens(userId: string, email: string): AuthTokens {
    const payload: JwtPayload = { sub: userId, email };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.secret'),
      expiresIn: this.configService.get('jwt.accessExpiresIn'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.refreshSecret'),
      expiresIn: this.configService.get('jwt.refreshExpiresIn'),
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  // Encryption helpers for storing Google tokens
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  decrypt(encryptedText: string): string {
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      this.encryptionKey,
      iv,
    );
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  // Email/Password Authentication
  async loginWithPassword(email: string, password: string): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    this.logger.log(`User logged in with password: ${user.email}`);
    return this.generateTokensWithRole(user.id, user.email, user.role);
  }

  async registerWithPassword(
    email: string,
    password: string,
    name?: string,
  ): Promise<AuthTokens> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name: name || email.split('@')[0],
        role: 'user',
        timezone: this.configService.get('defaults.timezone') || 'America/Edmonton',
        defaultTransportMode: 'sedan',
      },
    });

    this.logger.log(`New user registered: ${user.email}`);
    return this.generateTokensWithRole(user.id, user.email, user.role);
  }

  // Apple Sign-In
  async validateAppleUser(
    appleId: string,
    email: string,
    name?: string,
  ): Promise<AuthTokens> {
    // First, try to find user by Apple ID
    let user = await this.prisma.user.findUnique({
      where: { appleId },
    });

    if (!user && email) {
      // Try to find by email
      user = await this.prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (user) {
        // Link Apple ID to existing user
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { appleId },
        });
        this.logger.log(`Linked Apple ID to existing user: ${user.email}`);
      }
    }

    if (!user) {
      // Create new user
      user = await this.prisma.user.create({
        data: {
          email: email?.toLowerCase() || `apple_${appleId}@jocasta.app`,
          appleId,
          name: name || 'Apple User',
          role: 'user',
          timezone: this.configService.get('defaults.timezone') || 'America/Edmonton',
          defaultTransportMode: 'sedan',
        },
      });
      this.logger.log(`Created new user from Apple Sign-In: ${user.email}`);
    }

    return this.generateTokensWithRole(user.id, user.email, user.role);
  }

  generateTokensWithRole(userId: string, email: string, role: string): AuthTokens {
    const payload: JwtPayload = { sub: userId, email, role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.secret'),
      expiresIn: this.configService.get('jwt.accessExpiresIn'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.refreshSecret'),
      expiresIn: this.configService.get('jwt.refreshExpiresIn'),
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }
}
