.PHONY: build run test clean build-all

APP_NAME=teleport-ui
MAIN_PATH=./cmd/teleport-ui/main.go
BUILD_DIR=bin

# Uses the local go binary
GO ?= go

build:
	@echo "=> Building $(APP_NAME) for current OS..."
	$(GO) build -o $(APP_NAME) $(MAIN_PATH)
	@echo "=> Build success! Execute with ./$(APP_NAME)"

build-all:
	@echo "=> Building for multiple platforms..."
	@mkdir -p $(BUILD_DIR)
	@echo "Building macOS (Apple Silicon)..."
	GOOS=darwin GOARCH=arm64 $(GO) build -o $(BUILD_DIR)/$(APP_NAME)-darwin-arm64 $(MAIN_PATH)
	@echo "Building macOS (Intel)..."
	GOOS=darwin GOARCH=amd64 $(GO) build -o $(BUILD_DIR)/$(APP_NAME)-darwin-amd64 $(MAIN_PATH)
	@echo "Building Linux (x86_64)..."
	GOOS=linux GOARCH=amd64 $(GO) build -o $(BUILD_DIR)/$(APP_NAME)-linux-amd64 $(MAIN_PATH)
	@echo "Building Linux (ARM64)..."
	GOOS=linux GOARCH=arm64 $(GO) build -o $(BUILD_DIR)/$(APP_NAME)-linux-arm64 $(MAIN_PATH)
	@echo "Building Windows (x86_64)..."
	GOOS=windows GOARCH=amd64 $(GO) build -o $(BUILD_DIR)/$(APP_NAME)-windows-amd64.exe $(MAIN_PATH)
	@echo "Building Windows (ARM64)..."
	GOOS=windows GOARCH=arm64 $(GO) build -o $(BUILD_DIR)/$(APP_NAME)-windows-arm64.exe $(MAIN_PATH)
	@echo "=> All platform builds are generated in '$(BUILD_DIR)' directory!"

run:
	@echo "=> Running $(APP_NAME)..."
	$(GO) run $(MAIN_PATH)

test:
	@echo "=> Running unit tests..."
	$(GO) test -v ./...

clean:
	@echo "=> Cleaning up..."
	rm -f $(APP_NAME)
	rm -rf $(BUILD_DIR)
