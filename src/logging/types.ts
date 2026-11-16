/**
* A simple utility for reporting, and listening for, messages from the code, which are filtered based on the message's category and the reporter's category list.
* - Control what gets reported using `categories`
* - At runtime, the reporter only reports the messages that the categories specified, which allows for dynamic reporting
* - The listener execution happens asyncronously, so it's non-blocking
* - Each listener function is called within its own asynchronous call
* - There are several built-in categories, info, warning, error, stack, metric and state
* @module
*/

/**
 * A regular expression pattern for matching string replacement characters
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
