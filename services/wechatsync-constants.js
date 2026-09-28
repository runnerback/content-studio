export const DEFAULT_WECHATSYNC_PORT = 9527;
export const DEFAULT_REQUEST_TIMEOUT_MS = 360000;
export const DEFAULT_CONNECT_TIMEOUT_MS = 60000;
export const DEFAULT_PLATFORM_REQUEST_TIMEOUT_MS = 60000;
export const DEFAULT_SYNC_REQUEST_TIMEOUT_MS = 180000;
export const DEFAULT_HELLO_TIMEOUT_MS = 30000;
export const LOCAL_BIND_HOST = '127.0.0.1';
export const REMOTE_BIND_HOST = '0.0.0.0';
export const HELLO_ERROR_TOKEN_MISMATCH = 'token_mismatch';
export const HELLO_ERROR_INVALID_PAYLOAD = 'invalid_payload';
export const HELLO_ERROR_TIMEOUT = 'hello_timeout';
export const HELLO_ERROR_VERSION_UNSUPPORTED = 'version_unsupported';
export const HELLO_ERROR_DUPLICATE_SESSION = 'duplicate_session';
export const HELLO_ERROR_TOO_MANY_CLIENTS = 'too_many_clients';
export const DEFAULT_MAX_CLIENTS = 4;
// 桥接协议版本（docs/bridge-protocol.md，v1.1 起扩展在 hello.capabilities.protocolVersion 上报）：
// 主版本相同才接受；扩展没报（< 3.1.0）按 1.0 兼容。
export const BRIDGE_PROTOCOL_VERSION = '1.1';
export const BRIDGE_PROTOCOL_MAJOR = 1;
// 小红书 / X 发布额度与许可密钥的服务端（计量在扩展侧调用；插件只用它兑换密钥）
export const LICENSE_API_BASE = 'https://api.runfast.xyz/license';
// 配套浏览器扩展「多栖 Crosspost」的发行状态（3.12.0）：未上架应用商店前，公开构建里的相关入口只说明"尚未发行"，
// 不再给出仓库内构建 / 加载已解压的步骤（市场用户拿不到扩展）。发行后把这里改 true 并补安装地址。
// "尚未发行"的标题 / 说明文案在 i18n 字典 multiPlatform.extensionUnreleasedTitle / extensionUnreleasedDesc。
export const CROSSPOST_EXTENSION_RELEASED = false;
export const CROSSPOST_EXTENSION_NAME = '多栖 Crosspost';
