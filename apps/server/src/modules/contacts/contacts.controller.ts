import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ContactsService, CreateContactDto, UpdateContactDto, ContactQueryDto } from './contacts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @ApiOperation({ summary: 'List user contacts' })
  @ApiQuery({ name: 'category', required: false, enum: ['general', 'work', 'personal', 'family', 'service'] })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name, email, or phone' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Returns paginated list of contacts' })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query() query: ContactQueryDto,
  ) {
    return this.contactsService.findMany(userId, query);
  }

  @Get('search')
  @ApiOperation({ summary: 'Fuzzy search contacts by name' })
  @ApiQuery({ name: 'q', required: true, description: 'Name to search for' })
  @ApiQuery({ name: 'threshold', required: false, type: Number, description: 'Similarity threshold (0-1)' })
  @ApiResponse({ status: 200, description: 'Returns similar contacts with similarity scores' })
  async search(
    @CurrentUser('id') userId: string,
    @Query('q') searchQuery: string,
    @Query('threshold') threshold?: string,
  ) {
    const thresholdNum = threshold ? parseFloat(threshold) : 0.6;
    const similar = await this.contactsService.findSimilar(userId, searchQuery, thresholdNum);
    return { results: similar };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contact by ID' })
  @ApiResponse({ status: 200, description: 'Returns contact details' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.contactsService.findById(id, userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new contact' })
  @ApiResponse({ status: 201, description: 'Contact created' })
  @ApiResponse({ status: 409, description: 'Contact with this email already exists' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() createDto: CreateContactDto,
  ) {
    return this.contactsService.create(userId, createDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a contact' })
  @ApiResponse({ status: 200, description: 'Contact updated' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateContactDto,
  ) {
    return this.contactsService.update(id, userId, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a contact' })
  @ApiResponse({ status: 204, description: 'Contact deleted' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async delete(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.contactsService.delete(id, userId);
  }
}
