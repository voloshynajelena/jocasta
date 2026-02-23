import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
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
import { BatchPlannerService, BatchProposeRequest, BatchCommitRequest } from './batch-planner.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('planner')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('planner')
export class PlannerController {
  constructor(
    private readonly plannerService: PlannerService,
    private readonly batchPlannerService: BatchPlannerService,
  ) {}

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

  // ============================================================
  // Batch Planning Endpoints
  // ============================================================

  @Post('batch/propose')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Extract and propose multiple events from text' })
  @ApiResponse({ status: 200, description: 'Returns extracted events, contacts, and proposals' })
  async batchPropose(
    @CurrentUser('id') userId: string,
    @Body() request: BatchProposeRequest,
  ) {
    return this.batchPlannerService.propose(userId, request);
  }

  @Post('batch/commit')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Commit selected events and contacts from batch' })
  @ApiResponse({ status: 201, description: 'Events and contacts created' })
  async batchCommit(
    @CurrentUser('id') userId: string,
    @Body() request: BatchCommitRequest,
  ) {
    return this.batchPlannerService.commit(userId, request);
  }

  @Get('batch/session/:id')
  @ApiOperation({ summary: 'Get batch planning session details' })
  @ApiResponse({ status: 200, description: 'Returns session details' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async getSession(
    @CurrentUser('id') userId: string,
    @Param('id') sessionId: string,
  ) {
    return this.batchPlannerService.getSession(sessionId, userId);
  }

  @Delete('batch/session/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel batch planning session' })
  @ApiResponse({ status: 204, description: 'Session cancelled' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async cancelSession(
    @CurrentUser('id') userId: string,
    @Param('id') sessionId: string,
  ) {
    await this.batchPlannerService.cancelSession(sessionId, userId);
  }
}
