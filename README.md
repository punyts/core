# @punyts/core

Shared utilities for the punyts libraries. The main entry (`@punyts/core`) is browser-safe and exports:

- The reporter: `report` (with the categories `report.info`, `report.warning`, `report.error` and the others in
  [src/logging/README.md](src/logging/README.md)), `addListener`, `removeListener`, `setCategories`, `getCategories`,
  `clearListeners`, and `createReporter` for a reporter of its own. Every punyts library logs through it.
- `consoleLogger`, a listener that writes reports to the console; the default export of
  `@punyts/core/logging/ConsoleLogger.js` has `startLogging(categories)` and `stopLogging()`.
- `getType(value)` (the lower-case `Object.prototype.toString` tag: `"object"`, `"array"`, `"date"`, …) and
  `isGenericObject(value)`.
- A JSON schema validator: `defineSchema`, `validate` (returns `{ success, data, issues }`), `assertValid`
  (throws `ValidationError`) and `withDefaults`.

The file logger uses `node:fs` and `node:path`, so it is not in the main entry and is imported only through its subpath:

```ts
import { configureFileLogger, startFileLogger, stopFileLogger } from "@punyts/core/logging/FileLogger.js";

configureFileLogger({ filePath: "logs/report.log", append: false });
startFileLogger(["error", "warning"]);
```
