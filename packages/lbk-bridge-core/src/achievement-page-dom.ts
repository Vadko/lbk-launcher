const ATTRS = ['title', 'aria-label', 'alt'];
const SKIP_PARENTS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT']);
// Nodes React dropped are forgotten once this many were written.
const PRUNE_AT = 1000;

interface Written {
  orig: string;
  ours: string;
}

export interface DomTranslation {
  dispose(): void;
}

// Swaps exact English strings in text nodes and a few attributes, again whenever React renders them back.
export function translateDom(
  doc: Document,
  sources: ReadonlyMap<string, string>
): DomTranslation {
  const texts = new Map<Text, Written>();
  const attrs = new Map<Element, Map<string, Written>>();

  const swap = (value: string): string | undefined => {
    const source = value.trim();
    const text = source ? sources.get(source) : undefined;
    if (text === undefined) {
      return undefined;
    }
    const at = value.indexOf(source);
    return value.slice(0, at) + text + value.slice(at + source.length);
  };
  const visitText = (node: Text): void => {
    const next =
      node.parentNode && SKIP_PARENTS.has(node.parentNode.nodeName)
        ? undefined
        : swap(node.data);
    if (next !== undefined) {
      texts.set(node, { orig: node.data, ours: next });
      node.data = next;
    }
  };
  const visitElement = (el: Element): void => {
    for (const name of ATTRS) {
      const value = el.getAttribute(name);
      const next = value === null ? undefined : swap(value);
      if (value === null || next === undefined) {
        continue;
      }
      const written = attrs.get(el) ?? new Map<string, Written>();
      written.set(name, { orig: value, ours: next });
      attrs.set(el, written);
      el.setAttribute(name, next);
    }
  };
  const scan = (root: Node): void => {
    const walker = doc.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT
    );
    for (let node: Node | null = walker.currentNode; node; node = walker.nextNode()) {
      if (node instanceof Text) {
        visitText(node);
      } else if (node instanceof Element) {
        visitElement(node);
      }
    }
  };
  const prune = (): void => {
    if (texts.size + attrs.size < PRUNE_AT) {
      return;
    }
    texts.forEach((_, node) => {
      if (!node.isConnected) {
        texts.delete(node);
      }
    });
    attrs.forEach((_, el) => {
      if (!el.isConnected) {
        attrs.delete(el);
      }
    });
  };

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'childList') {
        record.addedNodes.forEach(scan);
      } else if (record.target instanceof Text) {
        visitText(record.target);
      } else if (record.target instanceof Element) {
        visitElement(record.target);
      }
    }
    // Whatever is queued now came from the writes above.
    observer.takeRecords();
    prune();
  });
  const root = doc.body ?? doc.documentElement;
  scan(root);
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRS,
  });

  return {
    dispose() {
      observer.disconnect();
      texts.forEach((w, node) => {
        if (node.data === w.ours) {
          node.data = w.orig;
        }
      });
      attrs.forEach((written, el) => {
        written.forEach((w, name) => {
          if (el.getAttribute(name) === w.ours) {
            el.setAttribute(name, w.orig);
          }
        });
      });
      texts.clear();
      attrs.clear();
    },
  };
}
