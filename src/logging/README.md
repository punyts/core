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

## Example Reporting Messages

Add `report` entries anywhere in the code, with the appropriate category.

```
import { report } from "@punyts/core";

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
import { addListener, removeListener } from "@punyts/core";

//log all reported messages
const logger = (timestamp: number, category: string, message: string, details?: any) => console.log(message);
addListener(logger);

//log only error and stack messages
const errorLogger = (timestamp: number, category: string, message: string, details?: any) => console.log(message);
addListener(errorLogger, ["error","stack"]);
```

## Categories of the libraries

The punyts libraries report under `<library>.<area>` categories (`stateui.render`, `state-sync.client`), all off by
default. A category list may name a family with `.*`: `setCategories(["stateui.*"])` turns on every category of
stateui, and a listener added with `"stateui.*"` takes them. `isReported(category)` says whether a report of the
category goes out now, so a hot path can skip building its details:

```
import { isReported, report } from "@punyts/core";

if (isReported("stateui.render")) {
    report("stateui.render", "Rendered %s", [tagName]);
}
```

Hosts turn categories on: Node hosts from `PUNYTS_REPORT` (`PUNYTS_REPORT=stateui-app.*,state-sync.*`), stateui-app's
runtime in the browser from `localStorage["punyts.report"]`. See the workspace's `docs/design/reporting.md`.
