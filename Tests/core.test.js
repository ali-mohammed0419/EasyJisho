"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../JPTranslateExtension/Resources/core.js");

test("normalizes whitespace without changing Japanese text", () => {
    assert.equal(core.normalizeQuery("  日本語\n\tを  学ぶ  "), "日本語 を 学ぶ");
});

test("validates empty and overlong selections", () => {
    assert.equal(core.validateQuery("  \n ").ok, false);
    assert.equal(core.validateQuery("日".repeat(200)).ok, true);
    assert.equal(core.validateQuery("日".repeat(201)).ok, false);
});

test("counts Unicode code points instead of UTF-16 units", () => {
    assert.equal(core.validateQuery("𠮷".repeat(200)).ok, true);
    assert.equal(core.validateQuery("𠮷".repeat(201)).ok, false);
});

test("builds encoded API and page URLs", () => {
    assert.equal(
        core.buildJishoApiUrl("日本 語"),
        "https://jisho.org/api/v1/search/words?keyword=%E6%97%A5%E6%9C%AC%20%E8%AA%9E"
    );
    assert.equal(
        core.buildJishoPageUrl("猫/犬"),
        "https://jisho.org/search/%E7%8C%AB%2F%E7%8A%AC"
    );
});

test("normalizes and limits Jisho entries", () => {
    const entry = (word, reading) => ({
        is_common: true,
        tags: ["wanikani1", "wanikani1"],
        jlpt: ["jlpt-n5"],
        japanese: [{ word, reading }],
        senses: [{
            parts_of_speech: ["Noun"],
            english_definitions: [`definition of ${word}`],
            tags: [],
            info: []
        }]
    });

    const entries = core.normalizeResponse({
        meta: { status: 200 },
        data: [entry("一", "いち"), entry("二", "に"), entry("三", "さん"), entry("四", "よん")]
    }, 3);

    assert.equal(entries.length, 3);
    assert.deepEqual(entries[0], {
        display: "一",
        readings: ["いち"],
        alternateForms: [],
        isCommon: true,
        tags: ["wanikani1"],
        jlpt: ["jlpt-n5"],
        senses: [{
            partsOfSpeech: ["Noun"],
            definitions: ["definition of 一"],
            tags: [],
            info: []
        }]
    });
});

test("drops malformed entries and rejects malformed payloads", () => {
    assert.deepEqual(core.normalizeResponse({ data: [null, {}, { japanese: [], senses: [] }] }), []);
    assert.throws(() => core.normalizeResponse({ nope: [] }), /unexpected response/);
    assert.throws(() => core.normalizeResponse(null), /unexpected response/);
});

test("unwraps successful native lookup responses", () => {
    const payload = { meta: { status: 200 }, data: [] };
    assert.equal(core.unwrapNativeResponse({ ok: true, payload }), payload);
});

test("surfaces native lookup errors", () => {
    assert.throws(
        () => core.unwrapNativeResponse({ ok: false, code: "network", message: "Offline" }),
        (error) => error.message === "Offline" && error.code === "network"
    );
    assert.throws(() => core.unwrapNativeResponse(null), /invalid response/);
    assert.throws(() => core.unwrapNativeResponse({ ok: true }), /invalid response/);
});

test("allows only HTTP links", () => {
    assert.equal(core.isSafeHttpUrl("https://jisho.org/search/%E7%8C%AB"), true);
    assert.equal(core.isSafeHttpUrl("http://example.com"), true);
    assert.equal(core.isSafeHttpUrl("javascript:alert(1)"), false);
    assert.equal(core.isSafeHttpUrl("not a URL"), false);
});

