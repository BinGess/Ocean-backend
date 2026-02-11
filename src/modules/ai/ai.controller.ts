import {
  Controller,
  Post,
  Body,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SSEHelper } from '../../utils/sse.util';
import { CozeNvcService } from './services/coze-nvc.service';
import { IsString, IsNotEmpty } from 'class-validator';

class AnalyzeNvcDto {
  @IsString()
  @IsNotEmpty()
  transcription: string;
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly cozeNvcService: CozeNvcService) {}

  /**
   * POST /api/v1/ai/analyze-nvc
   * NVC 情绪分析（SSE 流式响应）
   */
  @Post('analyze-nvc')
  @Throttle({ 'ai-api': { limit: 10, ttl: 60000 } }) // AI API 限流：10 次/分钟
  @UsePipes(new ValidationPipe({ transform: true }))
  async analyzeNVC(
    @CurrentUser('id') userId: string,
    @Body() dto: AnalyzeNvcDto,
    @Res() res: Response,
  ) {
    SSEHelper.initSSE(res);

    try {
      const stream = this.cozeNvcService.analyzeNVC(
        dto.transcription,
        userId,
      );

      for await (const chunk of stream) {
        if (chunk.type === 'progress') {
          SSEHelper.sendEvent(res, 'progress', chunk.data);
        } else if (chunk.type === 'result') {
          SSEHelper.sendEvent(res, 'result', chunk.data);
        } else if (chunk.type === 'error') {
          SSEHelper.sendError(res, chunk.data.error);
          return;
        }
      }

      SSEHelper.endSSE(res);
    } catch (error) {
      SSEHelper.sendError(res, error.message);
    }
  }
}
