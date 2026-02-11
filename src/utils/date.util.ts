/**
 * 日期处理工具类
 */
export class DateUtil {
  /**
   * 获取当前周的日期范围
   * @param date 参考日期 (默认为当前日期)
   * @returns 周范围字符串，例如 "2026-02-10 ~ 2026-02-16"
   */
  static getWeekRange(date: Date = new Date()): string {
    const startDate = this.getWeekStart(date);
    const endDate = this.getWeekEnd(date);

    return `${this.formatDate(startDate)} ~ ${this.formatDate(endDate)}`;
  }

  /**
   * 获取一周的开始日期 (周一)
   * @param date 参考日期
   * @returns 周一日期
   */
  static getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Sunday, 1 = Monday, ...
    const diff = day === 0 ? -6 : 1 - day; // 调整到周一
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * 获取一周的结束日期 (周日)
   * @param date 参考日期
   * @returns 周日日期
   */
  static getWeekEnd(date: Date): Date {
    const startDate = this.getWeekStart(date);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
    return endDate;
  }

  /**
   * 格式化日期为 YYYY-MM-DD
   * @param date 日期对象
   * @returns 格式化的日期字符串
   */
  static formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 解析周范围字符串
   * @param weekRange 周范围字符串 "2026-02-10 ~ 2026-02-16"
   * @returns { startDate, endDate }
   */
  static parseWeekRange(weekRange: string): {
    startDate: Date;
    endDate: Date;
  } {
    const [startStr, endStr] = weekRange.split(' ~ ');
    return {
      startDate: new Date(startStr),
      endDate: new Date(endStr),
    };
  }

  /**
   * 检查日期是否在指定范围内
   * @param date 要检查的日期
   * @param startDate 范围开始
   * @param endDate 范围结束
   * @returns 是否在范围内
   */
  static isDateInRange(
    date: Date,
    startDate: Date,
    endDate: Date,
  ): boolean {
    return date >= startDate && date <= endDate;
  }
}
