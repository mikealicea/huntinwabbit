import Markdown from 'react-markdown';

export function SafeMarkdown({ text }: { text: string }) {
  return (
    <div className="space-y-3 break-words text-sm leading-relaxed">
      <Markdown
        urlTransform={(url) => {
          try {
            const parsed = new URL(url);
            return ['http:', 'https:'].includes(parsed.protocol) &&
              !parsed.username &&
              !parsed.password
              ? parsed.href
              : '';
          } catch {
            return '';
          }
        }}
        components={{
          h1: ({ children }) => (
            <h4 className="mt-5 font-semibold">{children}</h4>
          ),
          h2: ({ children }) => (
            <h4 className="mt-5 font-semibold">{children}</h4>
          ),
          h3: ({ children }) => (
            <h5 className="mt-4 font-semibold">{children}</h5>
          ),
          h4: ({ children }) => (
            <h5 className="mt-4 font-semibold">{children}</h5>
          ),
          h5: ({ children }) => (
            <h6 className="mt-4 font-semibold">{children}</h6>
          ),
          h6: ({ children }) => (
            <h6 className="mt-4 font-semibold">{children}</h6>
          ),
          p: ({ children }) => (
            <p className="whitespace-pre-wrap">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1 pl-5">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="whitespace-pre-wrap">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="space-y-2 border-l-2 border-base-300 pl-4">
              {children}
            </blockquote>
          ),
          pre: ({ children }) => (
            <pre className="whitespace-pre-wrap rounded-lg bg-base-200 p-3">
              {children}
            </pre>
          ),
          img: ({ alt }) => (alt ? <span>{alt}</span> : null),
          a: ({ href, children }) =>
            href ? (
              <a
                href={href}
                className="link"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}{' '}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              <span>{children}</span>
            ),
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
