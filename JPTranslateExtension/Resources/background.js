"use strict";

importScripts("core.js");

const extensionApi = globalThis.browser || globalThis.chrome;
const core = globalThis.JPTranslateCore;
const MENU_ID = "jptranslate-jisho-search";
const NATIVE_APP_ID = "com.alimohammed.JPTranslate";
const NATIVE_MESSAGE_TIMEOUT_MS = 12_000;

function reportRuntimeError(context) {
    const error = extensionApi.runtime.lastError;
    if (error) {
        console.error(`[JPTranslate] ${context}: ${error.message}`);
    }
}

function registerContextMenu() {
    extensionApi.contextMenus.removeAll(() => {
        reportRuntimeError("removing old context-menu items");

        extensionApi.contextMenus.create({
            id: MENU_ID,
            title: "Jisho Search",
            contexts: ["selection"]
        }, () => reportRuntimeError("creating the context-menu item"));
    });
}

extensionApi.runtime.onInstalled.addListener(registerContextMenu);

if (extensionApi.runtime.onStartup) {
    extensionApi.runtime.onStartup.addListener(registerContextMenu);
}

function targetFor(tabId, frameId) {
    const target = { tabId };

    if (Number.isInteger(frameId) && frameId >= 0) {
        target.frameIds = [frameId];
    }

    return target;
}

async function injectPanel(target) {
    await extensionApi.scripting.executeScript({
        target,
        files: ["panel.js"]
    });
}

async function renderPanelState(target, state) {
    await extensionApi.scripting.executeScript({
        target,
        func: (nextState) => {
            if (globalThis.JPTranslatePanel) {
                globalThis.JPTranslatePanel.render(nextState);
            }
        },
        args: [state]
    });
}

function sendNativeLookup(query) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
            if (!settled) {
                settled = true;
                reject(new Error("Jisho took too long to respond. Try again."));
            }
        }, NATIVE_MESSAGE_TIMEOUT_MS);

        function finish(response) {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(timeout);

            const runtimeError = extensionApi.runtime.lastError;
            if (runtimeError) {
                reject(new Error(`The native lookup service failed: ${runtimeError.message}`));
                return;
            }

            resolve(response);
        }

        function fail(error) {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(timeout);
            reject(error instanceof Error ? error : new Error(String(error)));
        }

        try {
            const possiblePromise = extensionApi.runtime.sendNativeMessage(
                NATIVE_APP_ID,
                { type: "jishoSearch", query },
                finish
            );

            if (possiblePromise && typeof possiblePromise.then === "function") {
                possiblePromise.then(finish, fail);
            }
        } catch (error) {
            fail(error);
        }
    });
}

async function fetchEntries(query) {
    const nativeResponse = await sendNativeLookup(query);
    return core.normalizeResponse(core.unwrapNativeResponse(nativeResponse), 3);
}

function userFacingError(error) {
    return error && error.message
        ? error.message
        : "The lookup failed. Try again.";
}

extensionApi.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== MENU_ID || !Number.isInteger(tab && tab.id)) {
        return;
    }

    const validation = core.validateQuery(info.selectionText);
    const target = targetFor(tab.id, info.frameId);

    try {
        await injectPanel(target);

        if (!validation.ok) {
            await renderPanelState(target, {
                type: "error",
                query: validation.query,
                message: validation.message
            });
            return;
        }

        const query = validation.query;
        const jishoUrl = core.buildJishoPageUrl(query);

        await renderPanelState(target, { type: "loading", query });

        try {
            const entries = await fetchEntries(query);
            await renderPanelState(target, entries.length > 0
                ? { type: "success", query, jishoUrl, entries }
                : { type: "empty", query, jishoUrl });
        } catch (error) {
            console.error("[JPTranslate] Jisho request failed", error);
            await renderPanelState(target, {
                type: "error",
                query,
                jishoUrl,
                message: userFacingError(error)
            });
        }
    } catch (error) {
        // Safari blocks injection into protected pages such as its own settings.
        // There is no page surface on which an inline error can safely appear.
        console.error("[JPTranslate] Could not show the lookup panel", error);
    }
});

