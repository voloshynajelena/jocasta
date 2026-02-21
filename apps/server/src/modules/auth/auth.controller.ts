import {
  Controller,
  Get,
  Post,
  Body,
  Res,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('google/start')
  @ApiOperation({ summary: 'Start Google OAuth flow (web)' })
  @ApiResponse({ status: 200, description: 'Returns Google OAuth URL' })
  async googleStart(@Res() res: Response) {
    const clientId = this.configService.get('google.clientId');
    const redirectUri = this.configService.get('google.redirectUri');
    const state = this.authService.generateState();

    const scopes = [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ].join(' ');

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', scopes);
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');

    // Store state in cookie for verification
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 600000, // 10 minutes
      sameSite: 'lax',
    });

    res.json({ authUrl: authUrl.toString(), state });
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback (web)' })
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as any;

    if (!user) {
      throw new UnauthorizedException('OAuth failed');
    }

    const tokens = await this.authService.validateGoogleUser({
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
    });

    // Set cookies
    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: isProd,
      maxAge: 900000, // 15 minutes
      sameSite: 'lax',
    });

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: isProd,
      maxAge: 604800000, // 7 days
      sameSite: 'lax',
    });

    // Redirect to client app
    const clientUrl =
      this.configService.get('EXPO_PUBLIC_WEB_URL') || 'http://localhost:8081';
    res.redirect(`${clientUrl}/auth/success`);
  }

  @Post('mobile/exchange')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange authorization code for tokens (mobile)' })
  @ApiResponse({ status: 200, description: 'Returns access and refresh tokens' })
  async mobileExchange(
    @Body() body: { code: string; codeVerifier: string; redirectUri: string },
  ) {
    return this.authService.exchangeMobileCode(
      body.code,
      body.codeVerifier,
      body.redirectUri,
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Returns new tokens' })
  async refresh(@Req() req: Request, @Res() res: Response) {
    const refreshToken =
      req.cookies?.refresh_token || req.body?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not provided');
    }

    const tokens = await this.authService.refreshTokens(refreshToken);

    // Update cookies for web
    if (req.cookies?.refresh_token) {
      const isProd = process.env.NODE_ENV === 'production';

      res.cookie('access_token', tokens.accessToken, {
        httpOnly: true,
        secure: isProd,
        maxAge: 900000,
        sameSite: 'lax',
      });

      res.cookie('refresh_token', tokens.refreshToken, {
        httpOnly: true,
        secure: isProd,
        maxAge: 604800000,
        sameSite: 'lax',
      });
    }

    res.json(tokens);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and clear tokens' })
  async logout(@Res() res: Response) {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    res.json({ success: true });
  }

  @Get('mobile/config')
  @ApiOperation({ summary: 'Get OAuth configuration for mobile app' })
  @ApiResponse({ status: 200, description: 'Returns OAuth config' })
  async mobileConfig() {
    const clientId = this.configService.get('google.clientId');
    const scopes = [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    return {
      clientId,
      scopes,
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
    };
  }
}
