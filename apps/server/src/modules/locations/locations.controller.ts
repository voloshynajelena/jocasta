import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import {
  LocationsService,
  CreateLocationDto,
  UpdateLocationDto,
} from './locations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('locations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  @ApiOperation({ summary: 'List locations' })
  @ApiResponse({ status: 200, description: 'Returns all locations' })
  async list(@CurrentUser('id') userId: string) {
    const locations = await this.locationsService.findMany(userId);
    return { locations, total: locations.length };
  }

  @Get('search')
  @ApiOperation({ summary: 'Search places' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Returns place suggestions' })
  async search(
    @CurrentUser('id') userId: string,
    @Query('q') query: string,
  ) {
    if (!query || query.length < 2) {
      return { suggestions: [] };
    }
    const suggestions = await this.locationsService.searchPlaces(query, userId);
    return { suggestions };
  }

  @Get('details/:placeId')
  @ApiOperation({ summary: 'Get place details' })
  @ApiResponse({ status: 200, description: 'Returns place coordinates' })
  async getPlaceDetails(@Param('placeId') placeId: string) {
    const details = await this.locationsService.getPlaceDetails(placeId);
    return details || { error: 'Place not found' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get location by ID' })
  @ApiResponse({ status: 200, description: 'Returns location' })
  @ApiResponse({ status: 404, description: 'Location not found' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.locationsService.findById(id, userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create location' })
  @ApiResponse({ status: 201, description: 'Location created' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() createDto: CreateLocationDto,
  ) {
    return this.locationsService.create(userId, createDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update location' })
  @ApiResponse({ status: 200, description: 'Location updated' })
  @ApiResponse({ status: 404, description: 'Location not found' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateLocationDto,
  ) {
    return this.locationsService.update(id, userId, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete location' })
  @ApiResponse({ status: 204, description: 'Location deleted' })
  @ApiResponse({ status: 404, description: 'Location not found' })
  async delete(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.locationsService.delete(id, userId);
  }
}
