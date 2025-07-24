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
* @property
*/
const STR_PATT = /%s/g;

export type ListenerFn = (timestamp: number, category: string, message: string, details?: any) => void;

interface Listener {
    fn: ListenerFn;
    categories: string[];
}

/**
 * The collection of runtime listeners
 */
const listeners: Listener[] = [];

/**
 * The reporter's list of categories to report; info, error and stack are enabled by default
 */
let categories: string[] = ["info", "error", "stack"];

/**
 * Sets which categories will be reported
 * @param category A category or array of categories to report
 */
export function setCategories(category: string | string[]) {
    if (!Array.isArray(category)) {
        categories = [category];
    }
    else {
        categories = category;
    }
}

/**
* Fires the listeners asyncronously, non-blocking, non-successive
*/
async function fireListeners(timestamp: number, category: string, message: string, details?: any) {
    if (listeners.length > 0) {
        //if details is a function then execute it now to get the value
        if (typeof details === "function")
            details = details();

        //ensure the message is a string
        if (typeof message !== "string") {
            try {
                message = JSON.stringify(message);
            }
            catch (ex) { //message is useless at this point, re-purpose
                message = INTERNAL_EXEPTION_PREFIX + ex;
            }
        }
        //if there are details, let's make sure we aren't going to keep a reference to variables that should be released
        if (!!details && typeof details === "object") {
            try {
                ///TODO: replace with cyclic parse and stringify that can handle DOM elements
                details = JSON.parse(JSON.stringify(details));
            }
            catch (ex) {
                details = INTERNAL_EXEPTION_PREFIX + ex;
            }
        }

        if (!!details && typeof details === "object") {
            let detailKeys: string[] | undefined;
            if (!Array.isArray(details)) {
                detailKeys = Object.keys(details);
            }
            //update the message with the details if %s exists
            if (STR_PATT.test(message)) {
                let counter: number = -1;
                message =
                    message.replace(STR_PATT, function replaceStr() {
                        counter++;
                        if (Array.isArray(detailKeys)) {
                            return `${detailKeys[counter]}=${details[detailKeys[counter]]}`;
                        }
                        return details[counter];
                    });
            }
        }

        const procs = listeners.map(function forEachHandler(listener) {
            return fireListener(listener, timestamp, category, message, details);
        });

        Promise.all(procs);
    }
}

/**
 * Executes a listener function if the listener category is in the reporter categories
 * @param listener
 * @param timestamp
 * @param category
 * @param message
 * @param details
 */
async function fireListener(listener: Listener, timestamp: number, category: string, message: string, details?: any) {
    try {
        if (
            listener.categories.indexOf(category) !== -1
            || listener.categories.includes("all")
        ) {
            listener.fn(timestamp, category, message, details);
        }
    }
    catch (ex) {
        console.error(ex);
        //swallow, do we care if an external reporting handler function throws an error?
    }
}

/**
* Creates a listener object
*/
function createListener(fn: ListenerFn, categories: string[]): Listener {
    if (typeof fn !== "function") {
        throw new Error(
            `${ERROR_INVALID_REPORTER_LISTENER} (${typeof fn})`
        );
    }

    return {
        fn,
        categories
    };
}

/**
 * Adds one or more listener functions, with the categories to listen for, to the listeners collection
 * @param listenerFns
 * @param categories
 */
export function addListener(listenerFns: ListenerFn | ListenerFn[], listenerCategories?: string | string[]) {
    if (!Array.isArray(listenerFns)) {
        listenerFns = [listenerFns];
    }
    if (!Array.isArray(listenerCategories)) {
        if (listenerCategories)
            listenerCategories = [listenerCategories];
        else
            listenerCategories = categories;
    }
    listenerFns.forEach(function (listenerFn) {
        listeners.push(
            createListener(listenerFn, listenerCategories)
        );
    });
}

/**
 * Removes a listener with the same listener function and category list
 * @param listenerFn
 * @param categories
 */
export function removeListener(listenerFn: ListenerFn, categories: string | string[] = "all") {
    if (!Array.isArray(categories)) {
        categories = [categories];
    }
    const cats = JSON.stringify(categories.sort());
    const index = listeners.findIndex((listener) =>
        listener.fn === listenerFn &&
        JSON.stringify(listener.categories.sort()) === cats)
    ;
    if (index >= 0) {
        listeners.splice(index, 1);
    }
}

/**
 * Reports a message to any listeners if the message's category is in the reporter's category list.
 * 
 * @param category The category of the message; used to determine if the message is reported
 * @param message A string message; can include %s which will be replaced using the details array/object
 * @param details An optional value that provides context for the message; object values will be deep copied to remove all references
 * @param timestamp An optional timestamp from `performance.now` to use instead of the internal timestamp
 * @returns
 */
export const report = (category: string, message: string, details?: any, timestamp?: number) => {
    //generate a timestamp if not provided
    timestamp = timestamp || performance.now();
    //test to see if we are reporting this category
    if (categories.indexOf(category) === -1
        && categories.indexOf("all") === -1) {
        return;
    }
    //fire the listeners
    fireListeners(
        timestamp
        , category
        , message
        , details
    );
}

//*****************************************************
//add common report categories

/**
 * Reports an info category message
 */
report.info = report.bind(null, "info");

/**
 * Reports an extended category message
 */
report.extended = report.bind(null, "extended");

/**
 * Reports a log category message
 */
report.log = report.bind(null, "log");

/**
 * Reports a warning category message
 */
report.warning = report.bind(null, "warning");

/**
 * Reports a state category message
 */
report.state = report.bind(null, "state");

/**
 * Reports a state category message
 */
report.metric = report.bind(null, "metric");

/**
 * Reports an error category message, reporting both message and stack if available.
 * @param error
 * @param details
 * @param timestamp
 */
report.error = function reportError(error: Error | string, details?: any, timestamp?: number) {
    if (typeof error === "string") {
        report(
            "error"
            , error
            , details
            , timestamp
        );
    }
    else {
        report(
            "error"
            , error.message
            , details
            , timestamp
        );
        if (error.stack) {
            report(
                "stack"
                , error.stack
                , details
                , timestamp
            );
        }
    }
}