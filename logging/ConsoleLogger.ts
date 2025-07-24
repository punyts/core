import { addListener, removeListener } from "./Reporter";

export const consoleLogger = (timestamp: number, category: string, message: string, details?: any) => {
    let logFn = console.log;

    if (category.includes("info"))
        logFn = console.info;
    else if (category.includes("warning"))
        logFn = console.warn;
    else if (category.includes("error"))
        logFn = console.error;

    const timestampStr = timestamp.toFixed(4).padStart(16, "0");

    logFn(`${timestampStr}\t${category.padEnd(20, " ")}\t${message}${details !== undefined && "\t" + JSON.stringify(details) || ""}`);
}

let _categories: string | string[];

export default {
    startLogging: (categories: string | string[] = "all") => {
        _categories = categories;
        addListener(consoleLogger, categories);
    }, 
    stopLogging: () => {
        removeListener(consoleLogger, _categories);
    }
}