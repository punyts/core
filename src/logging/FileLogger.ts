import { createWriteStream, mkdirSync, type WriteStream } from "node:fs";
import { dirname, resolve } from "node:path";
import { addListener, removeListener } from "./Reporter.js";

export interface FileLoggerConfig {
    filePath: string;
    append?: boolean;
}

let logFilePath = resolve(process.cwd(), "report.log");
let registerCategories: string | string[] = "all";
let append = false;
let stream: WriteStream | undefined;

/** The open stream to the log file: made once, so a report costs one buffered write and never blocks on the disk */
const openStream = (): WriteStream => {
    if (!stream) {
        mkdirSync(dirname(logFilePath), { recursive: true });
        stream = createWriteStream(logFilePath, { flags: append ? "a" : "w", encoding: "utf8" });
        stream.on("error", (error) => console.error("FileLogger failed to write log entry", error));
    }
    return stream;
};

export const configureFileLogger = (config: FileLoggerConfig) => {
    logFilePath = resolve(config.filePath);
    append = config.append ?? false;
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
    const timestampStr = timestamp.toFixed(4).padStart(16, "0");
    openStream().write(`${timestampStr}\t${category.padEnd(20, " ")}\t${message}${serializeDetails(details)}\n`);
};

export const startFileLogger = (categories: string | string[] = "all") => {
    openStream();
    registerCategories = categories;
    addListener(fileLogger, categories);
};

/** Stops logging and closes the file once what was written is flushed */
export const stopFileLogger = (): Promise<void> => {
    removeListener(fileLogger, registerCategories);
    const closing = stream;
    stream = undefined;
    return new Promise((done) => (closing ? closing.end(done) : done()));
};
