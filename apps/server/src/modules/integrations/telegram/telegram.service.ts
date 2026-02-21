import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';

interface TelegramMessage {
  chat_id: number | string;
  text: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  reply_markup?: {
    inline_keyboard: Array<
      Array<{
        text: string;
        callback_data: string;
      }>
    >;
  };
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string | undefined;
  private readonly webhookSecret: string | undefined;
  private readonly apiUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
  ) {
    this.botToken = this.configService.get('telegram.botToken');
    this.webhookSecret = this.configService.get('telegram.webhookSecret');
    this.apiUrl = this.botToken
      ? `https://api.telegram.org/bot${this.botToken}`
      : '';
  }

  /**
   * Check if Telegram is configured
   */
  isConfigured(): boolean {
    return !!this.botToken;
  }

  /**
   * Get bot info for connection instructions
   */
  async getBotInfo(): Promise<{ username: string; deepLink: string } | null> {
    if (!this.botToken) {
      return null;
    }

    try {
      const response = await fetch(`${this.apiUrl}/getMe`);
      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.description);
      }

      const username = data.result.username;
      return {
        username,
        deepLink: `https://t.me/${username}?start=connect`,
      };
    } catch (error) {
      this.logger.error('Failed to get bot info', error);
      return null;
    }
  }

  /**
   * Send a message to a Telegram chat
   */
  async sendMessage(
    chatId: string | number,
    text: string,
    options?: {
      parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
      buttons?: Array<Array<{ text: string; callbackData: string }>>;
    },
  ): Promise<boolean> {
    if (!this.botToken) {
      this.logger.warn('Telegram not configured');
      return false;
    }

    const message: TelegramMessage = {
      chat_id: chatId,
      text,
      parse_mode: options?.parseMode || 'HTML',
    };

    if (options?.buttons) {
      message.reply_markup = {
        inline_keyboard: options.buttons.map((row) =>
          row.map((btn) => ({
            text: btn.text,
            callback_data: btn.callbackData,
          })),
        ),
      };
    }

    try {
      const response = await fetch(`${this.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      const data = await response.json();

      if (!data.ok) {
        this.logger.error('Telegram send failed', data.description);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Telegram send error', error);
      return false;
    }
  }

  /**
   * Handle incoming webhook from Telegram
   */
  async handleWebhook(payload: any): Promise<void> {
    if (payload.message) {
      await this.handleMessage(payload.message);
    } else if (payload.callback_query) {
      await this.handleCallbackQuery(payload.callback_query);
    }
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(message: any): Promise<void> {
    const chatId = message.chat.id;
    const text = message.text || '';
    const userId = message.from.id;

    // Handle /start command for connection
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      if (parts.length > 1 && parts[1] === 'connect') {
        // User is connecting - we need their app user ID
        await this.sendMessage(
          chatId,
          `👋 Welcome to Jocasta Scheduler!\n\n` +
            `To connect your account, please enter the connection code shown in the app.`,
        );
        return;
      }

      // Regular start
      await this.sendMessage(
        chatId,
        `👋 Welcome to Jocasta Scheduler!\n\n` +
          `I'll send you reminders and scheduling updates.\n\n` +
          `Commands:\n` +
          `/status - Check your next events\n` +
          `/help - Get help`,
      );
      return;
    }

    // Handle connection code
    if (text.match(/^[A-Z0-9]{6}$/i)) {
      // This would be a connection code - for MVP, we'll handle this differently
      await this.sendMessage(
        chatId,
        `Connection codes are being set up. Please check the app for connection status.`,
      );
      return;
    }

    // Handle /status command
    if (text === '/status') {
      // Find user by telegram chat ID
      const endpoint = await this.prisma.notificationEndpoint.findFirst({
        where: { channel: 'telegram', address: chatId.toString() },
      });

      if (!endpoint) {
        await this.sendMessage(
          chatId,
          `❌ Your Telegram is not connected to a Jocasta account.\n\n` +
            `Please connect through the Jocasta app settings.`,
        );
        return;
      }

      // Get upcoming events
      const events = await this.prisma.event.findMany({
        where: {
          userId: endpoint.userId,
          startAt: { gte: new Date() },
        },
        orderBy: { startAt: 'asc' },
        take: 5,
        include: { location: true },
      });

      if (events.length === 0) {
        await this.sendMessage(chatId, `📅 No upcoming events scheduled.`);
        return;
      }

      const eventList = events
        .map((e) => {
          const time = e.startAt.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          });
          return `• <b>${e.title}</b>\n  ${time}${e.location ? `\n  📍 ${e.location.name}` : ''}`;
        })
        .join('\n\n');

      await this.sendMessage(chatId, `📅 <b>Upcoming Events</b>\n\n${eventList}`);
      return;
    }

    // Handle /help
    if (text === '/help') {
      await this.sendMessage(
        chatId,
        `<b>Jocasta Scheduler Help</b>\n\n` +
          `I'm your scheduling assistant bot. Here's what I can do:\n\n` +
          `📬 Send you reminders before events\n` +
          `🚗 Alert you when it's time to leave\n` +
          `🗳 Let you respond to scheduling proposals\n\n` +
          `<b>Commands:</b>\n` +
          `/status - View upcoming events\n` +
          `/help - Show this help message`,
      );
      return;
    }

    // Unknown message
    await this.sendMessage(
      chatId,
      `I didn't understand that. Try /help for available commands.`,
    );
  }

  /**
   * Handle callback query (button press)
   */
  private async handleCallbackQuery(query: any): Promise<void> {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;
    const callbackQueryId = query.id;

    // Acknowledge the callback
    await this.answerCallbackQuery(callbackQueryId);

    // Parse callback data
    const [action, ...params] = data.split(':');

    switch (action) {
      case 'dismiss':
        await this.editMessage(chatId, messageId, '✅ Acknowledged');
        break;

      case 'snooze':
        const minutes = parseInt(params[0], 10) || 5;
        await this.editMessage(
          chatId,
          messageId,
          `⏰ Snoozed for ${minutes} minutes`,
        );
        // TODO: Reschedule notification
        break;

      case 'accept':
        const proposalId = params[0];
        await this.editMessage(chatId, messageId, `✅ Accepted proposal`);
        // TODO: Trigger proposal commit
        break;

      default:
        this.logger.warn(`Unknown callback action: ${action}`);
    }
  }

  /**
   * Answer callback query
   */
  private async answerCallbackQuery(callbackQueryId: string): Promise<void> {
    if (!this.botToken) return;

    try {
      await fetch(`${this.apiUrl}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQueryId }),
      });
    } catch (error) {
      this.logger.error('Failed to answer callback query', error);
    }
  }

  /**
   * Edit a message
   */
  private async editMessage(
    chatId: number,
    messageId: number,
    text: string,
  ): Promise<void> {
    if (!this.botToken) return;

    try {
      await fetch(`${this.apiUrl}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: 'HTML',
        }),
      });
    } catch (error) {
      this.logger.error('Failed to edit message', error);
    }
  }

  /**
   * Verify webhook secret
   */
  verifyWebhookSecret(secret: string): boolean {
    return this.webhookSecret === secret;
  }
}
