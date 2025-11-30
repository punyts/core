/**
* A simple utility for reporting, and listening for, messages from the code, which are filtered based on the message's category and the reporter's category list.
* - Control what gets reported using `categories`
* - At runtime, the reporter only reports the messages that the categories specified, which allows for dynamic reporting
* - The listener execution happens asyncronousy, so it's non-blocking
* - Each listener function is called within its own asyncronous call
* - There are several built-in categories, info, warning, error, stack, metric and state
* @module
*/

const ERROR_INVALID_REPORTER_LISTENER = "[Invalid Reporter Listener] The reporter listener must be a function.";
const INTERNAL_EXEPTION_PREFIX = "reporter error: ";

/**
* A regular expression pattern for matchin string replacement charaters
*/
const STR_PATT = /%s/g;

export type ListenerFn = (
    timestamp: number,
    category: string,
    message: string,
    details?: unknown
) => void;

/**
 * Reports a message to any listeners if the message's category is in the reporter's category list.
 */
export type ReportCategoryFunction = <TDetails = unknown>(
    message: string,
    details?: TDetails,
    timestamp?: number,
    snapshot?: boolean
) => void;

export interface Report {
    <TDetails = unknown>(
        category: string,
        message: string,
        details?: TDetails,
        timestamp?: number,
        snapshot?: boolean
    ): void;
    info: ReportCategoryFunction;
    extended: ReportCategoryFunction;
    log: ReportCategoryFunction;
    warning: ReportCategoryFunction;
    state: ReportCategoryFunction;
    metric: ReportCategoryFunction;
    error: (
        error: Error | string,
        details?: unknown,
        timestamp?: number,
        snapshot?: boolean
    ) => void;
}

interface Listener {
    fn: ListenerFn;
    categories: string[];
}

export interface Reporter {
    readonly report: Report;
    readonly addListener: (
        listenerFns: ListenerFn | ListenerFn[],
        listenerCategories?: string | string[]
    ) => void;
    readonly removeListener: (
        listenerFn: ListenerFn,
        categories?: string | string[]
    ) => void;
    readonly setCategories: (category: string | string[]) => void;
    readonly getCategories: () => string[];
    readonly clearListeners: () => void;
}

export interface ReporterOptions {
    categories?: string[];
}

