import type { FC } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkBreaks from 'remark-breaks';

const ALLOWED_ELEMENTS = ['p', 'strong', 'em', 'ul', 'ol', 'li', 'br', 'code'];

const COMPONENTS: Components = {
  p: ({ node: _node, ...props }) => <p className="mb-3 last:mb-0" {...props} />,
  ul: ({ node: _node, ...props }) => (
    <ul className="list-disc list-inside leading-none" {...props} />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol className="list-decimal list-inside leading-none" {...props} />
  ),
  code: ({ node: _node, ...props }) => (
    <code className="bg-black/30 rounded !px-1 font-mono" {...props} />
  ),
};

interface MarkdownTextProps {
  text: string;
  className?: string;
}

export const MarkdownText: FC<MarkdownTextProps> = ({ text, className }) => {
  if (!text) {
    return null;
  }

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkBreaks]}
        allowedElements={ALLOWED_ELEMENTS}
        unwrapDisallowed
        components={COMPONENTS}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
};
