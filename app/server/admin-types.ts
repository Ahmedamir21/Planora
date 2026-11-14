export type Admin = { id: 'ahmed' | 'youssef'; username: string; name: string; hash: string };

// Returned by an action helper when the request is not one of its actions.
export const NOT_HANDLED = Symbol('not handled');
