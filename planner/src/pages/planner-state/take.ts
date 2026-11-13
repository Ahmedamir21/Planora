// Picks some fields from a type (named Take because "Pick" already means a chosen course section in this app).
export type Take<T, K extends keyof T> = { [P in K]: T[P] };
