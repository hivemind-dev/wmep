/**
 * Main demo entry (Svelte 5 + Vite)
 *
 * Mounts the host App component. Cross-module wiring lives inside
 * App.svelte (see comment at the top of that file).
 */

import { mount, unmount } from "svelte";

import "./styles/globals.scss";

import App from "./App.svelte";

const target = document.getElementById("app");
if (!target) throw new Error("#app container missing");

const app = mount(App, { target });

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    void unmount(app, { outro: false });
  });
}

export default app;
