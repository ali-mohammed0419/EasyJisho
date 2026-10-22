(function installJPTranslatePanel() {
    "use strict";

    if (globalThis.JPTranslatePanel) {
        return;
    }

    const HOST_ID = "jptranslate-panel-host";
    let host = null;
    let shadow = null;

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) {
            node.className = className;
        }
        if (typeof text === "string") {
            node.textContent = text;
        }
        return node;
    }

    function close() {
        document.removeEventListener("pointerdown", handleOutsidePointer, true);
        document.removeEventListener("keydown", handleKeyDown, true);
        host?.remove();
        host = null;
        shadow = null;
    }

    function handleOutsidePointer(event) {
        if (host && !event.composedPath().includes(host)) {
            close();
        }
    }

    function handleKeyDown(event) {
        if (event.key === "Escape") {
            event.preventDefault();
            close();
        }
    }

    function ensureHost() {
        const existing = document.getElementById(HOST_ID);
        if (existing) {
            existing.remove();
        }

        host = document.createElement("div");
        host.id = HOST_ID;
        host.style.position = "fixed";
        host.style.left = "12px";
        host.style.top = "12px";
        host.style.zIndex = "2147483647";
        host.style.width = "min(410px, calc(100vw - 24px))";
        host.style.maxWidth = "calc(100vw - 24px)";
        host.style.colorScheme = "light dark";
        shadow = host.attachShadow({ mode: "closed" });
        document.documentElement.appendChild(host);

        document.removeEventListener("pointerdown", handleOutsidePointer, true);
        document.removeEventListener("keydown", handleKeyDown, true);
        setTimeout(() => {
            document.addEventListener("pointerdown", handleOutsidePointer, true);
            document.addEventListener("keydown", handleKeyDown, true);
        }, 0);
    }

    function selectedRect() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            return null;
        }

        const rect = selection.getRangeAt(0).getBoundingClientRect();
        if (!rect || (rect.width === 0 && rect.height === 0)) {
            return null;
        }

        return rect;
    }

    function positionPanel() {
        if (!host) {
            return;
        }

        const margin = 12;
        const gap = 8;
        const rect = selectedRect();
        const panelRect = host.getBoundingClientRect();
        let left = rect ? rect.left : window.innerWidth - panelRect.width - margin;
        let top = rect ? rect.bottom + gap : margin;

        if (rect && top + panelRect.height > window.innerHeight - margin) {
            top = rect.top - panelRect.height - gap;
        }

        left = Math.max(margin, Math.min(left, window.innerWidth - panelRect.width - margin));
        top = Math.max(margin, Math.min(top, window.innerHeight - panelRect.height - margin));

        host.style.left = `${Math.round(left)}px`;
        host.style.top = `${Math.round(top)}px`;
    }

    function stylesheet() {
        const style = document.createElement("style");
        style.textContent = `
            :host { all: initial; color-scheme: light dark; }
            * { box-sizing: border-box; }
            .panel {
                --surface: rgba(248, 248, 250, 0.98);
                --surface-secondary: rgba(0, 0, 0, 0.045);
                --text: #1d1d1f;
                --secondary: #65656b;
                --border: rgba(0, 0, 0, 0.14);
                --accent: #b3261e;
                width: 100%;
                max-height: min(620px, calc(100vh - 24px));
                overflow: hidden;
                color: var(--text);
                background: var(--surface);
                border: 1px solid var(--border);
                border-radius: 13px;
                box-shadow: 0 18px 50px rgba(0, 0, 0, 0.24), 0 3px 10px rgba(0, 0, 0, 0.12);
                font: 13px/1.42 -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
                -webkit-font-smoothing: antialiased;
                backdrop-filter: blur(22px) saturate(1.25);
            }
            .header {
                display: flex;
                align-items: center;
                gap: 10px;
                min-height: 45px;
                padding: 9px 10px 9px 14px;
                border-bottom: 1px solid var(--border);
            }
            .brand { color: var(--accent); font-size: 12px; font-weight: 700; letter-spacing: .02em; }
            .query { min-width: 0; flex: 1; overflow: hidden; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
            .close {
                display: grid;
                place-items: center;
                width: 26px;
                height: 26px;
                padding: 0;
                color: var(--secondary);
                background: var(--surface-secondary);
                border: 0;
                border-radius: 50%;
                font: 18px/1 -apple-system, sans-serif;
                cursor: default;
            }
            .close:hover { color: var(--text); background: rgba(127, 127, 127, .18); }
            .body { max-height: calc(min(620px, 100vh - 24px) - 92px); overflow: auto; }
            .message { padding: 24px 18px; color: var(--secondary); text-align: center; }
            .spinner {
                display: inline-block;
                width: 15px;
                height: 15px;
                margin-right: 8px;
                vertical-align: -3px;
                border: 2px solid rgba(127, 127, 127, .3);
                border-top-color: var(--accent);
                border-radius: 50%;
                animation: spin .75s linear infinite;
            }
            @keyframes spin { to { transform: rotate(360deg); } }
            .entry { padding: 14px; }
            .entry + .entry { border-top: 1px solid var(--border); }
            .word-row { display: flex; align-items: baseline; flex-wrap: wrap; gap: 7px; margin-bottom: 7px; }
            .word { font: 700 21px/1.2 -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif; }
            .reading { color: var(--secondary); font-size: 13px; }
            .tags { display: flex; flex-wrap: wrap; gap: 5px; margin: 0 0 9px; }
            .tag { padding: 2px 6px; color: var(--secondary); background: var(--surface-secondary); border-radius: 5px; font-size: 10px; font-weight: 600; }
            .common { color: #26703b; background: rgba(52, 168, 83, .12); }
            .sense + .sense { margin-top: 9px; }
            .pos { margin-bottom: 2px; color: var(--secondary); font-size: 11px; font-style: italic; }
            .definitions { margin: 0; padding-left: 20px; }
            .definitions li + li { margin-top: 2px; }
            .alternates { margin-top: 8px; color: var(--secondary); font-size: 11px; }
            .footer { padding: 9px 14px; border-top: 1px solid var(--border); text-align: right; }
            .footer a { color: var(--accent); font-weight: 600; text-decoration: none; }
            .footer a:hover { text-decoration: underline; }
            @media (prefers-color-scheme: dark) {
                .panel {
                    --surface: rgba(39, 39, 42, 0.97);
                    --surface-secondary: rgba(255, 255, 255, 0.08);
                    --text: #f5f5f7;
                    --secondary: #aaaab1;
                    --border: rgba(255, 255, 255, 0.14);
                    --accent: #ff6961;
                }
                .common { color: #82d994; background: rgba(82, 190, 112, .14); }
            }
            @media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
        `;
        return style;
    }

    function header(query) {
        const node = element("div", "header");
        node.append(element("span", "brand", "JISHO"));
        node.append(element("span", "query", query || "Search"));

        const closeButton = element("button", "close", "×");
        closeButton.type = "button";
        closeButton.setAttribute("aria-label", "Close Jisho Search");
        closeButton.addEventListener("click", close);
        node.append(closeButton);
        return node;
    }

    function tagsFor(entry) {
        const tags = element("div", "tags");

        if (entry.isCommon) {
            tags.append(element("span", "tag common", "Common word"));
        }

        [...entry.jlpt, ...entry.tags].forEach((tag) => {
            tags.append(element("span", "tag", tag));
        });

        return tags.childNodes.length > 0 ? tags : null;
    }

    function entryNode(entry) {
        const node = element("article", "entry");
        const wordRow = element("div", "word-row");
        wordRow.append(element("span", "word", entry.display));

        if (entry.readings.length > 0 && !entry.readings.includes(entry.display)) {
            wordRow.append(element("span", "reading", entry.readings.join("・")));
        }

        node.append(wordRow);

        const tags = tagsFor(entry);
        if (tags) {
            node.append(tags);
        }

        entry.senses.forEach((sense) => {
            const senseNode = element("div", "sense");
            if (sense.partsOfSpeech.length > 0) {
                senseNode.append(element("div", "pos", sense.partsOfSpeech.join(", ")));
            }

            const definitions = element("ol", "definitions");
            sense.definitions.forEach((definition) => {
                definitions.append(element("li", "", definition));
            });
            senseNode.append(definitions);
            node.append(senseNode);
        });

        if (entry.alternateForms.length > 0) {
            node.append(element("div", "alternates", `Other forms: ${entry.alternateForms.join("、")}`));
        }

        return node;
    }

    function footer(url) {
        if (typeof url !== "string" || !url.startsWith("https://jisho.org/")) {
            return null;
        }

        const node = element("div", "footer");
        const link = element("a", "", "Open on Jisho ↗");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        node.append(link);
        return node;
    }

    function render(state) {
        ensureHost();
        const panel = element("section", "panel");
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-label", "Jisho Search results");
        panel.append(header(state && state.query));

        const body = element("div", "body");
        body.setAttribute("aria-live", "polite");

        if (!state || state.type === "error") {
            body.append(element("div", "message", state?.message || "The lookup failed. Try again."));
        } else if (state.type === "loading") {
            const message = element("div", "message");
            message.append(element("span", "spinner"));
            message.append(document.createTextNode("Searching Jisho…"));
            body.append(message);
        } else if (state.type === "empty") {
            body.append(element("div", "message", "No matching Jisho entries were found."));
        } else if (state.type === "success" && Array.isArray(state.entries)) {
            state.entries.forEach((entry) => body.append(entryNode(entry)));
        }

        panel.append(body);
        const footerNode = footer(state && state.jishoUrl);
        if (footerNode) {
            panel.append(footerNode);
        }

        shadow.append(stylesheet(), panel);
        requestAnimationFrame(positionPanel);
    }

    globalThis.JPTranslatePanel = Object.freeze({ render, close });
}());

