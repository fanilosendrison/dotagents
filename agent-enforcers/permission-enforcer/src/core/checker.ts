import { isPermissionGranted } from "./state.ts";

const RESTRICTED_TOOLS = [
    "write_to_file",
    "replace_file_content",
    "multi_replace_file_content",
    "apply_patch",
    "Write",
    "Edit",
    "Replace",
    "NotebookEdit",
    "write",
    "edit"
];

export function shouldBlockTool(toolName: string): boolean {
    if (!RESTRICTED_TOOLS.includes(toolName)) {
        return false;
    }
    return !isPermissionGranted();
}
