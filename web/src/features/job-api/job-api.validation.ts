// Presentation-safe bounds shared with the wire schemas; no API or store dependencies.
export const UPDATE_TEXT_CHARACTERS = 100_000;
export const UPDATE_TEXT_BYTES = 256 * 1024;
export const INTERVIEW_STAGE_LIMIT = 20;
export const INTERVIEW_STAGE_NAME_LIMIT = 120;

export function validUpdateText(text: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= UPDATE_TEXT_CHARACTERS &&
    new TextEncoder().encode(trimmed).byteLength <= UPDATE_TEXT_BYTES
  );
}
