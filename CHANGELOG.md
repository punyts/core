# Changelog

## Unreleased
- **A category list may name a family, and `isReported` says whether a category goes out.** `stateui.*` in the
  reporter's or a listener's categories takes every category that starts with `stateui.` (`categoryMatches`), and
  `isReported(category)` answers whether a report of it would reach a listener now, so a hot path skips building its
  details. The category is checked before the timestamp is taken, and the answer is kept until the categories change.
  Tests: `src/logging/Reporter.test.ts` ("should report a category of a family named with .*, and no category outside
  it", "should say whether a category is reported, following the categories and the listeners").
- **The file logger writes through one buffered stream.** Fix: it checked the file and appended to it synchronously on
  every report, which blocked a server on the disk once many categories were on. It opens one write stream when it
  starts, and `stopFileLogger()` now answers a promise that settles once what was written is flushed. Breaking:
  `stopFileLogger` returns a promise. Test: `src/logging/FileLogger.test.ts` ("should write each report of its
  categories as a line, and flush them when stopped").
