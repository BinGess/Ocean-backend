import { Response } from 'express';

/**
 * Server-Sent Events (SSE) 流式响应工具类
 */
export class SSEHelper {
  /**
   * 初始化 SSE 连接
   * 设置必要的 HTTP 头
   */
  static initSSE(res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Nginx 禁用缓冲
    res.flushHeaders();
  }

  /**
   * 发送 SSE 事件
   * @param res Express Response 对象
   * @param event 事件名称 (例如: 'message', 'progress', 'result', 'error')
   * @param data 事件数据 (会自动 JSON 序列化)
   */
  static sendEvent(res: Response, event: string, data: any): void {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  /**
   * 发送错误事件并结束连接
   * @param res Express Response 对象
   * @param error 错误信息
   */
  static sendError(res: Response, error: string | Error): void {
    const errorMessage = typeof error === 'string' ? error : error.message;
    this.sendEvent(res, 'error', { error: errorMessage });
    res.end();
  }

  /**
   * 发送完成事件并结束 SSE 流
   * @param res Express Response 对象
   */
  static endSSE(res: Response): void {
    this.sendEvent(res, 'done', {});
    res.end();
  }

  /**
   * 发送进度事件
   * @param res Express Response 对象
   * @param stage 当前阶段描述
   * @param progress 进度百分比 (0-100)
   */
  static sendProgress(
    res: Response,
    stage: string,
    progress: number,
  ): void {
    this.sendEvent(res, 'progress', { stage, progress });
  }
}
