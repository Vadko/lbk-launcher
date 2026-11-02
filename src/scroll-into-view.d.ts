// Chromium 152 settles scrollIntoView once every scroller it moved has stopped; lib.dom still types it void
interface ScrollResult {
  interrupted: boolean;
}

interface Element {
  scrollIntoView(arg?: boolean | ScrollIntoViewOptions): Promise<ScrollResult>;
}
