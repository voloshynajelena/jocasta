import {
  Controller,
  Get,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { GoogleCalendarService } from './google-calendar.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('integrations/google')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('integrations/google')
export class GoogleController {
  constructor(private readonly googleCalendarService: GoogleCalendarService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get Google Calendar sync status' })
  @ApiResponse({ status: 200, description: 'Returns sync status' })
  async getStatus(@CurrentUser('id') userId: string) {
    return this.googleCalendarService.getSyncStatus(userId);
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger Google Calendar sync' })
  @ApiResponse({ status: 200, description: 'Sync completed' })
  async syncNow(@CurrentUser('id') userId: string) {
    try {
      const result = await this.googleCalendarService.syncFromGoogle(userId);
      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      return {
        success: false,
        errors: [error.message],
      };
    }
  }
}
