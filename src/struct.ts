// src/struct.ts
export type FileRule = {
  extensions: string[]; // список поддерживаемых расширений
  parse: (text: string) => any; // функция парсинга
  stringify: (obj: any) => string; // превращение объекта обратно в текст
  sensitiveKeys: string[]; // ключи для шифрования
  patternBased?: boolean; // использовать паттерн-матчинг
  allowCustomKeys?: boolean; // разрешить пользовательские ключи
};

// Выносим общие ключи в отдельную константу
const COMMON_SENSITIVE_KEYS = [
  // === Аутентификация и базовые секреты ===
  'user', 'username', 'login', 'email',
  'pass', 'password', 'pwd', 'passwd', 'passphrase',
  'secret', 'secretkey', 'secret_key', 'secret-key',
  'token', 'accesstoken', 'refreshtoken', 'authtoken', 'apitoken',
  'auth', 'authorization', 'credentials', 'credential',
  'apikey', 'api_key', 'api-key', 'api_secret', 'api-secret',
  'clientid', 'client_id', 'client-id', 'clientsecret', 'client_secret', 'client-secret',
  'appid', 'app_id', 'app-id', 'appsecret', 'app_secret', 'app-secret',
  
  // === Криптография и безопасность ===
  'crypto', 'cryptokey', 'crypto_key', 'crypto-key',
  'encrypt', 'encryption', 'encrypted',
  'decrypt', 'decryption',
  'cipher', 'decipher',
  'hash', 'hashed',
  'salt', 'salted',
  'iv', 'initialization_vector',
  'nonce',
  'signature', 'signing_key',
  'private_key', 'privatekey', 'public_key', 'publickey',
  'rsa', 'dsa', 'ecdsa', 'ed25519',
  'cert', 'certificate', 'ca', 'crt', 'pem', 'key', 'pub',
  
  // === UUID и идентификаторы (если они секретные) ===
  'uuid', 'guid', 'id', 'uid', 'gid',
  'session_id', 'sessionid',
  'device_id', 'deviceid',
  'installation_id', 'installationid',
  'correlation_id', 'correlationid',
  'request_id', 'requestid',
  'trace_id', 'traceid',
  'span_id', 'spanid',
  
  // === Ссылки и подключения (если содержат credentials) ===
  'link', 'links',
  'url', 'uri', 'urn',
  'endpoint', 'webhook', 'callback',
  'redirect_uri', 'redirect_url',
  'return_url', 'return_uri',
  'origin', 'referer', 'referrer',
  'proxy', 'proxy_url', 'proxy_uri',
  
  // === Основные и главные ключи ===
  'main', 'master', 'primary', 'secondary',
  'root', 'admin', 'super', 'superuser', 'sudo',
  'default', 'fallback', 'backup',
  'production', 'prod', 'development', 'dev', 'staging',
  
  // === Скрытые поля ===
  'hide', 'hidden', 'private', 'internal',
  'secure', 'protected', 'classified',
  'confidential', 'restricted', 'sensitive',
  
  // === Значения (если содержат секреты) ===
  'value', 'values',
  'data', 'payload',
  'content', 'contents',
  'text', 'string',
  'field', 'fields',
  
  // === Ключи API сервисов (расширенно) ===
  'stripe', 'stripe_key', 'stripe_secret', 'stripe_public', 'stripe_private', 'stripe_live', 'stripe_test',
  'github', 'github_token', 'github_key', 'github_secret', 'github_pat', 'github_oauth',
  'gitlab', 'gitlab_token', 'gitlab_key', 'gitlab_secret', 'gitlab_pat',
  'aws', 'aws_key', 'aws_secret', 'aws_access', 'aws_secret_access', 'aws_session',
  's3', 's3_key', 's3_secret', 's3_access', 's3_secret_access', 's3_bucket',
  'azure', 'azure_key', 'azure_secret', 'azure_connection', 'azure_tenant', 'azure_subscription',
  'google', 'google_key', 'google_secret', 'google_api', 'google_oauth', 'google_service',
  'facebook', 'facebook_key', 'facebook_secret', 'facebook_app', 'facebook_oauth',
  'twitter', 'twitter_key', 'twitter_secret', 'twitter_api', 'twitter_bearer',
  'discord', 'discord_token', 'discord_key', 'discord_secret', 'discord_bot',
  'slack', 'slack_token', 'slack_key', 'slack_secret', 'slack_webhook', 'slack_bot',
  'telegram', 'telegram_token', 'telegram_bot', 'telegram_key', 'telegram_api',
  'twilio', 'twilio_sid', 'twilio_token', 'twilio_key', 'twilio_auth',
  'sendgrid', 'sendgrid_key', 'sendgrid_api', 'sendgrid_smtp',
  'mailgun', 'mailgun_key', 'mailgun_api', 'mailgun_smtp',
  'mongodb', 'mongodb_uri', 'mongodb_url', 'mongodb_connection', 'mongodb_srv',
  'mysql', 'mysql_uri', 'mysql_url', 'mysql_connection', 'mysql_host',
  'postgres', 'postgresql', 'postgres_uri', 'postgres_url', 'postgres_connection', 'pg_host',
  'redis', 'redis_uri', 'redis_url', 'redis_connection', 'redis_host',
  'elastic', 'elasticsearch', 'elastic_uri', 'elastic_url',
  'rabbitmq', 'rabbit_uri', 'rabbit_url', 'rabbit_connection',
  'kafka', 'kafka_broker', 'kafka_host',
  
  // === Базы данных (все варианты) ===
  'db', 'database',
  'db_uri', 'db_url', 'db_connection', 'db_host', 'db_port', 'db_name',
  'db_user', 'db_password', 'db_pass',
  'connection', 'connectionstring', 'connection_string', 'conn', 'connstr',
  'dsn', 'pdo', 'odbc',
  
  // === JWT и сессии ===
  'jwt', 'jwt_secret', 'jwt_key', 'jwt_token', 'jwt_payload',
  'session', 'session_secret', 'session_key', 'session_token',
  'csrf', 'csrf_token', 'xsrf_token',
  'cookie', 'cookie_secret', 'cookie_key', 'cookie_token',
  
  // === OTP и 2FA ===
  'otp', 'otp_secret', 'totp', 'totp_secret', 'hotp', 'hotp_secret',
  'mfa', 'mfa_secret', '2fa', '2fa_secret', 'tfa', 'tfa_secret',
  'authenticator', 'google_auth', 'authy',
  
  // === Сети и хосты (если содержат credentials) ===
  'host', 'hostname', 'server', 'domain',
  'ip', 'address', 'socket',
  'ssh', 'ssh_key', 'ssh_private', 'ssh_public',
  'ftp', 'ftps', 'sftp', 'ftp_user', 'ftp_password',
  'smb', 'cifs', 'nfs',
  'ldap', 'ldaps', 'ldap_user', 'ldap_password',
  
  // === Docker и Kubernetes ===
  'docker', 'dockerhub', 'docker_registry',
  'k8s', 'kubernetes', 'kubeconfig',
  'registry', 'registry_user', 'registry_password',
  'image', 'container', 'repository',
  
  // === CI/CD ===
  'jenkins', 'jenkins_user', 'jenkins_token',
  'travis', 'travis_token',
  'circleci', 'circleci_token',
  'github_actions', 'gitlab_ci',
  
  // === Мониторинг и логи ===
  'log', 'logging', 'logger',
  'sentry', 'sentry_dsn', 'sentry_key',
  'datadog', 'datadog_key', 'datadog_token',
  'newrelic', 'newrelic_key', 'newrelic_license',
  'grafana', 'grafana_key', 'grafana_token',
  'prometheus', 'prometheus_key',
  
  // === Платежи ===
  'payment', 'paypal', 'stripe', 'braintree',
  'merchant', 'merchant_id', 'merchant_key',
  'gateway', 'gateway_key', 'gateway_secret',
  'payout', 'payout_key',
  
  // === Email ===
  'smtp', 'smtp_user', 'smtp_password', 'smtp_host', 'smtp_port',
  'imap', 'imap_user', 'imap_password',
  'pop3', 'pop3_user', 'pop3_password',
  'mail', 'mailer', 'mail_from', 'mail_to',
  
  // === SMS и уведомления ===
  'sms', 'sms_key', 'sms_token',
  'push', 'push_key', 'push_token',
  'notification', 'notify',
  
  // === Разное ===
  'key', 'keys',
  'code', 'codes',
  'pin', 'pins',
  'phrase', 'passphrase',
  'combined', 'combo',
  'raw', 'raw_data',
  'config', 'configuration',
  'setting', 'settings',
  'option', 'options',
  'param', 'params', 'parameter', 'parameters',
  'var', 'vars', 'variable', 'variables',
  'env', 'environment',
  'global', 'globals',
  'system', 'sys',
  'app', 'application',
  'service', 'services',
  'endpoint', 'endpoints',
  'route', 'routes',
  'path', 'paths',
  'dir', 'directory',
  'file', 'files',
  'cache', 'caching',
  'queue', 'queues',
  'job', 'jobs',
  'task', 'tasks',
  'worker', 'workers',
  'cron', 'schedule',
  'webhook', 'webhooks',
  'hook', 'hooks',
  'event', 'events',
  'callback', 'callbacks',
  'listener', 'listeners',
  'middleware', 'middlewares',
  'filter', 'filters',
  'interceptor', 'interceptors',
  'adapter', 'adapters',
  'provider', 'providers',
  'factory', 'factories',
  'strategy', 'strategies',
  'policy', 'policies',
  'rule', 'rules',
  'constraint', 'constraints',
  'validator', 'validators',
  'sanitizer', 'sanitizers',
  'transformer', 'transformers',
  'serializer', 'serializers',
  'parser', 'parsers',
  'generator', 'generators',
  'builder', 'builders',
  'loader', 'loaders',
  'dumper', 'dumpers',
  'exporter', 'exporters',
  'importer', 'importers',
  'converter', 'converters',
  'mapper', 'mappers',
  'hydrator', 'hydrators',
  'extractor', 'extractors'
];

