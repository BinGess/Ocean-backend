import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { AiApiLog, AiApiType } from '../entities/ai-api-log.entity';

export interface NVCAnalysisResult {
  observation: string;
  feelings: Array<{ feeling: string; intensity: number }>;
  needs: Array<{ need: string; reason: string }>;
  request?: string;
  insight?: string;
  analyzedAt: string;
}

@Injectable()
export class CozeNvcService {
  private readonly logger = new Logger(CozeNvcService.name);
  private readonly apiToken: string;
  private readonly baseUrl: string;
  private readonly projectId: string;

  constructor(
    private configService: ConfigService,
    @InjectRepository(AiApiLog)
    private aiApiLogRepository: Repository<AiApiLog>,
  ) {
    this.apiToken = this.configService.get<string>('COZE_API_TOKEN') || '';
    this.baseUrl = this.configService.get<string>('COZE_BASE_URL') || 'https://api.coze.cn/v1';
    this.projectId = this.configService.get<string>('COZE_PROJECT_ID') || '';
  }

  /**
   * NVC 情绪分析（SSE 流式）
   */
  async* analyzeNVC(
    transcription: string,
    userId?: string,
  ): AsyncGenerator<
    { type: 'progress' | 'result' | 'error'; data: any },
    void,
    unknown
  > {
    const startTime = Date.now();
    let statusCode = 200;
    let errorMessage: string | null = null;

    try {
      this.logger.log(`开始 NVC 分析，转录文本长度: ${transcription.length}`);

      // 发送进度
      yield { type: 'progress', data: { stage: 'analyzing', progress: 0 } };

      // 调用 Coze API（SSE 流式）
      const response = await axios.post(
        `${this.baseUrl}/stream_run`,
        {
          project_id: this.projectId,
          input: {
            transcription,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          responseType: 'stream',
          timeout: 60000, // 60 秒超时
        },
      );

      statusCode = response.status;
      let buffer = '';
      let result: NVCAnalysisResult | null = null;

      // 处理 SSE 流
      for await (const chunk of response.data) {
        buffer += chunk.toString();

        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留不完整的行

        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.substring(5).trim());

              // 根据 Coze API 响应格式处理
              if (data.type === 'progress') {
                yield {
                  type: 'progress',
                  data: { stage: 'analyzing', progress: data.progress || 50 },
                };
              } else if (data.type === 'result' || data.observation) {
                result = this._parseNVCResult(data);
                yield { type: 'result', data: result };
              }
            } catch (e) {
              this.logger.warn(`解析 SSE 数据失败: ${e.message}`);
            }
          }
        }
      }

      // 记录日志
      await this._logApiCall(
        userId,
        statusCode,
        Date.now() - startTime,
        transcription.length,
        null,
      );

      this.logger.log('NVC 分析完成');
    } catch (error) {
      statusCode = error.response?.status || 500;
      errorMessage = error.message;

      this.logger.error(`NVC 分析失败: ${errorMessage}`, error.stack);

      // 记录错误日志
      await this._logApiCall(
        userId,
        statusCode,
        Date.now() - startTime,
        transcription.length,
        errorMessage,
      );

      yield { type: 'error', data: { error: errorMessage } };
    }
  }

  /**
   * 解析 NVC 分析结果
   */
  private _parseNVCResult(data: any): NVCAnalysisResult {
    return {
      observation: data.observation || '',
      feelings:
        data.feelings?.map((f: any) => ({
          feeling: f.feeling,
          intensity: f.intensity || 3,
        })) || [],
      needs:
        data.needs?.map((n: any) => ({
          need: n.need,
          reason: n.reason || '',
        })) || [],
      request: data.request,
      insight: data.insight,
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * 记录 API 调用日志
   */
  private async _logApiCall(
    userId: string | undefined,
    statusCode: number,
    responseTimeMs: number,
    inputLength: number,
    errorMessage: string | null,
  ): Promise<void> {
    try {
      const log = this.aiApiLogRepository.create({
        userId: userId || null,
        apiType: AiApiType.COZE_NVC,
        statusCode,
        responseTimeMs,
        inputTokens: Math.ceil(inputLength / 4), // 粗略估算
        errorMessage,
        estimatedCost: this._estimateCost(inputLength),
      });

      await this.aiApiLogRepository.save(log);
    } catch (e) {
      this.logger.error(`记录 API 日志失败: ${e.message}`);
    }
  }

  /**
   * 估算成本（单位：分）
   */
  private _estimateCost(inputLength: number): number {
    // 假设每 1000 字符 0.01 元
    return (inputLength / 1000) * 0.01;
  }
}
