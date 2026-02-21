import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async check() {
    const checks = {
      database: await this.checkDatabase(),
      googleApi: this.checkGoogleConfig(),
      telegram: this.checkTelegramConfig(),
      weather: 'ok', // Open-Meteo is free, always available
      directions: this.checkDirectionsConfig(),
    };

    const status = Object.values(checks).every((c) => c === 'ok')
      ? 'ok'
      : Object.values(checks).some((c) => c === 'error')
        ? 'error'
        : 'degraded';

    return {
      status,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      services: checks,
    };
  }

  private async checkDatabase(): Promise<'ok' | 'error'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'error';
    }
  }

  private checkGoogleConfig(): 'ok' | 'error' | 'not_configured' {
    const clientId = this.configService.get('google.clientId');
    const clientSecret = this.configService.get('google.clientSecret');

    if (!clientId || !clientSecret) {
      return 'not_configured';
    }

    return 'ok';
  }

  private checkTelegramConfig(): 'ok' | 'error' | 'not_configured' {
    const botToken = this.configService.get('telegram.botToken');

    if (!botToken) {
      return 'not_configured';
    }

    return 'ok';
  }

  private checkDirectionsConfig(): 'ok' | 'error' {
    const mapsKey = this.configService.get('google.mapsApiKey');

    // Directions fallback to heuristic, so always "ok"
    return 'ok';
  }
}
