import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, ILike } from 'typeorm';
import { Record } from './entities/record.entity';
import { CreateRecordDto } from './dto/create-record.dto';
import { UpdateRecordDto } from './dto/update-record.dto';
import { QueryRecordsDto } from './dto/query-records.dto';

@Injectable()
export class RecordsService {
  constructor(
    @InjectRepository(Record)
    private recordRepository: Repository<Record>,
  ) {}

  /**
   * 创建记录
   */
  async create(
    userId: string,
    createRecordDto: CreateRecordDto,
    deviceId: string,
  ): Promise<Record> {
    const record = this.recordRepository.create({
      ...createRecordDto,
      userId,
      createdDeviceId: deviceId,
      lastModifiedDeviceId: deviceId,
      version: 1,
    });

    return this.recordRepository.save(record);
  }

  /**
   * 查询记录列表（支持多条件筛选）
   */
  async findAll(
    userId: string,
    queryDto: QueryRecordsDto,
  ): Promise<{ records: Record[]; total: number }> {
    const {
      type,
      startDate,
      endDate,
      moods,
      needs,
      weekRange,
      limit = 50,
      offset = 0,
    } = queryDto;

    const queryBuilder = this.recordRepository
      .createQueryBuilder('record')
      .where('record.userId = :userId', { userId })
      .andWhere('record.deletedAt IS NULL');

    // 按类型筛选
    if (type) {
      queryBuilder.andWhere('record.type = :type', { type });
    }

    // 按日期范围筛选
    if (startDate && endDate) {
      queryBuilder.andWhere('record.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    } else if (startDate) {
      queryBuilder.andWhere('record.createdAt >= :startDate', { startDate });
    } else if (endDate) {
      queryBuilder.andWhere('record.createdAt <= :endDate', { endDate });
    }

    // 按情绪筛选（数组包含查询）
    if (moods && moods.length > 0) {
      queryBuilder.andWhere('record.moods && :moods', { moods });
    }

    // 按需求筛选
    if (needs && needs.length > 0) {
      queryBuilder.andWhere('record.needs && :needs', { needs });
    }

    // 按周范围筛选
    if (weekRange) {
      queryBuilder.andWhere('record.weekRange = :weekRange', { weekRange });
    }

    // 分页
    const [records, total] = await queryBuilder
      .orderBy('record.createdAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { records, total };
  }

  /**
   * 获取单条记录
   */
  async findOne(userId: string, id: string): Promise<Record> {
    const record = await this.recordRepository.findOne({
      where: { id, userId, deletedAt: null as any },
    });

    if (!record) {
      throw new NotFoundException('记录不存在');
    }

    return record;
  }

  /**
   * 更新记录（含乐观锁）
   */
  async update(
    userId: string,
    id: string,
    updateRecordDto: UpdateRecordDto,
    deviceId: string,
  ): Promise<Record> {
    const { version, ...updateData } = updateRecordDto;

    // 查找记录
    const record = await this.findOne(userId, id);

    // 乐观锁检测
    if (record.version !== version) {
      throw new ConflictException({
        message: '记录已被其他设备修改',
        serverVersion: record.version,
        serverData: record,
      });
    }

    // 更新记录
    Object.assign(record, updateData);
    record.version += 1; // 版本递增
    record.lastModifiedDeviceId = deviceId;

    return this.recordRepository.save(record);
  }

  /**
   * 删除记录（软删除）
   */
  async remove(userId: string, id: string): Promise<void> {
    const record = await this.findOne(userId, id);

    record.deletedAt = new Date();
    await this.recordRepository.save(record);
  }

  /**
   * 全文搜索（基于转录文本）
   */
  async search(
    userId: string,
    query: string,
    limit: number = 20,
  ): Promise<Record[]> {
    return this.recordRepository
      .createQueryBuilder('record')
      .where('record.userId = :userId', { userId })
      .andWhere('record.deletedAt IS NULL')
      .andWhere(
        "to_tsvector('simple', record.transcription) @@ plainto_tsquery('simple', :query)",
        { query },
      )
      .orderBy('record.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  /**
   * 获取最近的记录
   */
  async getRecent(userId: string, limit: number = 10): Promise<Record[]> {
    return this.recordRepository.find({
      where: { userId, deletedAt: null as any },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * 按日期范围获取记录（用于周报生成）
   */
  async findByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Record[]> {
    return this.recordRepository.find({
      where: {
        userId,
        deletedAt: null as any,
        createdAt: Between(startDate, endDate),
      },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * 按 ID 列表批量获取记录
   */
  async findByIds(userId: string, ids: string[]): Promise<Record[]> {
    return this.recordRepository.find({
      where: {
        userId,
        id: In(ids),
        deletedAt: null as any,
      },
    });
  }
}
