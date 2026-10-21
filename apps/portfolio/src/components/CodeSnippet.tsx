import { useCallback, useMemo, useState } from 'react';

/**
 * A code snippet, with the highlighting done here.
 *
 * A syntax highlighter is a dependency, and this site does not need one: it
 * shows a handful of short snippets, and a small tokenizer that understands
 * strings, comments, numbers and keywords is enough — and it is a few
 * dozen lines instead of a few hundred kilobytes.
 *
 * The code is REAL. It is the implementation, copied from the repository, so
 * a reader can compare it with the source and find it identical.
 */

interface Props {
  code: string;
  language?: string;
  /** The file the snippet came from, shown in the corner. */
  file?: string;
  className?: string;
}

type TokenKind = 'plain' | 'comment' | 'string' | 'number' | 'keyword' | 'punctuation';

interface Token {
  kind: TokenKind;
  value: string;
}

const KEYWORDS = new Set([
  'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
  'default', 'delete', 'do', 'else', 'export', 'extends', 'false', 'finally',
  'for', 'from', 'function', 'if', 'import', 'in', 'instanceof', 'let', 'new',
  'null', 'of', 'return', 'static', 'super', 'switch', 'this', 'throw', 'true',
  'try', 'typeof', 'undefined', 'var', 'void', 'while', 'yield',
  'select', 'from', 'where', 'and', 'or', 'not', 'null', 'is', 'as', 'update',
  'set', 'returning', 'insert', 'values', 'into', 'with', 'on', 'conflict',
  'do', 'nothing', 'order', 'by', 'limit', 'offset',
]);

/**
 * Splits the source into tokens.
 *
 * It is a single pass with a regular expression, and the order of the
 * alternatives matters: a comment is matched before everything else, so a
 * `#` inside a string is not mistaken for one.
 */
const tokenize = (source: string): Token[] => {
  const pattern =
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|--[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d[\w.]*\b)|([A-Za-z_$][\w$]*)|([{}()[\].,;:?!<>=+\-*/%|&]+)/g;

  const tokens: Token[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    if (match.index > last) {
      tokens.push({ kind: 'plain', value: source.slice(last, match.index) });
    }
    if (match[1]) tokens.push({ kind: 'comment', value: match[1] });
    else if (match[2]) tokens.push({ kind: 'string', value: match[2] });
    else if (match[3]) tokens.push({ kind: 'number', value: match[3] });
    else if (match[4]) {
      tokens.push({
        kind: KEYWORDS.has(match[4].toLowerCase()) ? 'keyword' : 'plain',
        value: match[4],
      });
    } else if (match[5]) tokens.push({ kind: 'punctuation', value: match[5] });
    last = match.index + match[0].length;
  }

  if (last < source.length) {
    tokens.push({ kind: 'plain', value: source.slice(last) });
  }
  return tokens;
};

const TOKEN_CLASS: Record<TokenKind, string> = {
  plain: 'text-text-muted',
  comment: 'text-text-subtle italic',
  string: 'text-success',
  number: 'text-warning',
  keyword: 'text-accent',
  punctuation: 'text-text-subtle',
};

export default function CodeSnippet({ code, language = 'ts', file, className = '' }: Props) {
  const [copied, setCopied] = useState(false);

  const tokens = useMemo(() => tokenize(code), [code]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1_600);
    } catch {
      // The clipboard can be refused. The code is on screen to copy by hand.
    }
  }, [code]);

  return (
    <figure className={`overflow-hidden rounded-xl border border-border bg-bg ${className}`}>
      <figcaption className="flex items-center justify-between gap-3 border-b border-border bg-surface px-3 py-2">
        <span className="font-mono text-[11px] text-text-subtle">
          {file ?? language}
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded px-1.5 py-0.5 font-mono text-[11px] text-text-subtle transition-colors hover:bg-surface-elevated hover:text-text"
        >
          {copied ? 'copied' : 'copy'}
        </button>
      </figcaption>

      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed">
        <code>
          {tokens.map((token, index) => (
            <span key={index} className={TOKEN_CLASS[token.kind]}>
              {token.value}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}
