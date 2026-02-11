import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller';
import { CozeNvcService } from './services/coze-nvc.service';
import { AiApiLog } from './entities/ai-api-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AiApiLog])],
  controllers: [AiController],
  providers: [CozeNvcService],
  exports: [CozeNvcService],
})
export class AiModule {}
