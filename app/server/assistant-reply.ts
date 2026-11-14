// Cleans what the model returned so the planner only gets safe, known shapes.
export function cleanReply(parsed: any, message: string) {
  let replyText = typeof parsed?.text === 'string' && parsed.text.trim()
    ? parsed.text.trim().slice(0, 2400)
    : 'I found a possible schedule change.';

  const allowedKinds = new Set(['Lecture', 'Lab', 'Tutorial']);
  const allowedTypes = new Set(['set_meeting', 'add_course', 'remove_course']);
  let proposal = null;

  if (parsed?.proposal && Array.isArray(parsed.proposal.changes)) {
    const changes = parsed.proposal.changes
      .slice(0, 8)
      .filter((change: any) => change && allowedTypes.has(change.type) && typeof change.courseId === 'string')
      .map((change: any) => {
        if (change.type === 'set_meeting') {
          if (!allowedKinds.has(change.meetingType) || typeof change.meetingId !== 'string') return null;
          return {
            type: 'set_meeting',
            courseId: change.courseId,
            meetingType: change.meetingType,
            meetingId: change.meetingId,
            label: typeof change.label === 'string' ? change.label.slice(0, 140) : undefined,
            reason: typeof change.reason === 'string' ? change.reason.slice(0, 220) : undefined,
          };
        }

        return {
          type: change.type,
          courseId: change.courseId,
          label: typeof change.label === 'string' ? change.label.slice(0, 140) : undefined,
          reason: typeof change.reason === 'string' ? change.reason.slice(0, 220) : undefined,
        };
      })
      .filter(Boolean);

    if (changes.length > 0) {
      proposal = {
        title: typeof parsed.proposal.title === 'string' ? parsed.proposal.title.slice(0, 120) : 'Suggested changes',
        summary: typeof parsed.proposal.summary === 'string' ? parsed.proposal.summary.slice(0, 300) : '',
        changes,
      };
    }
  }

  // A model can describe a preview without returning an actionable proposal.
  // Keep the visible reply consistent with what the UI can actually show.
  if (!proposal && /\b(?:here(?:'s| is) (?:the|a) preview|preview to (?:change|switch)|(?:have|has) (?:changed|switched)|(?:changed|switched) (?:the|your))\b/i.test(replyText)) {
    replyText = /[\u0600-\u06ff]/.test(message)
      ? 'مقدرتش أجهّز معاينة صالحة للتغيير ده. اتأكد إن المادة والسكشن الحالي مختارين، واكتب السكشن المطلوب تاني.'
      : /\b(?:leh|feen|fen|msh|mesh|3ayez|8ayyar)\b|[237589](?=[a-z])/i.test(message)
        ? 'Ma2dertsh a3mel preview sa7 lel taghyeer da. Et2akked en el course wel sec el 7alya selected, w ektb el sec el matlooba tany.'
        : 'I could not create a valid preview for that change. Check that the course and current section are selected, then specify the target section again.';
  }

  const constraintsAdd = Array.isArray(parsed?.constraintsAdd)
    ? parsed.constraintsAdd
        .filter((x: any) => typeof x === 'string' && x.trim())
        .map((x: string) => x.trim().slice(0, 80))
        .slice(0, 4)
    : [];

  const allowedLockActions = new Set(['lock_course', 'unlock_course', 'lock_component', 'unlock_component']);
  const namedKinds = [
    /\b(?:lecture|lec)\b|محاضر/i.test(message) ? 'Lecture' : null,
    /\blab\b|\blabs\b|لاب|معمل/i.test(message) ? 'Lab' : null,
    /\b(?:tutorial|tut)\b|سكشن|تمرين/i.test(message) ? 'Tutorial' : null,
  ].filter(Boolean);
  const singleRequestedKind = namedKinds.length === 1 && !/\b(?:all|whole|entire|everything)\b|كل\s+(?:المادة|الماده)/i.test(message)
    ? namedKinds[0] : null;
  const lockActions = Array.isArray(parsed?.lockActions)
    ? parsed.lockActions
        .filter((x: any) => x && allowedLockActions.has(x.action) && typeof x.courseId === 'string')
        .map((x: any) => ({
          action: singleRequestedKind && (x.action === 'lock_course' || x.action === 'unlock_course')
            ? x.action.replace('_course', '_component') : x.action,
          courseId: x.courseId.slice(0, 80),
          meetingType: singleRequestedKind && (x.action === 'lock_course' || x.action === 'unlock_course')
            ? singleRequestedKind : allowedKinds.has(x.meetingType) ? x.meetingType : undefined,
        }))
        .filter((x: any) => !x.action.includes('component') || x.meetingType)
        .slice(0, 6)
    : [];
  return { text: replyText, proposal, constraintsAdd, lockActions };
}
