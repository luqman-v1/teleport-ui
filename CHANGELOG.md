# Changelog

## [2.2.0] — 2026-08-13

### Added

- **macOS Dock Bouncing & Red Badge Count** — Automatically trigger continuous macOS Dock icon bouncing (`UserAttentionType::Critical`) and red badge count when Teleport proxy requests password or OTP re-input. Badge count dynamically updates across active database sessions and automatically clears upon input submission or window focus.

## [2.1.1] — 2026-07-06

### Fixed

- **Timer race condition on reconnect** — Session timer no longer shows incorrect elapsed time (e.g. 156:xx) when reconnecting to the same database. The bug was caused by a race between the old PTY session's `closed` event and the new session's timer initialization, resulting in leaked intervals or stale `timerStart` values. Added session generation counter to filter out stale backend events and proper interval cleanup on reconnect.
