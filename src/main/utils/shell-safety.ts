/** Ends a quoted run, or is a control character. */
const QUOTE_OR_CONTROL = /["\r\n\t\0]/;

/** `%NAME%`, which cmd.exe expands to an environment variable. */
const CMD_VARIABLE_EXPANSION = /%[A-Za-z_][A-Za-z0-9_]*%/;

/**
 * Whether a path is safe inside double quotes on a `cmd.exe` command line.
 *
 * A `.bat` can't be spawned without a shell, so its path is interpolated into a
 * command string. Inside quotes cmd.exe takes everything literally except `"`
 * and `%NAME%` — and its parser ignores the CRT quoting rules Node escapes by,
 * so this rejects instead of escaping. Narrow on purpose: `&`, `|` and `()` are
 * literal there, and folders really are named `Українізатор (бета)`.
 */
export function isCmdSafePath(fullPath: string): boolean {
  return !QUOTE_OR_CONTROL.test(fullPath) && !CMD_VARIABLE_EXPANSION.test(fullPath);
}
