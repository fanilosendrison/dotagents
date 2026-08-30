import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { existsSync, rmSync } from "fs";
import {
    detectPermissionGrantSource,
    updatePermissionState,
    updatePermissionStateForScope,
    isPermissionGranted,
    isPermissionGrantedForScope,
} from "../state.ts";

const TEST_STATE_PATH = "/tmp/permission-enforcer-test-state.json";

describe("State Management", () => {
    beforeEach(() => {
        process.env.PERMISSION_STATE_PATH = TEST_STATE_PATH;
        if (existsSync(TEST_STATE_PATH)) {
            rmSync(TEST_STATE_PATH);
        }
    });

    afterEach(() => {
        if (existsSync(TEST_STATE_PATH)) {
            rmSync(TEST_STATE_PATH);
        }
        delete process.env.PERMISSION_STATE_PATH;
    });

    it("should return false if state file does not exist", () => {
        assert.strictEqual(isPermissionGranted(), false);
    });

    it("should grant permission when /go is present at start", () => {
        assert.strictEqual(updatePermissionState("/go my friend"), true);
        assert.strictEqual(isPermissionGranted(), true);
    });

    it("should grant permission when /go is present with whitespace", () => {
        assert.strictEqual(updatePermissionState("please /go ahead"), true);
        assert.strictEqual(isPermissionGranted(), true);
    });

    it("should grant permission when /go is alone", () => {
        assert.strictEqual(updatePermissionState("/go"), true);
        assert.strictEqual(isPermissionGranted(), true);
    });

    it("should grant permission when /go is formatted as a skill XML tag (Pi expanded)", () => {
        assert.strictEqual(updatePermissionState('<skill name="go">...content...</skill>'), true);
        assert.strictEqual(isPermissionGranted(), true);
    });

    it("should grant permission when /go is formatted as a skill XML tag with single quotes", () => {
        assert.strictEqual(updatePermissionState("<skill name='go'>...content...</skill>"), true);
        assert.strictEqual(isPermissionGranted(), true);
    });

    it("should not grant permission if /go is part of a word like /google", () => {
        assert.strictEqual(updatePermissionState("search on /google"), false);
        assert.strictEqual(isPermissionGranted(), false);
    });

    it("should revoke permission if next prompt does not have /go", () => {
        updatePermissionState("/go do this");
        assert.strictEqual(isPermissionGranted(), true);

        updatePermissionState("thanks");
        assert.strictEqual(isPermissionGranted(), false);
    });

    it("should isolate scoped permission by agent session", () => {
        const sessionA = { agent: "codex", sessionId: "session-a" };
        const sessionB = { agent: "codex", sessionId: "session-b" };

        assert.strictEqual(updatePermissionStateForScope("/go do this", sessionA), true);
        assert.strictEqual(isPermissionGrantedForScope(sessionA), true);

        assert.strictEqual(updatePermissionStateForScope("continue without edits", sessionB), false);
        assert.strictEqual(isPermissionGrantedForScope(sessionB), false);
        assert.strictEqual(isPermissionGrantedForScope(sessionA), true);
    });

    it("should preserve scoped permissions when legacy state is updated", () => {
        const sessionA = { agent: "codex", sessionId: "session-a" };

        updatePermissionStateForScope("/go do this", sessionA);
        updatePermissionState("plain legacy prompt");

        assert.strictEqual(isPermissionGranted(), false);
        assert.strictEqual(isPermissionGrantedForScope(sessionA), true);
    });

    it("should isolate scoped permission by agent even with the same session id", () => {
        const codexSession = { agent: "codex", sessionId: "same-session" };
        const piSession = { agent: "pi", sessionId: "same-session" };

        assert.strictEqual(updatePermissionStateForScope("/go do this", codexSession), true);
        assert.strictEqual(updatePermissionStateForScope("continue without edits", piSession), false);

        assert.strictEqual(isPermissionGrantedForScope(codexSession), true);
        assert.strictEqual(isPermissionGrantedForScope(piSession), false);
    });

    it("should report the matched grant source", () => {
        assert.strictEqual(detectPermissionGrantSource("please /go ahead"), "slash");
        assert.strictEqual(detectPermissionGrantSource('<skill name="go">content</skill>'), "skill-tag");
        assert.strictEqual(detectPermissionGrantSource("please continue"), "none");
    });
});
