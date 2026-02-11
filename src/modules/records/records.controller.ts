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
  Headers,
} from '@nestjs/common';
import { RecordsService } from './records.service';
import { CreateRecordDto } from './dto/create-record.dto';
import { UpdateRecordDto } from './dto/update-record.dto';
import { QueryRecordsDto } from './dto/query-records.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('records')
@UseGuards(JwtAuthGuard)
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  /**
   * POST /api/v1/records
   * 创建记录
   */
  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Headers('x-device-id') deviceId: string,
    @Body() createRecordDto: CreateRecordDto,
  ) {
    return this.recordsService.create(userId, createRecordDto, deviceId);
  }

  /**
   * GET /api/v1/records
   * 查询记录列表（支持筛选）
   */
  @Get()
  async findAll(
    @CurrentUser('id') userId: string,
    @Query() queryDto: QueryRecordsDto,
  ) {
    return this.recordsService.findAll(userId, queryDto);
  }

  /**
   * GET /api/v1/records/recent
   * 获取最近的记录
   */
  @Get('recent')
  async getRecent(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: number,
  ) {
    return this.recordsService.getRecent(userId, limit);
  }

  /**
   * GET /api/v1/records/search
   * 全文搜索
   */
  @Get('search')
  async search(
    @CurrentUser('id') userId: string,
    @Query('q') query: string,
    @Query('limit') limit?: number,
  ) {
    return this.recordsService.search(userId, query, limit);
  }

  /**
   * GET /api/v1/records/:id
   * 获取单条记录
   */
  @Get(':id')
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.recordsService.findOne(userId, id);
  }

  /**
   * PATCH /api/v1/records/:id
   * 更新记录（含乐观锁）
   */
  @Patch(':id')
  async update(
    @CurrentUser('id') userId: string,
    @Headers('x-device-id') deviceId: string,
    @Param('id') id: string,
    @Body() updateRecordDto: UpdateRecordDto,
  ) {
    return this.recordsService.update(userId, id, updateRecordDto, deviceId);
  }

  /**
   * DELETE /api/v1/records/:id
   * 删除记录（软删除）
   */
  @Delete(':id')
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.recordsService.remove(userId, id);
    return { message: '记录已删除' };
  }
}
