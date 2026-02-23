import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { DirectionsService } from './directions.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TransportMode } from '@jocasta/shared';

@ApiTags('directions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('directions')
export class DirectionsController {
  constructor(private readonly directionsService: DirectionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get directions between two points' })
  @ApiQuery({ name: 'fromLat', required: true, type: Number })
  @ApiQuery({ name: 'fromLng', required: true, type: Number })
  @ApiQuery({ name: 'toLat', required: true, type: Number })
  @ApiQuery({ name: 'toLng', required: true, type: Number })
  @ApiQuery({ name: 'mode', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Returns directions' })
  async getDirections(
    @Query('fromLat') fromLat: string,
    @Query('fromLng') fromLng: string,
    @Query('toLat') toLat: string,
    @Query('toLng') toLng: string,
    @Query('mode') mode?: string,
  ) {
    const transportMode = (mode as TransportMode) || 'sedan';

    const result = await this.directionsService.getDirections(
      parseFloat(fromLat),
      parseFloat(fromLng),
      parseFloat(toLat),
      parseFloat(toLng),
      transportMode,
    );

    return {
      etaMinutes: result.etaMinutes,
      distanceKm: Math.round(result.distanceMeters / 100) / 10,
      source: result.source,
      confidence: result.confidence,
    };
  }
}
