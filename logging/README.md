# Reporter and Logging System

The Reporter utility provides a mechanism to add logging messages to the codebase and controlling when those messages are reported. This provides a way to reduce logging overhead while retaining the logging entries in the code.

There are several built-in categories that can be called instead of the generic `report` function.

* log
* info
* warning
* extended
* error
* stack
* metric
* state

## Example Adding Console Logger

Add this code to the project's `App.tsx` file to initialize and deconstruct the console logger.

```
import { useEffect } from "react";
import ConsoleLogger from "@comptia/innovation.corets/src/logging/ConsoleLogger";
import { setCategories } from "@comptia/innovation.corets/src/logging/Reporter";

useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    //set the reporter's categories from the url
    if (params.has(REPORTER_CATEGORIES_PARAM)) {
        const categories = params.get(REPORTER_CATEGORIES_PARAM)?.split(",");
        if (categories)
            setCategories(categories);
    }
    //start logging
    ConsoleLogger.startLogging();
    //stop logging
    return () => ConsoleLogger.stopLogging();
}, []);
```

## Example Reporting Messages

Add `report` entries anywhere in the code, with the appropriate category.

```
import { report } from "../logging/Reporter";

//report a message for a built-in category
report.info("Some information");
report.warning("A warning");
report.error(new Error("This is an error"));

//report a message for a dynamic category
report("scene-update", "Message for the scene update");

//report a message with details that are used in the message
report.info("Information about %s and %s", ["this","that"]);
```

## Example Listening for Messages

Loggers like the Console Logger can be created to log the messages to anywhere.

```
import { addListener, removeListener } from "./Reporter";

//log all reported messages
const logger = (timestamp: number, category: string, message: string, details?: any) => console.log(message);
addListener(logger);

//log only error and stack messages
const errorLogger = (timestamp: number, category: string, message: string, details?: any) => console.log(message);
addListener(errorLogger, ["error","stack"]);
```