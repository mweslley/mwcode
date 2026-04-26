/**
 * Renderizador de markdown simples sem dependência externa.
 * Suporta: headers, bold, italic, code blocks, inline code, links, listas.
 */

import { useState } from 'react';

interface Props {
  content: string;
}

export function MessageRenderer({ content }: Props) {
  const blocks = parseBlocks(content);
  return <div className="msg-content">{blocks.map((b, i) => renderBlock(b, i))}</div>;
}

type Block =
  | { type: 'code'; lang: string; code: string }
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: number; text: string }
  | { type: 'list'; ordered: boolean; items: string[] };

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'code', lang, code: codeLines.join('\n') });
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2] });
      i++;
      continue;
    }

    // Unordered list
    if (line.match(/^[-*]\s+/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*]\s+/)) {
        items.push(lines[i].replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }

    // Ordered list
    if (line.match(/^\d+\.\s+/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'list', ordered: true, items });
      continue;
    }

    // Empty line — skip
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph — collect consecutive non-special lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('```') &&
      !lines[i].match(/^#{1,3}\s/) &&
      !lines[i].match(/^[-*]\s/) &&
      !lines[i].match(/^\d+\.\s/)
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', text: paraLines.join('\n') });
    }
  }

  return blocks;
}

function renderBlock(block: Block, key: number) {
  switch (block.type) {
    case 'code':
      return <CodeBlock key={key} lang={block.lang} code={block.code} />;
    case 'heading':
      const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3';
      return <Tag key={key} dangerouslySetInnerHTML={{ __html: renderInline(block.text) }} />;
    case 'list':
      const ListTag = block.ordered ? 'ol' : 'ul';
      return (
        <ListTag key={key}>
          {block.items.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
          ))}
        </ListTag>
      );
    case 'paragraph':
      return (
        <p key={key} dangerouslySetInnerHTML={{ __html: renderInline(block.text) }} />
      );
  }
}

/** Renderiza inline markdown: bold, italic, inline code, links */
function renderInline(text: string): string {
  return text
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    // Line breaks
    .replace(/\n/g, '<br>');
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span>{lang || 'código'}</span>
        <button
          onClick={copy}
          style={{
            background: 'none',
            border: 'none',
            padding: '2px 8px',
            fontSize: 11,
            cursor: 'pointer',
            color: copied ? '#34d399' : 'var(--muted)',
            borderRadius: 4,
          }}
        >
          {copied ? '✓ Copiado' : 'Copiar'}
        </button>
      </div>
      <pre>{code}</pre>
    </div>
  );
}
