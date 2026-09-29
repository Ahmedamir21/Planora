import { redis, liveKey, HISTORY_KEY } from './admin-store';

export const SYNC_DRAFT_KEY = 'planora:sync:draft:v1';
export const SYNC_STATUS_KEY = 'planora:sync:status:v1';
export const SYNC_BACKUPS_KEY = 'planora:sync:backups:v1';
export const syncBackupKey = (version: string) => `planora:sync:backup:v1:${version}`;

const STAGE = `local previous = redis.call('GET', KEYS[1]) or ''
if previous ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], ARGV[3])
redis.call('LPUSH', KEYS[3], ARGV[4])
return 1`;
export function stageSyncDraft(expected: string, content: string, status: string, history: string) {
  return redis(['EVAL', STAGE, 3, SYNC_DRAFT_KEY, SYNC_STATUS_KEY, HISTORY_KEY, expected, content, status, history]);
}

const DISCARD = `local previous = redis.call('GET', KEYS[1]) or ''
if previous ~= ARGV[1] then return 0 end
redis.call('DEL', KEYS[1])
redis.call('SET', KEYS[2], ARGV[2])
redis.call('LPUSH', KEYS[3], ARGV[3])
return 1`;
export function discardSyncDraft(expected: string, status: string, history: string) {
  return redis(['EVAL', DISCARD, 3, SYNC_DRAFT_KEY, SYNC_STATUS_KEY, HISTORY_KEY, expected, status, history]);
}

const PUBLISH = `local draft = redis.call('GET', KEYS[1]) or ''
local courses = redis.call('GET', KEYS[2]) or ''
local sch = redis.call('GET', KEYS[3]) or ''
if draft ~= ARGV[1] or courses ~= ARGV[2] or sch ~= ARGV[3] then return 0 end
redis.call('SET', KEYS[4], ARGV[4])
redis.call('LPUSH', KEYS[5], ARGV[5])
redis.call('LTRIM', KEYS[5], 0, 49)
redis.call('SET', KEYS[2], ARGV[6])
redis.call('SET', KEYS[3], ARGV[7])
redis.call('DEL', KEYS[1])
redis.call('SET', KEYS[6], ARGV[8])
redis.call('LPUSH', KEYS[7], ARGV[9])
return 1`;
export function publishSyncDraft(args: {
  expectedDraft: string; expectedCoursesOverride: string; expectedSchOverride: string;
  backupKey: string; backup: string; version: string; courses: string; sch: string; status: string; history: string;
}) {
  return redis(['EVAL', PUBLISH, 7, SYNC_DRAFT_KEY, liveKey('courses.json'), liveKey('sch.json'), args.backupKey, SYNC_BACKUPS_KEY, SYNC_STATUS_KEY, HISTORY_KEY,
    args.expectedDraft, args.expectedCoursesOverride, args.expectedSchOverride, args.backup, args.version, args.courses, args.sch, args.status, args.history]);
}

const RESTORE = `local courses = redis.call('GET', KEYS[1]) or ''
local sch = redis.call('GET', KEYS[2]) or ''
if courses ~= ARGV[1] or sch ~= ARGV[2] then return 0 end
redis.call('SET', KEYS[1], ARGV[3])
redis.call('SET', KEYS[2], ARGV[4])
redis.call('SET', KEYS[3], ARGV[5])
redis.call('LPUSH', KEYS[4], ARGV[6])
return 1`;
export function restoreSyncBackup(args: {
  expectedCoursesOverride: string; expectedSchOverride: string; courses: string; sch: string; status: string; history: string;
}) {
  return redis(['EVAL', RESTORE, 4, liveKey('courses.json'), liveKey('sch.json'), SYNC_STATUS_KEY, HISTORY_KEY,
    args.expectedCoursesOverride, args.expectedSchOverride, args.courses, args.sch, args.status, args.history]);
}
