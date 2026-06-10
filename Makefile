.PHONY: dev build clean

dev:
	source "$$HOME/.cargo/env" && npm run tauri dev

build:
	source "$$HOME/.cargo/env" && npm run tauri build

clean:
	rm -rf src-tauri/target
	rm -rf node_modules
	rm -rf dist
