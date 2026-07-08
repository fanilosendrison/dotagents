import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, rmSync } from "fs";
import { updatePermissionState, isPermissionGranted } from "../state.ts";

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
        updatePermissionState("/go my friend");
        expect(isPermissionGranted()).toBe(true);
    });

    it("should grant permission when /go is present with whitespace", () => {
        updatePermissionState("please /go ahead");
        expect(isPermissionGranted()).toBe(true);
    });
    
    it("should grant permission when /go is alone", () => {
        updatePermissionState("/go");
        expect(isPermissionGranted()).toBe(true);
    });

    it("should not grant permission if /go is part of a word like /google", () => {
        updatePermissionState("search on /google");
        expect(isPermissionGranted()).toBe(false);
    });

    it("should revoke permission if next prompt does not have /go", () => {
        updatePermissionState("/go do this");
        expect(isPermissionGranted()).toBe(true);

        updatePermissionState("thanks");
        expect(isPermissionGranted()).toBe(false);
    });
});
