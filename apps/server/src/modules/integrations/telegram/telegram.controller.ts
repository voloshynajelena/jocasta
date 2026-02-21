import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TelegramService } from './telegram.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { NotificationsService } from '../../notifications/notifications.service';

@ApiTags('integrations/telegram')
@Controller('integrations/telegram')
export class TelegramController {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get('connect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get Telegram connection instructions' })
  @ApiResponse({ status: 200, description: 'Returns connection info' })
  async connect(@CurrentUser('id') userId: string) {
    if (!this.telegramService.isConfigured()) {
      return {
        configured: false,
        instructions: 'Telegram bot is not configured. Contact administrator.',
      };
    }

    const botInfo = await this.telegramService.getBotInfo();
    if (!botInfo) {
      return {
        configured: false,
        instructions: 'Failed to get bot info. Please try again later.',
      };
    }

    return {
      configured: true,
      botUsername: botInfo.username,
      deepLink: botInfo.deepLink,
      instructions: [
        `1. Open Telegram and search for @${botInfo.username}`,
        `2. Click "Start" or send /start`,
        `3. The bot will send you a confirmation code`,
        `4. Enter that code in the Jocasta app to complete connection`,
      ].join('\n'),
    };
  }

  @Post('register')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register Telegram chat ID' })
  @ApiResponse({ status: 200, description: 'Telegram registered' })
  async register(
    @CurrentUser('id') userId: string,
    @Body() body: { chatId: string },
  ) {
    await this.notificationsService.registerEndpoint(
      userId,
      'telegram',
      body.chatId,
    );

    // Send a test message
    const sent = await this.telegramService.sendMessage(
      body.chatId,
      `✅ Connected to Jocasta Scheduler!\n\nYou'll receive notifications here.`,
    );

    if (sent) {
      await this.notificationsService.verifyEndpoint(
        userId,
        'telegram',
        body.chatId,
      );
    }

    return { success: sent };
  }

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Telegram webhook endpoint' })
  async webhook(
    @Body() payload: any,
    @Headers('x-telegram-bot-api-secret-token') secret?: string,
  ) {
    // Verify webhook secret if configured
    if (secret && !this.telegramService.verifyWebhookSecret(secret)) {
      throw new ForbiddenException('Invalid webhook secret');
    }

    await this.telegramService.handleWebhook(payload);
    return { ok: true };
  }
}
