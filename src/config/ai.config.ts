import { ConfigService } from '@nestjs/config';

export interface DoubaoAsrConfig {
  appKey: string;
  accessKey: string;
  resourceId: string;
}

export interface DoubaoLlmConfig {
  apiKey: string;
  modelId: string;
}

export interface CozeAiConfig {
  apiToken: string;
  baseUrl: string;
  projectId: string;
  botId?: string;
}

export const getDoubaoAsrConfig = (
  configService: ConfigService,
): DoubaoAsrConfig => ({
  appKey: configService.get<string>('DOUBAO_ASR_APP_KEY') || '',
  accessKey: configService.get<string>('DOUBAO_ASR_ACCESS_KEY') || '',
  resourceId: configService.get<string>('DOUBAO_ASR_RESOURCE_ID') || '',
});

export const getDoubaoLlmConfig = (
  configService: ConfigService,
): DoubaoLlmConfig => ({
  apiKey: configService.get<string>('DOUBAO_LLM_API_KEY') || '',
  modelId: configService.get<string>('DOUBAO_MODEL_ID') || 'doubao-pro-32k',
});

export const getCozeNvcConfig = (
  configService: ConfigService,
): CozeAiConfig => ({
  apiToken: configService.get<string>('COZE_API_TOKEN') || '',
  baseUrl: configService.get<string>('COZE_BASE_URL') || 'https://api.coze.cn/v1',
  projectId: configService.get<string>('COZE_PROJECT_ID') || '',
  botId: configService.get<string>('COZE_BOT_ID'),
});

export const getCozeInsightConfig = (
  configService: ConfigService,
): CozeAiConfig => ({
  apiToken: configService.get<string>('COZE_INSIGHT_API_TOKEN') || '',
  baseUrl: configService.get<string>('COZE_INSIGHT_BASE_URL') || 'https://api.coze.cn/v1',
  projectId: configService.get<string>('COZE_INSIGHT_PROJECT_ID') || '',
});
