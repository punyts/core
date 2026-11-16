import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { addListener, removeListener } from "./Reporter.js";

export interface FileLoggerConfig {
    filePath: string;
    append?: boolean;
}

let logFilePath = resolve(process.cwd(), "report.log");
let registerCategories: string | string[] = "all";
let isRegistered = false;
let truncateOnStart = true;

const ensureLogFile = () => {
    const directory = dirname(logFilePath);
    if (directory && directory !== ".") {
        mkdirSync(directory, { recursive: true });
    }

    if (!existsSync(logFilePath) || truncateOnStart) {
        writeFileSync(logFilePath, "", { encoding: "utf8" });
        truncateOnStart = false;
    }
};

export const configureFileLogger = (config: FileLoggerConfig) => {
    logFilePath = resolve(config.filePath);
    truncateOnStart = !(config.append ?? false);
};

const serializeDetails = (details?: unknown): string => {
    if (details === undefined) {
        return "";
    }

    try {
        return `\t${JSON.stringify(details)}`;
    }
    catch {
        return "\t[unserializable details]";
    }
};

export const fileLogger = (timestamp: number, category: string, message: string, details?: unknown) => {
    ensureLogFile();

    const timestampStr = timestamp.toFixed(4).padStart(16, "0");
    const line = `${timestampStr}\t${category.padEnd(20, " ")}\t${message}${serializeDetails(details)}\n`;

    try {
        appendFileSync(logFilePath, line, { encoding: "utf8" });
    }
    catch (error) {
        console.error("FileLogger failed to write log entry", error);
    }
};

export const startFileLogger = (categories: string | string[] = "all") => {
    ensureLogFile();
    registerCategories = categories;
    addListener(fileLogger, categories);
    isRegistered = true;
};

export const stopFileLogger = () => {
    if (!isRegistered) {
        return;
    }

    removeListener(fileLogger, registerCategories);
    isRegistered = false;
};
