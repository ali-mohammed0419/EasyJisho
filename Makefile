SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c

PROJECT_ROOT := $(abspath $(CURDIR))
PROJECT := $(PROJECT_ROOT)/JPTranslate.xcodeproj
SCHEME := JPTranslate
CONFIGURATION ?= Release
DERIVED_DATA := $(PROJECT_ROOT)/.build/DerivedData
BUILD_DIR := $(PROJECT_ROOT)/build
APP_PATH := $(BUILD_DIR)/JPTranslate.app
EXTENSION_PATH := $(APP_PATH)/Contents/PlugIns/JPTranslate Extension.appex
EXTENSION_ID := com.alimohammed.JPTranslate.Extension
LIFECYCLE_SCRIPT := $(PROJECT_ROOT)/scripts/lifecycle.sh

.DEFAULT_GOAL := help
.PHONY: help build install status uninstall clean reinstall test test-js

help:
	@echo "JPTranslate Safari Extension"
	@echo
	@echo "Targets:"
	@echo "  make build                 Build $(CONFIGURATION) to build/JPTranslate.app"
	@echo "  make install               Hot-install without restarting Safari"
	@echo "  make status                Verify exactly one Safari registration"
	@echo "  make uninstall             Remove the app without restarting Safari"
	@echo "  make clean                 Uninstall and remove generated build data"
	@echo "  make reinstall             Repeat the non-disruptive hot install"
	@echo "  make test                  Run JavaScript tests and a Debug Xcode build"
	@echo
	@echo "Options: CONFIGURATION=Debug|Release (default: Release)"
	@echo "Install and uninstall leave Safari running so its unsigned-extension"
	@echo "developer setting is preserved."

build:
	@command -v xcodebuild >/dev/null || { echo "error: Xcode command-line tools are required" >&2; exit 1; }
	@mkdir -p "$(BUILD_DIR)"
	@xcodebuild \
		-project "$(PROJECT)" \
		-scheme "$(SCHEME)" \
		-configuration "$(CONFIGURATION)" \
		-destination "platform=macOS" \
		-derivedDataPath "$(DERIVED_DATA)" \
		CONFIGURATION_BUILD_DIR="$(BUILD_DIR)" \
		CODE_SIGN_IDENTITY=- \
		CODE_SIGN_STYLE=Manual \
		DEVELOPMENT_TEAM= \
		build
	@test -d "$(APP_PATH)" || { echo "error: expected app not found at $(APP_PATH)" >&2; exit 1; }
	@test -d "$(EXTENSION_PATH)" || { echo "error: embedded Safari extension is missing" >&2; exit 1; }
	@rm -rf "$(BUILD_DIR)/JPTranslate Extension.appex" "$(BUILD_DIR)/JPTranslate Extension.appex.dSYM"
	@echo "Built $(APP_PATH)"

install:
	@/bin/bash "$(LIFECYCLE_SCRIPT)" install "$(PROJECT_ROOT)" "$(CONFIGURATION)"

status:
	@if [ -d "$(APP_PATH)" ]; then \
		echo "App: installed at $(APP_PATH)"; \
	else \
		echo "App: not installed"; \
	fi
	@registration="$$(/usr/bin/pluginkit -mAvvv -p com.apple.Safari.web-extension -i "$(EXTENSION_ID)" 2>/dev/null || true)"; \
	count="$$(printf '%s\n' "$$registration" | grep -c "$(EXTENSION_ID)(" || true)"; \
	printf '%s\n' "Safari registration ($$count):"; \
	if [ "$$count" -gt 0 ]; then printf '%s\n' "$$registration"; else echo "  not registered"; fi; \
	if [ "$$count" -ne 1 ] || ! printf '%s\n' "$$registration" | grep -Fq "Path = $(EXTENSION_PATH)"; then \
		echo "error: expected exactly one registration at $(EXTENSION_PATH)" >&2; \
		exit 1; \
	fi
	@echo "Registration is healthy. Safari controls enabled/disabled state in Settings > Extensions."

uninstall:
	@/bin/bash "$(LIFECYCLE_SCRIPT)" uninstall "$(PROJECT_ROOT)" "$(CONFIGURATION)"

clean: uninstall
	@xcodebuild \
		-project "$(PROJECT)" \
		-scheme "$(SCHEME)" \
		-configuration "$(CONFIGURATION)" \
		-derivedDataPath "$(DERIVED_DATA)" \
		CONFIGURATION_BUILD_DIR="$(BUILD_DIR)" \
		clean >/dev/null 2>&1 || true
	@test "$(DERIVED_DATA)" = "$(PROJECT_ROOT)/.build/DerivedData"
	@rm -rf "$(DERIVED_DATA)"
	@rmdir "$(PROJECT_ROOT)/.build" 2>/dev/null || true
	@echo "Removed generated build data."

reinstall: install

test: CONFIGURATION=Debug
test: test-js build

test-js:
	@command -v node >/dev/null || { echo "error: Node.js is required for JavaScript tests" >&2; exit 1; }
	@node --test "$(PROJECT_ROOT)/Tests"/*.test.js

