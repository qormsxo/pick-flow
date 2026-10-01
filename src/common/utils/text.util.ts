/** exact cache 키용. 공백/대소문자만 접고, 의미는 바꾸지 않는다. */
export function normalizeQuestion(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}
