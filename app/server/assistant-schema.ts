export const ASSISTANT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    constraintsAdd: { type: 'array', items: { type: 'string' } },
    lockActions: {
      type: 'array', items: { type: 'object', properties: {
        action: { type: 'string' }, courseId: { type: 'string' }, meetingType: { type: 'string' },
      }, required: ['action', 'courseId'] },
    },
    proposal: {
      type: ['object', 'null'],
      properties: {
        title: { type: 'string' }, summary: { type: 'string' },
        changes: { type: 'array', items: { type: 'object', properties: {
          type: { type: 'string' }, courseId: { type: 'string' },
          meetingType: { type: 'string' }, meetingId: { type: 'string' },
          label: { type: 'string' }, reason: { type: 'string' },
        }, required: ['type', 'courseId'] } },
      }, required: ['title', 'summary', 'changes'],
    },
  },
  required: ['text', 'constraintsAdd', 'lockActions', 'proposal'],
};
