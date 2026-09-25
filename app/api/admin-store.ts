/** Private REST adapter. No browser code receives the Redis token. */
function connection() {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (upstashUrl && upstashToken) return { url: upstashUrl, token: upstashToken };
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  return kvUrl && kvToken ? { url: kvUrl, token: kvToken } : null;
}
export function storageConfigured() {
  const config = connection();
  return !!config && /^https:\/\//.test(config.url);
}

export async function redis(command: Array<string | number>): Promise<any> {
  const config = connection();
  if (!config || !/^https:\/\//.test(config.url)) throw new Error('Admin history storage is not configured.');
  const response = await fetch(config.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`History storage failed (${response.status}).`);
  const body = await response.json();
  if (body.error) throw new Error('History storage rejected the command.');
  return body.result;
}

export const HISTORY_KEY = 'planora:admin:history:v1';
export function draftKey(file: string) { return `planora:admin:draft:v1:${file}`; }

// Atomic compare-and-set. If the audit append fails, the draft write also fails.
const SAVE_WITH_HISTORY = `local previous = redis.call('GET', KEYS[1]) or ''
if previous ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('LPUSH', KEYS[2], ARGV[3])
return 1`;

export async function saveWithHistory(file: string, expected: string, content: string, record: string) {
  return redis(['EVAL', SAVE_WITH_HISTORY, 2, draftKey(file), HISTORY_KEY, expected, content, record]);
}