export function createReporter(options: ReporterOptions = {}): Reporter {
    const listeners: Listener[] = [];
    let categories: string[] = options.categories
        ? [...options.categories]
        : ["info", "error", "stack"];

    function setCategories(category: string | string[]) {
        categories = Array.isArray(category) ? [...category] : [category];
    }

    function createListener(
        fn: ListenerFn,
        listenerCategories: string[]
    ): Listener {
        if (typeof fn !== "function") {
            throw new Error(
                `${ERROR_INVALID_REPORTER_LISTENER} (${typeof fn})`
            );
        }

        return {
            fn,
            categories: [...listenerCategories],
        };
    }

    async function fireListener(
        listener: Listener,
        timestamp: number,
        category: string,
        message: string,
        details?: unknown
    ) {
        try {
            if (
                listener.categories.includes(category) ||
                listener.categories.includes("all")
            ) {
                listener.fn(timestamp, category, message, details);
            }
        }
        catch (ex) {
            console.error(ex);
        }
    }

    async function fireListeners<TDetails = unknown>(
        timestamp: number,
        category: string,
        message: string,
        details?: TDetails,
        snapshot = false
    ) {
        if (listeners.length === 0) {
            return;
        }

        let resolvedDetails = details as unknown;
        if (typeof resolvedDetails === "function") {
            resolvedDetails = (resolvedDetails as () => unknown)();
        }

        let resolvedMessage = message;

        if (typeof resolvedMessage !== "string") {
            try {
                resolvedMessage = JSON.stringify(resolvedMessage);
            }
            catch (ex) {
                resolvedMessage = INTERNAL_EXEPTION_PREFIX + ex;
            }
        }

        if (snapshot && !!resolvedDetails && typeof resolvedDetails === "object") {
            try {
                resolvedDetails = JSON.parse(JSON.stringify(resolvedDetails));
            }
            catch (ex) {
                resolvedDetails = INTERNAL_EXEPTION_PREFIX + ex;
            }
        }

        if (!!resolvedDetails && typeof resolvedDetails === "object") {
            let detailKeys: string[] | undefined;
            if (!Array.isArray(resolvedDetails)) {
                detailKeys = Object.keys(resolvedDetails);
            }

            if (STR_PATT.test(resolvedMessage)) {
                let counter = -1;
                resolvedMessage = resolvedMessage.replace(
                    STR_PATT,
                    () => {
                        counter++;
                        if (detailKeys && detailKeys[counter]) {
                            const key = detailKeys[counter]!;
                            const value = (resolvedDetails as Record<string, unknown>)[key];
                            return `${key}=${String(value)}`;
                        }
                        if (Array.isArray(resolvedDetails)) {
                            const value = resolvedDetails[counter];
                            return String(value);
                        }
                        return `${counter}`;
                    }
                );
            }
        }

        const procs = listeners.map((listener) =>
            fireListener(listener, timestamp, category, resolvedMessage, resolvedDetails)
        );

        void Promise.all(procs);
    }

    const addListener = (
        listenerFns: ListenerFn | ListenerFn[],
        listenerCategories?: string | string[]
    ) => {
        const collection = Array.isArray(listenerFns)
            ? listenerFns
            : [listenerFns];
        const normalizedCategories = Array.isArray(listenerCategories)
            ? [...listenerCategories]
            : listenerCategories
                ? [listenerCategories]
                : [...categories];

        collection.forEach((listenerFn) => {
            listeners.push(createListener(listenerFn, normalizedCategories));
        });
    };

    const removeListener = (
        listenerFn: ListenerFn,
        listenerCategories: string | string[] = "all"
    ) => {
        const normalized = Array.isArray(listenerCategories)
            ? [...listenerCategories]
            : [listenerCategories];
        const serialized = JSON.stringify([...normalized].sort());
        const index = listeners.findIndex(
            (listener) =>
                listener.fn === listenerFn &&
                JSON.stringify([...listener.categories].sort()) === serialized
        );

        if (index >= 0) {
            listeners.splice(index, 1);
        }
    };

    const baseReport = <TDetails = unknown>(
        category: string,
        message: string,
        details?: TDetails,
        timestamp?: number,
        snapshot = false
    ): void => {
        const effectiveTimestamp = timestamp ?? performance.now();
        if (
            !categories.includes(category) &&
            !categories.includes("all")
        ) {
            return;
        }

        void fireListeners(
            effectiveTimestamp,
            category,
            message,
            details,
            snapshot
        );
    };

    const report = baseReport as Report;

    report.info = (message, details, timestamp, snapshot = false) => {
        baseReport("info", message, details, timestamp, snapshot);
    };

    report.extended = (message, details, timestamp, snapshot = false) => {
        baseReport("extended", message, details, timestamp, snapshot);
    };

    report.log = (message, details, timestamp, snapshot = false) => {
        baseReport("log", message, details, timestamp, snapshot);
    };

    report.warning = (message, details, timestamp, snapshot = false) => {
        baseReport("warning", message, details, timestamp, snapshot);
    };

    report.state = (message, details, timestamp, snapshot = false) => {
        baseReport("state", message, details, timestamp, snapshot);
    };

    report.metric = (message, details, timestamp, snapshot = false) => {
        baseReport("metric", message, details, timestamp, snapshot);
    };

    report.error = (error, details, timestamp, snapshot = false) => {
        if (typeof error === "string") {
            baseReport("error", error, details, timestamp, snapshot);
        }
        else {
            baseReport("error", error.message, details, timestamp, snapshot);
            if (error.stack) {
                baseReport("stack", error.stack, details, timestamp, snapshot);
            }
        }
    };

    return {
        report,
        addListener,
        removeListener,
        setCategories,
        getCategories: () => [...categories],
        clearListeners: () => {
            listeners.length = 0;
        },
    } satisfies Reporter;
}

const defaultReporter = createReporter();

export const report = defaultReporter.report;
export const addListener = defaultReporter.addListener;
export const removeListener = defaultReporter.removeListener;
export const setCategories = defaultReporter.setCategories;
export const getCategories = defaultReporter.getCategories;
export const clearListeners = defaultReporter.clearListeners;
