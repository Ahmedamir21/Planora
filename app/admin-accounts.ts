/** Public account labels. Edit usernames here; keep password hashes in private Vercel settings. */
export const ADMIN_ACCOUNTS = [
  { id: 'ahmed', username: 'ahmed', name: 'Ahmed Amir', passwordHashEnv: 'PLANORA_ADMIN_AHMED_PASSWORD_HASH' },
  { id: 'youssef', username: 'youssef', name: 'Youssef Taha', passwordHashEnv: 'PLANORA_ADMIN_YOUSSEF_PASSWORD_HASH' },
] as const;
