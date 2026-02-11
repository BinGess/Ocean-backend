import * as bcrypt from 'bcrypt';

/**
 * 加密工具类
 */
export class CryptoUtil {
  private static readonly SALT_ROUNDS = 12;

  /**
   * 对密码进行 bcrypt 加密
   * @param password 明文密码
   * @returns 加密后的哈希值
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * 验证密码是否匹配
   * @param password 明文密码
   * @param hash 存储的哈希值
   * @returns 是否匹配
   */
  static async comparePassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * 生成随机 Token Hash (用于 Refresh Token)
   * @param token 原始 Token
   * @returns Token Hash
   */
  static async hashToken(token: string): Promise<string> {
    return bcrypt.hash(token, 10); // Refresh Token 用较低的 cost
  }

  /**
   * 验证 Token 是否匹配
   * @param token 原始 Token
   * @param hash 存储的 Token Hash
   * @returns 是否匹配
   */
  static async compareToken(token: string, hash: string): Promise<boolean> {
    return bcrypt.compare(token, hash);
  }
}
