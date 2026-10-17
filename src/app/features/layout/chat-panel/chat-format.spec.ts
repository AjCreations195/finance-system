import { formatChatText } from './chat-format';

describe('formatChatText', () => {
  it('splits paragraphs on blank lines and keeps single line breaks', () => {
    expect(formatChatText('First line\nsame paragraph\n\nSecond')).toEqual([
      { kind: 'paragraph', content: [{ kind: 'text', text: 'First line\nsame paragraph' }] },
      { kind: 'paragraph', content: [{ kind: 'text', text: 'Second' }] },
    ]);
  });

  it('turns "-" and "•" lines into a bullet list, even with blank lines between items', () => {
    expect(formatChatText('Pending:\n- One\n\n• Two')).toEqual([
      { kind: 'paragraph', content: [{ kind: 'text', text: 'Pending:' }] },
      {
        kind: 'list',
        ordered: false,
        start: 1,
        items: [[{ kind: 'text', text: 'One' }], [{ kind: 'text', text: 'Two' }]],
      },
    ]);
  });

  it('turns "1." lines into a numbered list that keeps its first number', () => {
    const [list] = formatChatText('3. Third\n4) Fourth');
    expect(list).toEqual({
      kind: 'list',
      ordered: true,
      start: 3,
      items: [[{ kind: 'text', text: 'Third' }], [{ kind: 'text', text: 'Fourth' }]],
    });
  });

  it('starts a new list when the list type changes', () => {
    expect(formatChatText('- a\n1. b').map((b) => b.kind === 'list' && b.ordered)).toEqual([false, true]);
  });

  it('marks **bold** text and leaves an unfinished one as typed', () => {
    expect(formatChatText('Total **125,000 QAR** so **far').at(0)).toEqual({
      kind: 'paragraph',
      content: [
        { kind: 'text', text: 'Total ' },
        { kind: 'bold', text: '125,000 QAR' },
        { kind: 'text', text: ' so **far' },
      ],
    });
  });

  it('picks out request numbers, also inside bold text and list items', () => {
    const [paragraph, list] = formatChatText('See BDRS/2016/019/0042 and **BDRS/2016/019/0043.**\n- BDRS/2016/019/0008 (late)');
    expect(paragraph).toEqual({
      kind: 'paragraph',
      content: [
        { kind: 'text', text: 'See ' },
        { kind: 'request', number: 'BDRS/2016/019/0042' },
        { kind: 'text', text: ' and ' },
        { kind: 'request', number: 'BDRS/2016/019/0043' },
        { kind: 'bold', text: '.' },
      ],
    });
    expect(list.kind === 'list' && list.items[0]).toEqual([
      { kind: 'request', number: 'BDRS/2016/019/0008' },
      { kind: 'text', text: ' (late)' },
    ]);
  });

  it('keeps markup-like text as plain text', () => {
    expect(formatChatText('<img src=x onerror=alert(1)>')).toEqual([
      { kind: 'paragraph', content: [{ kind: 'text', text: '<img src=x onerror=alert(1)>' }] },
    ]);
  });

  it('returns nothing for empty text', () => {
    expect(formatChatText('')).toEqual([]);
  });
});
