/**
 * Tiny DOM helpers — keep view code declarative without a framework.
 *
 *   h(tag, attrs?, ...children)        create an element
 *   t(text)                            create a text node
 *   clear(node)                        remove every child
 *   replaceChildren(node, ...kids)     swap children atomically
 *
 * Convention:
 *   - `className` becomes the class string
 *   - `style` accepts a Partial<CSSStyleDeclaration> object
 *   - keys starting with `on` (e.g. `onClick`) become event listeners
 *   - everything else becomes an attribute via setAttribute
 */

export type Child =
  | Node
  | string
  | number
  | null
  | undefined
  | false
  | Child[];

type Listener<E extends Event = Event> = (event: E) => void;

type EventAttrs<K extends keyof HTMLElementTagNameMap> = {
  [P in keyof HTMLElementEventMap as `on${Capitalize<P>}`]?: Listener<
    HTMLElementEventMap[P]
  > & {
    bivarianceHack(this: HTMLElementTagNameMap[K], ev: HTMLElementEventMap[P]): void;
  }["bivarianceHack"];
};

export type Attrs<K extends keyof HTMLElementTagNameMap> = {
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
  dataset?: Record<string, string | number | boolean>;
  [key: string]: unknown;
} & EventAttrs<K>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs<K> | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) applyAttrs(el, attrs);
  appendChildren(el, children);
  return el;
}

export function t(text: string | number): Text {
  return document.createTextNode(String(text));
}

export function clear(node: Node): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function replaceChildren(node: Node, ...kids: Child[]): void {
  clear(node);
  appendChildren(node, kids);
}

function applyAttrs(el: HTMLElement, attrs: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "className") {
      el.className = String(value);
    } else if (key === "style" && typeof value === "object") {
      Object.assign(el.style, value as Partial<CSSStyleDeclaration>);
    } else if (key === "dataset" && typeof value === "object") {
      for (const [dk, dv] of Object.entries(value as Record<string, unknown>)) {
        el.dataset[dk] = String(dv);
      }
    } else if (key.startsWith("on") && typeof value === "function") {
      const eventName = key.slice(2).toLowerCase();
      el.addEventListener(eventName, value as EventListener);
    } else if (key === "value" && el instanceof HTMLInputElement) {
      el.value = String(value);
    } else if (key === "checked" && el instanceof HTMLInputElement) {
      el.checked = Boolean(value);
    } else if (value === true) {
      el.setAttribute(key, "");
    } else {
      el.setAttribute(key, String(value));
    }
  }
}

function appendChildren(node: Node, children: Child[]): void {
  for (const child of children) {
    if (child == null || child === false) continue;
    if (Array.isArray(child)) {
      appendChildren(node, child);
    } else if (typeof child === "string" || typeof child === "number") {
      node.appendChild(document.createTextNode(String(child)));
    } else {
      node.appendChild(child);
    }
  }
}
