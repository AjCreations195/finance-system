import { Pipe, PipeTransform } from '@angular/core';

/** A run of text inside a paragraph or list item. */
export type ChatInline = { kind: 'text'; text: string } | { kind: 'bold'; text: string } | { kind: 'request'; number: string };

export type ChatBlock =
  | { kind: 'paragraph'; content: ChatInline[] }
  | { kind: 'list'; ordered: boolean; start: number; items: ChatInline[][] };

const BULLET = /^\s*[-•*]\s+(.*)$/;
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/;
const BOLD = /\*\*(.+?)\*\*/g;
/** Purchase request numbers, e.g. BDRS/2016/019/0042. */
const REQUEST_NUMBER = /BDRS\/\d{4}\/\d{3}\/\d{4}/g;

/**
 * Splits an assistant reply into the little formatting the chat supports:
 * paragraphs (blank-line separated), "-" and "1." lists, **bold**, and
 * request numbers (which the panel shows as links). Everything else stays
 * plain text, and the result is rendered with Angular templates, never as
 * HTML, so a reply can't inject markup.
 *
 * Works on partial text too, so a reply is formatted while it streams in;
 * an unfinished **bold** shows its asterisks until it closes.
 */
export function formatChatText(text: string): ChatBlock[] {
  const blocks: ChatBlock[] = [];
  let paragraph: string[] = [];
  const endParagraph = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', content: parseInline(paragraph.join('\n')) });
    paragraph = [];
  };

  for (const line of text.split('\n')) {
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    if (bullet || numbered) {
      endParagraph();
      const ordered = !!numbered;
      const item = parseInline(bullet ? bullet[1] : numbered![2]);
      const last = blocks.at(-1);
      if (last?.kind === 'list' && last.ordered === ordered) last.items.push(item);
      else blocks.push({ kind: 'list', ordered, start: numbered ? Number(numbered[1]) : 1, items: [item] });
    } else if (line.trim()) {
      paragraph.push(line);
    } else {
      endParagraph();
    }
  }
  endParagraph();
  return blocks;
}

function parseInline(text: string): ChatInline[] {
  const out: ChatInline[] = [];
  // split() with a capture group puts the bold parts at the odd indexes.
  text.split(BOLD).forEach((part, i) => {
    const kind = i % 2 ? 'bold' : 'text';
    let from = 0;
    for (const match of part.matchAll(REQUEST_NUMBER)) {
      if (match.index > from) out.push({ kind, text: part.slice(from, match.index) });
      out.push({ kind: 'request', number: match[0] });
      from = match.index + match[0].length;
    }
    if (from < part.length) out.push({ kind, text: part.slice(from) });
  });
  return out;
}

/** `reply.text | chatFormat`: pure, so a reply is parsed again only when its text changes. */
@Pipe({ name: 'chatFormat' })
export class ChatFormatPipe implements PipeTransform {
  transform(text: string): ChatBlock[] {
    return formatChatText(text);
  }
}
