# 客户端接入手册

本文档详细说明如何将 Flutter 客户端改造为云端同步架构，接入 MindFlow Backend。

---

## 目录

1. [概述](#概述)
2. [架构变更](#架构变更)
3. [依赖包更新](#依赖包更新)
4. [网络层改造](#网络层改造)
5. [认证服务实现](#认证服务实现)
6. [数据同步实现](#数据同步实现)
7. [AI API 改造](#ai-api-改造)
8. [UI 页面新增](#ui-页面新增)
9. [测试验证](#测试验证)

---

## 概述

### 改造目标

将 MindFlow 从纯本地应用升级为支持云端同步的应用：
- ✅ 用户可以多设备登录
- ✅ 数据自动云端备份
- ✅ 离线编辑 + 在线同步
- ✅ 冲突自动检测与解决
- ✅ 第三方 API 密钥隐藏在服务端

### 架构对比

**现有架构**：
```
Flutter App
  ├── Hive (本地存储) → 所有数据
  ├── Doubao API (直接调用) → 语音识别
  └── Coze API (直接调用) → NVC 分析、周报生成
```

**新架构**：
```
Flutter App
  ├── Hive (本地缓存 + 离线队列)
  ├── Backend API (云端存储)
  │     ├── PostgreSQL → 所有数据
  │     ├── Doubao API 代理 → 语音识别
  │     └── Coze API 代理 → NVC 分析、周报生成
  └── 后台同步服务 (WorkManager)
```

---

## 架构变更

### 1. 数据流变更

#### 创建记录流程

**旧流程**：
```
1. 用户录音
2. 调用 Doubao ASR API → 语音转文字
3. 调用 Coze NVC API → 情绪分析
4. 保存到 Hive
```

**新流程**：
```
1. 用户录音
2. 调用 Backend /api/v1/ai/transcribe → 语音转文字
3. 调用 Backend /api/v1/ai/analyze-nvc → 情绪分析
4. 保存到 Hive (标记为待同步)
5. 后台同步任务上传到云端
```

#### 查询记录流程

**旧流程**：
```
1. 从 Hive 直接查询
2. 返回结果
```

**新流程**：
```
1. 先从 Hive 查询（本地缓存）
2. 后台同步任务拉取云端更新
3. 合并本地 + 云端数据
4. 返回结果
```

---

## 依赖包更新

### pubspec.yaml 新增依赖

```yaml
dependencies:
  # 现有依赖...
  dio: ^5.4.0  # 已有，HTTP 客户端
  flutter_secure_storage: ^9.0.0  # 已有，存储 Token

  # 新增依赖
  connectivity_plus: ^5.0.0  # 网络状态检测
  workmanager: ^0.5.0  # 后台同步任务
  uuid: ^4.0.0  # 生成设备 ID
```

安装命令：
```bash
flutter pub add connectivity_plus workmanager uuid
```

---

## 网络层改造

### 1. 创建 API 客户端

**文件位置**：`lib/core/network/backend_api_client.dart`

```dart
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class BackendApiClient {
  static const String baseUrl = 'http://localhost:3000/api/v1'; // 开发环境
  // static const String baseUrl = 'https://api.mindflow.example.com/api/v1'; // 生产环境

  final Dio _dio;
  final FlutterSecureStorage _secureStorage;

  BackendApiClient()
      : _dio = Dio(BaseOptions(
          baseUrl: baseUrl,
          connectTimeout: const Duration(seconds: 30),
          receiveTimeout: const Duration(seconds: 60),
        )),
        _secureStorage = const FlutterSecureStorage() {
    _dio.interceptors.add(_authInterceptor());
    _dio.interceptors.add(_loggingInterceptor());
  }

  /// 认证拦截器（自动添加 Token）
  Interceptor _authInterceptor() {
    return InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _secureStorage.read(key: 'access_token');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }

        final deviceId = await _getDeviceId();
        options.headers['X-Device-Id'] = deviceId;

        handler.next(options);
      },
      onError: (DioException error, handler) async {
        // Token 过期，自动刷新
        if (error.response?.statusCode == 401) {
          final refreshed = await _refreshToken();
          if (refreshed) {
            // 重试原请求
            final opts = Options(
              method: error.requestOptions.method,
              headers: error.requestOptions.headers,
            );
            final cloneReq = await _dio.request(
              error.requestOptions.path,
              options: opts,
              data: error.requestOptions.data,
              queryParameters: error.requestOptions.queryParameters,
            );
            return handler.resolve(cloneReq);
          }
        }
        handler.next(error);
      },
    );
  }

  /// 日志拦截器
  Interceptor _loggingInterceptor() {
    return LogInterceptor(
      request: true,
      requestBody: true,
      responseBody: true,
      error: true,
    );
  }

  /// 刷新 Access Token
  Future<bool> _refreshToken() async {
    try {
      final refreshToken = await _secureStorage.read(key: 'refresh_token');
      if (refreshToken == null) return false;

      final response = await _dio.post('/auth/refresh', data: {
        'refreshToken': refreshToken,
      });

      final newAccessToken = response.data['accessToken'];
      await _secureStorage.write(key: 'access_token', value: newAccessToken);

      return true;
    } catch (e) {
      print('Token 刷新失败: $e');
      return false;
    }
  }

  /// 获取设备 ID（首次生成后持久化）
  Future<String> _getDeviceId() async {
    var deviceId = await _secureStorage.read(key: 'device_id');
    if (deviceId == null) {
      deviceId = const Uuid().v4();
      await _secureStorage.write(key: 'device_id', value: deviceId);
    }
    return deviceId;
  }

  // ========== GET 请求 ==========
  Future<Response> get(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    return _dio.get(path, queryParameters: queryParameters);
  }

  // ========== POST 请求 ==========
  Future<Response> post(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
  }) async {
    return _dio.post(path, data: data, queryParameters: queryParameters);
  }

  // ========== PATCH 请求 ==========
  Future<Response> patch(
    String path, {
    dynamic data,
  }) async {
    return _dio.patch(path, data: data);
  }

  // ========== DELETE 请求 ==========
  Future<Response> delete(String path) async {
    return _dio.delete(path);
  }

  // ========== SSE 流式请求 ==========
  Stream<SseEvent> postSSE(
    String path,
    dynamic data,
  ) async* {
    final response = await _dio.post(
      path,
      data: data,
      options: Options(responseType: ResponseType.stream),
    );

    final stream = response.data.stream;
    final decoder = Utf8Decoder();
    final splitter = LineSplitter();

    String? currentEvent;

    await for (final chunk in stream) {
      final lines = splitter.convert(decoder.convert(chunk));

      for (final line in lines) {
        if (line.startsWith('event:')) {
          currentEvent = line.substring(6).trim();
        } else if (line.startsWith('data:')) {
          final data = jsonDecode(line.substring(5).trim());
          if (currentEvent != null) {
            yield SseEvent(currentEvent, data);
            currentEvent = null;
          }
        }
      }
    }
  }
}

/// SSE 事件封装
class SseEvent {
  final String event;
  final dynamic data;

  SseEvent(this.event, this.data);
}
```

---

## 认证服务实现

### 1. 认证服务

**文件位置**：`lib/core/services/auth_service.dart`

```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:device_info_plus/device_info_plus.dart';
import '../network/backend_api_client.dart';

class AuthService {
  final BackendApiClient _apiClient;
  final FlutterSecureStorage _secureStorage;

  AuthService(this._apiClient, this._secureStorage);

  /// 用户注册
  Future<AuthResponse> register({
    required String phone,
    required String password,
  }) async {
    final deviceInfo = await _getDeviceInfo();

    final response = await _apiClient.post('/auth/register', data: {
      'phone': phone,
      'password': password,
      'deviceInfo': deviceInfo,
    });

    return _saveTokens(response.data);
  }

  /// 用户登录
  Future<AuthResponse> login({
    required String identifier,
    required String password,
  }) async {
    final deviceInfo = await _getDeviceInfo();

    final response = await _apiClient.post('/auth/login', data: {
      'identifier': identifier,
      'password': password,
      'deviceInfo': deviceInfo,
    });

    return _saveTokens(response.data);
  }

  /// 登出
  Future<void> logout() async {
    final refreshToken = await _secureStorage.read(key: 'refresh_token');

    if (refreshToken != null) {
      await _apiClient.post('/auth/logout', data: {
        'refreshToken': refreshToken,
      });
    }

    // 清除本地 Token
    await _secureStorage.deleteAll();
  }

  /// 检查登录状态
  Future<bool> isLoggedIn() async {
    final token = await _secureStorage.read(key: 'access_token');
    return token != null;
  }

  /// 获取当前用户信息
  Future<User> getCurrentUser() async {
    final response = await _apiClient.get('/auth/me');
    return User.fromJson(response.data);
  }

  /// 获取设备列表
  Future<List<Device>> getDevices() async {
    final response = await _apiClient.get('/auth/devices');
    return (response.data as List)
        .map((d) => Device.fromJson(d))
        .toList();
  }

  /// 删除设备（远程登出）
  Future<void> deleteDevice(String deviceId) async {
    await _apiClient.delete('/auth/devices/$deviceId');
  }

  /// 保存 Token
  Future<AuthResponse> _saveTokens(Map<String, dynamic> data) async {
    final user = User.fromJson(data['user']);
    final tokens = data['tokens'];

    await _secureStorage.write(
      key: 'access_token',
      value: tokens['accessToken'],
    );
    await _secureStorage.write(
      key: 'refresh_token',
      value: tokens['refreshToken'],
    );

    return AuthResponse(user: user, tokens: tokens);
  }

  /// 获取设备信息
  Future<Map<String, dynamic>> _getDeviceInfo() async {
    final deviceInfo = DeviceInfoPlugin();
    final uuid = const Uuid();

    // 获取或生成设备 ID
    var deviceId = await _secureStorage.read(key: 'device_id');
    if (deviceId == null) {
      deviceId = uuid.v4();
      await _secureStorage.write(key: 'device_id', value: deviceId);
    }

    if (Platform.isIOS) {
      final iosInfo = await deviceInfo.iosInfo;
      return {
        'deviceId': deviceId,
        'deviceName': iosInfo.name, // "iPhone 15 Pro"
        'platform': 'ios',
        'osVersion': iosInfo.systemVersion,
        'appVersion': '1.0.0', // 从 package_info_plus 获取
      };
    } else {
      final androidInfo = await deviceInfo.androidInfo;
      return {
        'deviceId': deviceId,
        'deviceName': androidInfo.model,
        'platform': 'android',
        'osVersion': androidInfo.version.release,
        'appVersion': '1.0.0',
      };
    }
  }
}

/// 认证响应
class AuthResponse {
  final User user;
  final Map<String, dynamic> tokens;

  AuthResponse({required this.user, required this.tokens});
}

/// 用户模型
class User {
  final String id;
  final String? phone;
  final String? email;
  final String? username;

  User({
    required this.id,
    this.phone,
    this.email,
    this.username,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      phone: json['phone'],
      email: json['email'],
      username: json['username'],
    );
  }
}

/// 设备模型
class Device {
  final String id;
  final String deviceName;
  final String platform;
  final DateTime lastActiveAt;

  Device({
    required this.id,
    required this.deviceName,
    required this.platform,
    required this.lastActiveAt,
  });

  factory Device.fromJson(Map<String, dynamic> json) {
    return Device(
      id: json['id'],
      deviceName: json['deviceName'] ?? 'Unknown Device',
      platform: json['platform'],
      lastActiveAt: DateTime.parse(json['lastActiveAt']),
    );
  }
}
```

---

## 数据同步实现

### 1. 同步服务

**文件位置**：`lib/core/services/sync_service.dart`

```dart
import 'package:hive/hive.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import '../network/backend_api_client.dart';
import '../../data/models/record_model.dart';

class SyncService {
  final BackendApiClient _apiClient;
  final Box<RecordModel> _recordsBox;
  final FlutterSecureStorage _secureStorage;

  SyncService(this._apiClient, this._recordsBox, this._secureStorage);

  /// 后台自动同步（每 5 分钟一次）
  Future<void> backgroundSync() async {
    // 检查网络连接
    final connectivity = await Connectivity().checkConnectivity();
    if (connectivity == ConnectivityResult.none) {
      print('无网络连接，跳过同步');
      return;
    }

    try {
      // 1. 拉取服务端更新
      await _pullChanges();

      // 2. 推送本地变更
      await _pushChanges();

      print('同步完成');
    } catch (e) {
      print('同步失败: $e');
    }
  }

  /// 增量拉取服务端更新
  Future<void> _pullChanges() async {
    final lastSyncTime = await _getLastSyncTime();

    final response = await _apiClient.get('/sync/pull', queryParameters: {
      'lastSyncTimestamp': lastSyncTime?.toIso8601String(),
      'entityTypes': 'record,weekly_insight',
    });

    final changes = response.data['changes'];

    // 应用创建的记录
    for (final recordData in changes['records']['created']) {
      final record = RecordModel.fromJson(recordData);
      await _recordsBox.put(record.id, record);
    }

    // 应用更新的记录
    for (final recordData in changes['records']['updated']) {
      final record = RecordModel.fromJson(recordData);
      final existing = _recordsBox.get(record.id);

      // 版本检查：服务端版本 > 本地版本才更新
      if (existing == null || record.version > existing.version) {
        await _recordsBox.put(record.id, record);
      }
    }

    // 应用删除的记录
    for (final recordId in changes['records']['deleted']) {
      await _recordsBox.delete(recordId);
    }

    // 保存同步时间戳
    await _saveLastSyncTime(DateTime.parse(response.data['syncTimestamp']));
  }

  /// 批量推送本地变更
  Future<void> _pushChanges() async {
    final pendingRecords = await _getPendingRecords();

    if (pendingRecords.isEmpty) return;

    final changes = {
      'records': {
        'created': pendingRecords
            .where((r) => r.createdAt.isAfter(_lastSyncTime!))
            .map((r) => r.toJson())
            .toList(),
        'updated': pendingRecords
            .where((r) => r.updatedAt.isAfter(_lastSyncTime!) &&
                r.createdAt.isBefore(_lastSyncTime!))
            .map((r) => r.toJson())
            .toList(),
        'deleted': [], // 暂不支持删除
      },
    };

    final response = await _apiClient.post('/sync/push', data: {
      'deviceId': await _getDeviceId(),
      'changes': changes,
    });

    // 处理冲突
    final conflicts = response.data['conflicts'];
    if (conflicts.isNotEmpty) {
      await _handleConflicts(conflicts);
    }

    // 标记已同步
    for (final record in pendingRecords) {
      record.isSynced = true;
      await _recordsBox.put(record.id, record);
    }
  }

  /// 处理冲突（默认策略：服务端优先）
  Future<void> _handleConflicts(List<dynamic> conflicts) async {
    for (final conflict in conflicts) {
      final entityId = conflict['entityId'];
      final serverData = conflict['serverData'];

      // 使用服务端数据覆盖本地
      final record = RecordModel.fromJson(serverData);
      await _recordsBox.put(entityId, record);

      print('冲突已解决（服务端优先）: $entityId');
    }
  }

  /// 首次迁移：批量上传本地数据
  Future<void> migrateLocalData({
    required void Function(double progress) onProgress,
  }) async {
    final allRecords = _recordsBox.values.toList();

    // 分批上传（每批 100 条）
    const batchSize = 100;
    for (int i = 0; i < allRecords.length; i += batchSize) {
      final batch = allRecords.skip(i).take(batchSize).toList();

      await _apiClient.post('/sync/bulk-migrate', data: {
        'records': batch.map((r) => r.toJson()).toList(),
      });

      // 更新进度
      final progress = (i + batch.length) / allRecords.length;
      onProgress(progress);
    }

    // 标记所有记录为已同步
    for (final record in allRecords) {
      record.isSynced = true;
      await _recordsBox.put(record.id, record);
    }

    await _saveLastSyncTime(DateTime.now());
  }

  /// 获取待同步的记录
  Future<List<RecordModel>> _getPendingRecords() async {
    return _recordsBox.values
        .where((r) => r.isSynced == false)
        .toList();
  }

  /// 获取上次同步时间
  Future<DateTime?> _getLastSyncTime() async {
    final timestamp = await _secureStorage.read(key: 'last_sync_time');
    return timestamp != null ? DateTime.parse(timestamp) : null;
  }

  /// 保存同步时间
  Future<void> _saveLastSyncTime(DateTime time) async {
    await _secureStorage.write(
      key: 'last_sync_time',
      value: time.toIso8601String(),
    );
  }

  /// 获取设备 ID
  Future<String> _getDeviceId() async {
    return (await _secureStorage.read(key: 'device_id'))!;
  }
}
```

---

## AI API 改造

### 1. AI Repository 改造

**文件位置**：`lib/data/repositories/ai_repository_impl.dart`

#### 旧代码（直接调用 Coze API）
```dart
class AIRepository {
  final CozeAiService _cozeService;

  Future<NVCAnalysis> analyzeNVC(String transcription) async {
    return _cozeService.analyzeNVC(transcription);
  }
}
```

#### 新代码（调用后端 API）
```dart
class AIRepository {
  final BackendApiClient _apiClient;

  /// NVC 情绪分析（SSE 流式响应）
  Future<NVCAnalysis> analyzeNVC(
    String transcription, {
    void Function(int progress)? onProgress,
  }) async {
    final stream = _apiClient.postSSE('/ai/analyze-nvc', {
      'transcription': transcription,
    });

    await for (final event in stream) {
      if (event.event == 'progress') {
        onProgress?.call(event.data['progress']);
      } else if (event.event == 'result') {
        return NVCAnalysis.fromJson(event.data);
      } else if (event.event == 'error') {
        throw Exception(event.data['error']);
      }
    }

    throw Exception('NVC 分析失败');
  }

  /// 语音转文字（Doubao ASR）
  Future<String> transcribeAudio(
    Uint8List audioBytes, {
    void Function(String partialText)? onPartial,
  }) async {
    final stream = _apiClient.postSSE('/ai/transcribe', audioBytes);

    String finalText = '';

    await for (final event in stream) {
      if (event.event == 'partial') {
        final partialText = event.data['text'];
        onPartial?.call(partialText);
      } else if (event.event == 'final') {
        finalText = event.data['text'];
      } else if (event.event == 'error') {
        throw Exception(event.data['error']);
      }
    }

    return finalText;
  }

  /// 周报生成（Coze Insight）
  Future<WeeklyInsightReport> generateInsight(
    String weekRange,
    List<String> recordIds, {
    void Function(int progress)? onProgress,
  }) async {
    final stream = _apiClient.postSSE('/ai/generate-insight', {
      'weekRange': weekRange,
      'recordIds': recordIds,
    });

    await for (final event in stream) {
      if (event.event == 'progress') {
        onProgress?.call(event.data['progress']);
      } else if (event.event == 'result') {
        return WeeklyInsightReport.fromJson(event.data);
      } else if (event.event == 'error') {
        throw Exception(event.data['error']);
      }
    }

    throw Exception('周报生成失败');
  }
}
```

---

## UI 页面新增

### 1. 登录/注册页面

**文件位置**：`lib/presentation/screens/auth/login_screen.dart`

```dart
import 'package:flutter/material.dart';
import '../../../core/services/auth_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLogin = true;
  bool _isLoading = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_isLogin ? '登录' : '注册')),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              TextFormField(
                controller: _phoneController,
                decoration: const InputDecoration(labelText: '手机号'),
                keyboardType: TextInputType.phone,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return '请输入手机号';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _passwordController,
                decoration: const InputDecoration(labelText: '密码'),
                obscureText: true,
                validator: (value) {
                  if (value == null || value.length < 8) {
                    return '密码至少 8 位';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _isLoading ? null : _submit,
                child: _isLoading
                    ? const CircularProgressIndicator()
                    : Text(_isLogin ? '登录' : '注册'),
              ),
              TextButton(
                onPressed: () {
                  setState(() {
                    _isLogin = !_isLogin;
                  });
                },
                child: Text(_isLogin ? '没有账号？注册' : '已有账号？登录'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
    });

    try {
      final authService = context.read<AuthService>();

      if (_isLogin) {
        await authService.login(
          identifier: _phoneController.text,
          password: _passwordController.text,
        );
      } else {
        await authService.register(
          phone: _phoneController.text,
          password: _passwordController.text,
        );
      }

      // 登录成功，跳转到主页
      Navigator.of(context).pushReplacementNamed('/home');
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${_isLogin ? '登录' : '注册'}失败: $e')),
      );
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }
}
```

### 2. 首次迁移引导页

**文件位置**：`lib/presentation/screens/sync/migration_screen.dart`

```dart
import 'package:flutter/material.dart';
import '../../../core/services/sync_service.dart';

class MigrationScreen extends StatefulWidget {
  const MigrationScreen({Key? key}) : super(key: key);

  @override
  State<MigrationScreen> createState() => _MigrationScreenState();
}

class _MigrationScreenState extends State<MigrationScreen> {
  double _progress = 0.0;
  bool _isMigrating = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('数据迁移')),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.cloud_upload, size: 80, color: Colors.blue),
            const SizedBox(height: 24),
            const Text(
              '检测到本地有未同步的数据',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            const Text(
              '是否将本地数据上传到云端？\n这样你可以在多个设备上访问你的记录。',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            if (_isMigrating) ...[
              LinearProgressIndicator(value: _progress),
              const SizedBox(height: 16),
              Text('${(_progress * 100).toInt()}%'),
            ] else ...[
              ElevatedButton(
                onPressed: _startMigration,
                child: const Text('开始迁移'),
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () {
                  Navigator.of(context).pop();
                },
                child: const Text('暂时跳过'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _startMigration() async {
    setState(() {
      _isMigrating = true;
    });

    try {
      final syncService = context.read<SyncService>();

      await syncService.migrateLocalData(
        onProgress: (progress) {
          setState(() {
            _progress = progress;
          });
        },
      );

      // 迁移完成
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('数据迁移完成！')),
      );

      Navigator.of(context).pop();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('迁移失败: $e')),
      );
    }
  }
}
```

---

## 测试验证

### 1. 本地开发测试

启动后端服务：
```bash
cd Ocean-backend
npm run start:dev
```

启动 Flutter 应用：
```bash
cd Ocean  # Flutter 项目目录
flutter run
```

### 2. 功能测试清单

- [ ] **注册测试**
  - 输入手机号和密码
  - 成功注册并自动登录
  - Token 存储到 SecureStorage

- [ ] **登录测试**
  - 输入正确的手机号和密码
  - 成功登录并获取 Token
  - 失败 5 次后账号锁定 1 分钟

- [ ] **Token 刷新测试**
  - Access Token 过期后自动刷新
  - Refresh Token 失效后跳转到登录页

- [ ] **数据同步测试**
  - 创建记录后自动上传到云端
  - 多设备登录后数据同步
  - 离线创建记录，联网后自动同步

- [ ] **冲突解决测试**
  - 两个设备同时修改同一条记录
  - 服务端检测到冲突并返回
  - 客户端使用服务端数据覆盖本地

- [ ] **AI 功能测试**
  - 语音识别通过后端调用
  - NVC 分析显示 SSE 流式进度
  - 周报生成成功

---

## 常见问题

### Q1: Token 过期怎么处理？
A1: 使用拦截器自动刷新 Token，无需用户手动操作。

### Q2: 如何处理网络中断？
A2: 本地数据标记为"待同步"，网络恢复后自动同步。

### Q3: 冲突如何解决？
A3: 默认策略为服务端优先，后续可支持手动选择。

### Q4: 如何测试多设备同步？
A4: 使用两个模拟器或真机，登录同一账号，创建/修改记录观察同步效果。

---

## 联系与支持

如有问题，请联系技术支持团队。
