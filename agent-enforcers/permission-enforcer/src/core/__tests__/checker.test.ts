import { describe, it, expect, spyOn, beforeEach, afterEach } from "bun:test";
import * as state from "../state.ts";
import { shouldBlockTool } from "../checker.ts";

describe("Tool Checker", () => {
    let isPermissionGrantedMock: ReturnType<typeof spyOn>;

    beforeEach(() => {
        isPermissionGrantedMock = spyOn(state, "isPermissionGranted");
    });

    afterEach(() => {
        isPermissionGrantedMock.mockRestore();
    });

    it("should not block non-modifying tools even if permission is false", () => {
        isPermissionGrantedMock.mockReturnValue(false);
        expect(shouldBlockTool("run_command")).toBe(false);
        expect(shouldBlockTool("Bash")).toBe(false);
        expect(shouldBlockTool("Grep")).toBe(false);
        expect(shouldBlockTool("random_tool")).toBe(false);
    });

    it("should block modifying tools if permission is false", () => {
        isPermissionGrantedMock.mockReturnValue(false);
        expect(shouldBlockTool("write_to_file")).toBe(true);
        expect(shouldBlockTool("replace_file_content")).toBe(true);
        expect(shouldBlockTool("multi_replace_file_content")).toBe(true);
        expect(shouldBlockTool("apply_patch")).toBe(true);
        expect(shouldBlockTool("Write")).toBe(true);
        expect(shouldBlockTool("Edit")).toBe(true);
        expect(shouldBlockTool("Replace")).toBe(true);
        expect(shouldBlockTool("NotebookEdit")).toBe(true);
        expect(shouldBlockTool("write")).toBe(true);
        expect(shouldBlockTool("edit")).toBe(true);
    });

    it("should not block modifying tools if permission is true", () => {
        isPermissionGrantedMock.mockReturnValue(true);
        expect(shouldBlockTool("write_to_file")).toBe(false);
        expect(shouldBlockTool("Edit")).toBe(false);
        expect(shouldBlockTool("apply_patch")).toBe(false);
    });
});
