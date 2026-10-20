import { G } from '@mobily/ts-belt';
import { isQueryClient, type QueryClient } from './achievement-query-cache';

// The community page holds about 2000 fibers; the cap bounds a walk over a foreign tree.
const WALK_LIMIT = 20_000;
const CONTAINER_KEY = '__reactContainer$';
const FIBER_KEY = '__reactFiber$';

type Fiber = Record<string, unknown>;

// Breadth-first over child and sibling links until visit() returns true.
function someFiber(root: unknown, visit: (fiber: Fiber) => boolean): boolean {
  const queue: unknown[] = [root];
  for (let i = 0; i < queue.length && i < WALK_LIMIT; i += 1) {
    const fiber = queue[i];
    if (G.isObject(fiber)) {
      if (visit(fiber)) {
        return true;
      }
      queue.push(fiber.child, fiber.sibling);
    }
  }
  return false;
}

export function findQueryClient(root: unknown): QueryClient | undefined {
  let client: QueryClient | undefined;
  someFiber(root, ({ memoizedProps: props }) => {
    client = G.isObject(props) && isQueryClient(props.client) ? props.client : undefined;
    return client !== undefined;
  });
  return client;
}

// Server HTML React has not hydrated yet: the root itself, or a Suspense or Activity boundary below it.
export function hasDehydratedFibers(root: unknown): boolean {
  return someFiber(root, ({ memoizedState: state }) =>
    G.isObject(state)
      ? state.isDehydrated === true || G.isNotNullable(state.dehydrated)
      : false
  );
}

// The current HostRoot fiber of what createRoot/hydrateRoot returned.
export function reactRootFiber(root: unknown): unknown {
  return G.isObject(root) && G.isObject(root._internalRoot)
    ? root._internalRoot.current
    : undefined;
}

const ownProperty = (el: object, prefix: string): unknown => {
  const key = Object.keys(el).find((k) => k.startsWith(prefix));
  return key === undefined ? undefined : Reflect.get(el, key);
};

// A container keeps the HostRoot fiber React made first; after a commit the live one is its FiberRoot's current.
export function containerRootFiber(el: object): unknown {
  const fiber = ownProperty(el, CONTAINER_KEY);
  return G.isObject(fiber) &&
    G.isObject(fiber.stateNode) &&
    G.isObject(fiber.stateNode.current)
    ? fiber.stateNode.current
    : fiber;
}

// The nearest provider above a node React rendered; a portal's parent chain leads through the tree that rendered it.
export function queryClientAbove(el: object): QueryClient | undefined {
  let fiber = ownProperty(el, FIBER_KEY);
  for (let depth = 0; G.isObject(fiber) && depth < WALK_LIMIT; depth += 1) {
    const props = fiber.memoizedProps;
    if (G.isObject(props) && isQueryClient(props.client)) {
      return props.client;
    }
    fiber = fiber.return;
  }
  return undefined;
}
