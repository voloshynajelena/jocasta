import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../../database/prisma.service';
import * as crypto from 'crypto';

export interface JwtPayload {
  sub: string;
  email: string;
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
}
