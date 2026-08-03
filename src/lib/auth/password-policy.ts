/** Client + server password policy for Cyber Alert accounts. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export type PasswordCheck = {
  ok: boolean;
  score: 0 | 1 | 2 | 3;
  hints: string[];
  message?: string;
};

export function checkPasswordStrength(password: string): PasswordCheck {
  const hints: string[] = [];
  if (password.length < PASSWORD_MIN) hints.push(`Au moins ${PASSWORD_MIN} caractères`);
  if (password.length > PASSWORD_MAX) hints.push("Mot de passe trop long");
  if (!/[A-Za-z]/.test(password)) hints.push("Au moins une lettre");
  if (!/[0-9]/.test(password)) hints.push("Au moins un chiffre");

  let score = 0 as PasswordCheck["score"];
  if (password.length >= PASSWORD_MIN) score = 1;
  if (password.length >= PASSWORD_MIN && /[A-Za-z]/.test(password) && /[0-9]/.test(password)) {
    score = 2;
  }
  if (
    score === 2 &&
    password.length >= 12 &&
    (/[^A-Za-z0-9]/.test(password) || (/[A-Z]/.test(password) && /[a-z]/.test(password)))
  ) {
    score = 3;
  }

  const ok = hints.length === 0;
  return {
    ok,
    score,
    hints,
    message: ok ? undefined : hints[0],
  };
}

export function passwordSchemaRefine(password: string): boolean {
  return checkPasswordStrength(password).ok;
}
