import { redis, HISTORY_KEY } from '../api/admin-store';
import { FEEDBACK_DATA } from '../api/feedback';
import { REPORTS_DATA } from '../api/reports';
import { event } from './admin-events';
import { NOT_HANDLED, type Admin } from './admin-types';

const UPDATE_REPORT = `local old = redis.call('HGET', KEYS[1], ARGV[1])
if not old or old ~= ARGV[2] then return 0 end
redis.call('HSET', KEYS[1], ARGV[1], ARGV[3])
redis.call('LPUSH', KEYS[2], ARGV[4])
return 1`;

// Inbox actions: review a feedback item or a course data report.
export async function handleReview(body: any, admin: Admin, res: any) {
  if (body.action === 'review_feedback') {
    if (typeof body.id !== 'string' || !/^[\da-f-]{36}$/i.test(body.id) || !['reviewed', 'archived', 'new'].includes(body.status) || typeof body.note !== 'string' || !body.note.trim() || body.note.length > 500) return res.status(400).json({ error: 'Choose a status and add a review note.' });
    const previous = await redis(['HGET', FEEDBACK_DATA, body.id]);
    if (!previous) return res.status(404).json({ error: 'Feedback not found.' });
    const item = JSON.parse(previous);
    const updated = { ...item, status: body.status, note: body.note.trim(), reviewedAt: new Date().toISOString(), reviewedBy: admin.name };
    const record = event(admin, 'review_feedback', { feedbackId: body.id, category: item.category, status: body.status, note: body.note.trim() });
    const result = await redis(['EVAL', UPDATE_REPORT, 2, FEEDBACK_DATA, HISTORY_KEY, body.id, previous, JSON.stringify(updated), record]);
    if (result !== 1) return res.status(409).json({ error: 'Someone else updated this feedback. Refresh the inbox.' });
    return res.status(200).json({ item: updated });
  }
  if (body.action === 'review_report') {
    if (typeof body.id !== 'string' || !/^[\da-f-]{36}$/i.test(body.id) || !['checking', 'dismissed', 'correction_needed', 'resolved'].includes(body.status) || typeof body.note !== 'string' || !body.note.trim() || body.note.length > 500) return res.status(400).json({ error: 'Choose a status and add a review note.' });
    const previous = await redis(['HGET', REPORTS_DATA, body.id]);
    if (!previous) return res.status(404).json({ error: 'Report not found.' });
    const report = JSON.parse(previous);
    const updated = { ...report, status: body.status, note: body.note.trim(), reviewedAt: new Date().toISOString(), reviewedBy: admin.name };
    const log = event(admin, 'review_report', { reportId: body.id, status: body.status, note: body.note.trim() });
    const result = await redis(['EVAL', UPDATE_REPORT, 2, REPORTS_DATA, HISTORY_KEY, body.id, previous, JSON.stringify(updated), log]);
    if (result !== 1) return res.status(409).json({ error: 'Someone else updated this report. Refresh the inbox.' });
    return res.status(200).json({ report: updated });
  }
  return NOT_HANDLED;
}
