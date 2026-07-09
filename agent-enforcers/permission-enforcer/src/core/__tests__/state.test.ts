import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, rmSync } from "fs";
import {
    detectPermissionGrantSource,
    updatePermissionState,
    isPermissionGranted,
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
        expect(isPermissionGranted()).toBe(false);
    });

    it("should grant permission when /go is present at start", () => {
        expect(updatePermissionState("/go my friend")).toBe(true);
        expect(isPermissionGranted()).toBe(true);
    });

    it("should grant permission when /go is present with whitespace", () => {
        expect(updatePermissionState("please /go ahead")).toBe(true);
        expect(isPermissionGranted()).toBe(true);
    });

    it("should grant permission when /go is alone", () => {
        expect(updatePermissionState("/go")).toBe(true);
        expect(isPermissionGranted()).toBe(true);
    });

    it("should grant permission when /go is formatted as a skill XML tag (Pi expanded)", () => {
        expect(updatePermissionState('<skill name="go">...content...</skill>')).toBe(true);
        expect(isPermissionGranted()).toBe(true);
    });

    it("should grant permission when /go is formatted as a skill XML tag with single quotes", () => {
        expect(updatePermissionState("<skill name='go'>...content...</skill>")).toBe(true);
        expect(isPermissionGranted()).toBe(true);
    });

    it("should not grant permission if /go is part of a word like /google", () => {
        expect(updatePermissionState("search on /google")).toBe(false);
        expect(isPermissionGranted()).toBe(false);
    });

    it("should revoke permission if next prompt does not have /go", () => {
        updatePermissionState("/go do this");
        expect(isPermissionGranted()).toBe(true);

        updatePermissionState("thanks");
        expect(isPermissionGranted()).toBe(false);
    });

    it("should report the matched grant source", () => {
        expect(detectPermissionGrantSource("please /go ahead")).toBe("slash");
        expect(detectPermissionGrantSource('<skill name="go">content</skill>')).toBe("skill-tag");
        expect(detectPermissionGrantSource("please continue")).toBe("none");
    });
});
