# Changelog

## [2.1.1] — 2026-07-06

### Fixed

- **Timer race condition on reconnect** — Session timer no longer shows incorrect elapsed time (e.g. 156:xx) when reconnecting to the same database. The bug was caused by a race between the old PTY session's `closed` event and the new session's timer initialization, resulting in leaked intervals or stale `timerStart` values. Added session generation counter to filter out stale backend events and proper interval cleanup on reconnect.
