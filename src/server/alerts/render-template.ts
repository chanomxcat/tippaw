import { formatThb } from "@/server/lib/money";

/**
 * Renders an alert message template, substituting `{name}`, `{amount}`
 * (formatted via `formatThb`), and `{message}`. Any other `{...}` placeholder
 * is left untouched. The result is a plain string — never escaped, since the
 * overlay always renders it as a text node, not HTML.
 */
export function renderTemplate(
  template: string,
  vars: { name: string; amountSatang: number; message: string },
): string {
  return template.replace(/\{name\}|\{amount\}|\{message\}/g, (match) => {
    switch (match) {
      case "{name}":
        return vars.name;
      case "{amount}":
        return formatThb(vars.amountSatang);
      case "{message}":
        return vars.message;
      default:
        return match;
    }
  });
}
