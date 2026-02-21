import {
  Controller,
  Post,
  Body,
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
import { PlannerService, ProposeRequest, CommitRequest } from './planner.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('planner')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('planner')
export class PlannerController {
  constructor(private readonly plannerService: PlannerService) {}

  @Post('propose')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get scheduling proposals from natural language input' })
  @ApiResponse({ status: 200, description: 'Returns scheduling proposals' })
  async propose(
    @CurrentUser('id') userId: string,
    @Body() request: ProposeRequest,
  ) {
    return this.plannerService.propose(userId, request);
  }

  @Post('commit')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Commit a proposal to create event' })
  @ApiResponse({ status: 201, description: 'Event created from proposal' })
  async commit(
    @CurrentUser('id') userId: string,
    @Body() request: CommitRequest,
  ) {
    return this.plannerService.commit(userId, request);
  }
}
