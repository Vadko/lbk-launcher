type StateMethod = 'pushState' | 'replaceState';

// Method syntax, so a real window, Navigation and an EventTarget all fit.
interface Listenable {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export interface NavWindow extends Partial<Listenable> {
  location: { href: string };
  navigation?: Listenable;
  history?: Pick<History, StateMethod>;
}

const STATE_METHODS: readonly StateMethod[] = ['pushState', 'replaceState'];

// The app's own call runs first, so a navigation that throws reports nothing and the URL is already the new one.
function callAfter(
  history: Pick<History, StateMethod>,
  name: StateMethod,
  after: () => void
): () => void {
  const original = history[name];
  const patched: History[StateMethod] = (...args) => {
    original.apply(history, args);
    after();
  };
  history[name] = patched;
  return () => {
    if (history[name] === patched) {
      history[name] = original;
    }
  };
}

// Calls onChange after every same-document navigation until the returned stop; undefined when the document offers no way to follow them.
export function watchSameDocumentUrl(
  win: NavWindow,
  onChange: () => void
): (() => void) | undefined {
  const { navigation, history } = win;
  // Steam's CEF (Chrome 126) has the Navigation API; patching history is for an engine without it.
  if (navigation) {
    navigation.addEventListener('currententrychange', onChange);
    return () => navigation.removeEventListener('currententrychange', onChange);
  }
  if (!history) {
    return undefined;
  }
  const restore = STATE_METHODS.map((name) => callAfter(history, name, onChange));
  win.addEventListener?.('popstate', onChange);
  return () => {
    win.removeEventListener?.('popstate', onChange);
    for (const undo of restore) {
      undo();
    }
  };
}