export const fileRules: FileRule[] = [
  // Правило для JSON файлов
  {
    extensions: ['.json'],
    parse: JSON.parse,
    stringify: (obj: any) => JSON.stringify(obj, null, 2),
    patternBased: true,
    allowCustomKeys: true,
    sensitiveKeys: COMMON_SENSITIVE_KEYS
  },

  // Правило для .env файлов
  {
    extensions: [
      '.env',
      '.env.local',
      '.env.development',
      '.env.production',
      '.env.test',
      '.env.example',
      '.env.sample'
    ],
    parse: (text: string) => {
      const lines = text.split('\n');
      return lines.map(line => {
        const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)$/);
        if (match) {
          return {
            type: 'pair',
            key: match[1],
            value: match[2].replace(/^['"]|['"]$/g, '')
          };
        }
        return { type: 'raw', value: line };
      });
    },
    stringify: (arr: any[]) => {
      return arr.map(item => {
        if (item.type === 'pair') {
          let value = item.value;
          if (value.includes(' ') || value.includes('"') || value.includes("'") || value.includes('=')) {
            value = value.replace(/"/g, '\\"');
            value = `"${value}"`;
          }
          return `${item.key}=${value}`;
        }
        return item.value;
      }).join('\n');
    },
    patternBased: true,
    allowCustomKeys: true,
    sensitiveKeys: COMMON_SENSITIVE_KEYS.map(key => key.toUpperCase())
  },

  // Правило для текстовых файлов
  {
    extensions: ['.txt', '.cfg', '.conf', '.config', '.ini', '.properties'],
    parse: (text: string) => {
      const lines = text.split('\n');
      return lines.map(line => {
        const match = line.match(/^\s*([\w_]+)\s*[=:]\s*(.*)$/);
        if (match) {
          return {
            type: 'pair',
            key: match[1],
            value: match[2].replace(/^['"]|['"]$/g, '')
          };
        }
        return { type: 'raw', value: line };
      });
    },
    stringify: (arr: any[]) => {
      return arr.map(item => {
        if (item.type === 'pair') {
          return `${item.key}=${item.value}`;
        }
        return item.value;
      }).join('\n');
    },
    patternBased: true,
    allowCustomKeys: true,
    sensitiveKeys: COMMON_SENSITIVE_KEYS
  }
];

// Вспомогательная функция для проверки, нужно ли шифровать ключ
export function shouldEncryptKey(key: string, rule: FileRule): boolean {
  const keyLower = key.toLowerCase();
  
  // Проверяем точное совпадение
  if (rule.sensitiveKeys.some(k => k.toLowerCase() === keyLower)) {
    return true;
  }
  
  // Если разрешен паттерн-матчинг, проверяем вхождение
  if (rule.patternBased) {
    return rule.sensitiveKeys.some(k => 
      keyLower.includes(k.toLowerCase()) || 
      k.toLowerCase().includes(keyLower)
    );
  }
  
  return false;
}