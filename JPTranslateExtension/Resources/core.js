(function (root, factory) {
    const core = factory();
    root.JPTranslateCore = core;

    if (typeof module === "object" && module.exports) {
        module.exports = core;
    }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    const MAX_QUERY_CODE_POINTS = 200;

    function normalizeQuery(value) {
        if (typeof value !== "string") {
            return "";
        }

        return value.replace(/\s+/gu, " ").trim();
    }

    function validateQuery(value) {
        const query = normalizeQuery(value);

        if (!query) {
            return { ok: false, query, message: "Select some text before searching." };
        }

        if ([...query].length > MAX_QUERY_CODE_POINTS) {
            return {
                ok: false,
                query,
                message: `Select a shorter passage (up to ${MAX_QUERY_CODE_POINTS} characters).`
            };
        }

        return { ok: true, query };
    }

    function buildJishoApiUrl(query) {
        return `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(query)}`;
    }

    function buildJishoPageUrl(query) {
        return `https://jisho.org/search/${encodeURIComponent(query)}`;
    }

    function uniqueStrings(values) {
        return [...new Set(values.filter((value) => typeof value === "string" && value.trim()))];
    }

    function normalizeJapaneseForms(forms) {
        if (!Array.isArray(forms)) {
            return [];
        }

        return forms.flatMap((form) => {
            if (!form || typeof form !== "object") {
                return [];
            }

            const word = typeof form.word === "string" ? form.word.trim() : "";
            const reading = typeof form.reading === "string" ? form.reading.trim() : "";

            if (!word && !reading) {
                return [];
            }

            return [{ word, reading }];
        });
    }

    function normalizeSenses(senses) {
        if (!Array.isArray(senses)) {
            return [];
        }

        return senses.flatMap((sense) => {
            if (!sense || typeof sense !== "object") {
                return [];
            }

            const definitions = uniqueStrings(
                Array.isArray(sense.english_definitions) ? sense.english_definitions : []
            );

            if (definitions.length === 0) {
                return [];
            }

            return [{
                partsOfSpeech: uniqueStrings(
                    Array.isArray(sense.parts_of_speech) ? sense.parts_of_speech : []
                ),
                definitions,
                tags: uniqueStrings(Array.isArray(sense.tags) ? sense.tags : []),
                info: uniqueStrings(Array.isArray(sense.info) ? sense.info : [])
            }];
        });
    }

    function normalizeEntry(entry) {
        if (!entry || typeof entry !== "object") {
            return null;
        }

        const forms = normalizeJapaneseForms(entry.japanese);
        const senses = normalizeSenses(entry.senses);

        if (forms.length === 0 || senses.length === 0) {
            return null;
        }

        const primary = forms[0];
        const display = primary.word || primary.reading;
        const readings = uniqueStrings(forms.map((form) => form.reading));
        const alternateForms = uniqueStrings(
            forms.slice(1).map((form) => form.word || form.reading)
        ).filter((form) => form !== display);
        const sourceTags = uniqueStrings(Array.isArray(entry.tags) ? entry.tags : []);
        const jlptTags = uniqueStrings(Array.isArray(entry.jlpt) ? entry.jlpt : []);

        return {
            display,
            readings,
            alternateForms,
            isCommon: entry.is_common === true,
            tags: sourceTags,
            jlpt: jlptTags,
            senses
        };
    }

    function normalizeResponse(payload, limit = 3) {
        if (!payload || typeof payload !== "object" || !Array.isArray(payload.data)) {
            throw new Error("Jisho returned an unexpected response.");
        }

        const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 3;

        return payload.data
            .map(normalizeEntry)
            .filter(Boolean)
            .slice(0, safeLimit);
    }

    function unwrapNativeResponse(response) {
        if (!response || typeof response !== "object") {
            throw new Error("JPTranslate received an invalid response from its native lookup service.");
        }

        if (response.ok === false) {
            const error = new Error(
                typeof response.message === "string" && response.message
                    ? response.message
                    : "The native Jisho lookup failed."
            );
            error.code = typeof response.code === "string" ? response.code : "nativeError";
            throw error;
        }

        if (response.ok !== true || !response.payload || typeof response.payload !== "object") {
            throw new Error("JPTranslate received an invalid response from its native lookup service.");
        }

        return response.payload;
    }

    function isSafeHttpUrl(value) {
        try {
            const url = new URL(value);
            return url.protocol === "https:" || url.protocol === "http:";
        } catch (_) {
            return false;
        }
    }

    return Object.freeze({
        MAX_QUERY_CODE_POINTS,
        normalizeQuery,
        validateQuery,
        buildJishoApiUrl,
        buildJishoPageUrl,
        normalizeResponse,
        unwrapNativeResponse,
        isSafeHttpUrl
    });
}));

