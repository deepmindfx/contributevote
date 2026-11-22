export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_REQUIREMENTS_MESSAGE = "Use at least 10 characters. Numbers alone are fine.";

function isSequence(value: string, alphabet: string) {
  if (!Array.from(value).every((character) => alphabet.includes(character))) return false;
  const repeatedAlphabet = alphabet.repeat(Math.ceil(value.length / alphabet.length) + 1);
  return repeatedAlphabet.includes(value) || repeatedAlphabet.includes(Array.from(value).reverse().join(""));
}

export function passwordIssue(password: string): string | undefined {
  if (password.length < PASSWORD_MIN_LENGTH) return PASSWORD_REQUIREMENTS_MESSAGE;
  if (new TextEncoder().encode(password).length > 72) return "Choose a shorter password.";

  const normalized = password.normalize("NFKC").toLowerCase();
  const compact = normalized.replace(/[\s.,!@#$%^&*()+_-]/g, "");
  const repeated = Array.from({ length: Math.min(Math.floor(compact.length / 2), 5) }, (_, index) => index + 1)
    .some((size) => Array.from(compact).every((character, index) => character === compact[index % size]));
  const common = /^(?:password|passw0rd|qwerty|qwertyuiop|letmein|admin|administrator|welcome|collectipay|iloveyou|changeme|default|3141592653|1597534862)\d*$/.test(compact);
  if (!compact || repeated || common || isSequence(compact, "0123456789") || isSequence(compact, "abcdefghijklmnopqrstuvwxyz")) {
    return "Try a less predictable password. Avoid sequences, repeats, and common words.";
  }
}

export function meetsPasswordRequirements(password: string) {
  return !passwordIssue(password);
}
