import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { report, setCategories } from "./Reporter.js";
import { configureFileLogger, startFileLogger, stopFileLogger } from "./FileLogger.js";

describe("FileLogger", () => {
    const directory = mkdtempSync(join(tmpdir(), "file-logger-"));

    afterEach(() => {
        setCategories(["info", "error", "stack"]);
    });

    it("should write each report of its categories as a line, and flush them when stopped", async () => {
        // Arrange
        const filePath = join(directory, "nested", "report.log");
        configureFileLogger({ filePath });
        setCategories(["all"]);
        startFileLogger(["stateui.*"]);

        // Act
        report("stateui.render", "Rendered %s", ["ui-button"]);
        report("state.set", "Set %s", ["$.a"]);
        report("stateui.repeat", "Reconciled");
        await stopFileLogger();

        // Assert
        const lines = readFileSync(filePath, "utf8").trim().split("\n");
        expect(lines).toHaveLength(2);
        expect(lines[0]).toContain("stateui.render");
        expect(lines[0]).toContain("Rendered ui-button");
        expect(lines[1]).toContain("Reconciled");
        rmSync(directory, { recursive: true, force: true });
    });
});
