/**
 * @demo/notes — module-owned UI (Lit 3)
 */

import { LitElement, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { WmepInstance } from "@aurorah/wmep";

import { DEFAULT_CONFIG } from "../configuration/configuration.wmep";
import { createLogger } from "../../lib/host";

import { Notes, type Note } from "./notes.wmep";

import "./notes.scss";

@customElement("demo-notes-view")
export class NotesView extends LitElement {
  @property({ attribute: false }) maxNotes: number =
    DEFAULT_CONFIG.notes.maxNotes;

  @state() private list: Note[] = [];
  @state() private draft = "";

  private instance: WmepInstance<Notes> | null = null;
  private unsubs: Array<() => void> = [];

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();

    const instance = Notes(
      { logger: createLogger("@demo/notes") },
      { maxNotes: this.maxNotes, seed: [] },
    );
    this.instance = instance;

    const refresh = () => {
      this.list = instance.capabilities.getAll();
    };

    this.unsubs.push(
      instance.on("note:added", refresh),
      instance.on("note:edited", refresh),
      instance.on("note:removed", refresh),
      instance.on("notes:cleared", refresh),
      instance.on("wmep:mounted", refresh),
    );
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubs.forEach((fn) => fn());
    this.unsubs = [];
    const inst = this.instance;
    this.instance = null;
    if (inst) void inst.unmount("notes-view-disconnect");
  }

  private submit = (): void => {
    const text = this.draft.trim();
    if (!text) return;
    try {
      this.instance?.capabilities.add({ text });
      this.draft = "";
    } catch (err) {
      console.warn(err);
    }
  };

  private editNote = (n: Note): void => {
    const next = prompt("Edit note", n.text);
    if (next != null && next.trim()) {
      this.instance?.capabilities.edit({ id: n.id, text: next.trim() });
    }
  };

  private removeNote = (id: string): void => {
    this.instance?.capabilities.remove({ id });
  };

  protected override render(): TemplateResult {
    return html`
      <section class="module-panel notes-panel">
        <header class="module-panel-header">
          <span class="module-panel-title">Notes</span>
          <span class="module-panel-subtitle">
            @demo/notes &middot; ${this.list.length} / ${this.maxNotes}
          </span>
        </header>

        <div class="notes-composer">
          <input
            class="notes-input"
            type="text"
            placeholder="Type a note and press Enter"
            .value=${this.draft}
            @input=${(e: InputEvent) => {
              this.draft = (e.currentTarget as HTMLInputElement).value;
            }}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === "Enter") this.submit();
            }}
          />
          <button class="btn btn-green" @click=${this.submit}>Add</button>
          <button
            class="btn btn-ghost"
            @click=${() => this.instance?.capabilities.clear()}
          >
            Clear
          </button>
        </div>

        <ul class="notes-list">
          ${this.list.length === 0
            ? html`<li class="notes-empty">No notes yet.</li>`
            : this.list.map(
                (n) => html`
                  <li class="notes-item">
                    <span class="notes-item-text">${n.text}</span>
                    <div class="notes-item-actions">
                      <button
                        class="btn btn-ghost btn-xs"
                        @click=${() => this.editNote(n)}
                      >
                        Edit
                      </button>
                      <button
                        class="btn btn-red btn-xs"
                        @click=${() => this.removeNote(n.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                `,
              )}
          ${nothing}
        </ul>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "demo-notes-view": NotesView;
  }
}
