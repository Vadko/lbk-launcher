import type { FC } from 'react';
import ReactMarkdown, { type Components, type Options } from 'react-markdown';
import remarkBreaks from 'remark-breaks';

const ALLOWED_ELEMENTS = ['p', 'strong', 'em', 'ul', 'ol', 'li', 'br', 'code'];

const REMARK_REHYPE_OPTIONS: Options['remarkRehypeOptions'] = {
  handlers: {
    heading(state, node) {
      return { type: 'element', tagName: 'p', properties: {}, children: state.all(node) };
    },
  },
};

const LIST_CLASS = 'list-outside pl-5 space-y-1 leading-snug';

const COMPONENTS: Components = {
  ul: ({ node: _node, ...props }) => (
    <ul className={`list-disc ${LIST_CLASS}`} {...props} />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol className={`list-decimal ${LIST_CLASS}`} {...props} />
  ),
  code: ({ node: _node, ...props }) => (
    <code
      className="bg-black/30 rounded !px-1 font-mono whitespace-pre-wrap"
      {...props}
    />
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
    <div className={className ? `space-y-3 ${className}` : 'space-y-3'}>
      <ReactMarkdown
        remarkPlugins={[remarkBreaks]}
        remarkRehypeOptions={REMARK_REHYPE_OPTIONS}
        allowedElements={ALLOWED_ELEMENTS}
        unwrapDisallowed
        components={COMPONENTS}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
};
