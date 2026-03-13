# Homebox Makefile
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_DATE ?= $(shell date -u +%Y%m%d)

bootstrap: bootstrap-web bootstrap-server

bootstrap-web:
	cd web && \
	if [ -f "pnpm-lock.yaml" ]; then \
		echo "Lock file found, installing with frozen-lockfile"; \
		pnpm install --frozen-lockfile; \
	else \
		echo "Lock file not found, installing without frozen-lockfile"; \
		pnpm install; \
	fi

bootstrap-server:
	# cd server && cargo check

run-server:
	cd server && cargo run

run-web:
	cd web && pnpm start

build-server:
	cd server && HOMEBOX_ENV=production cargo build --locked --release

build-web:
	cd web && pnpm run build

build: build-web build-server

build-arch:
	rustup target add $(TARGET)
	@echo "Building version: $(VERSION) for $(TARGET)"
	cd server && HOMEBOX_ENV=production \
		cargo build --locked --release --target $(TARGET)
	mkdir -p build/arch
	cp server/target/$(TARGET)/release/homebox build/arch/homebox-$(FILE)-$(VERSION)
	cd build/arch && ln -sf homebox-$(FILE)-$(VERSION) homebox-$(FILE)

pack-arch:
	bash ./script/pack-arch.sh $(TAG)

build-all-arch: build-darwin build-windows build-linux build-android

build-darwin:
	make build-arch TARGET=aarch64-apple-darwin FILE=darwin-arm64
	make build-arch TARGET=x86_64-apple-darwin FILE=darwin-amd64

build-windows:
	make build-arch TARGET=x86_64-pc-windows-msvc FILE=windows-amd64.exe
	make build-arch TARGET=i686-pc-windows-msvc FILE=windows-386.exe

build-linux:
	# glibc targets
	make build-arch TARGET=x86_64-unknown-linux-gnu FILE=linux-amd64
	make build-arch TARGET=aarch64-unknown-linux-gnu FILE=linux-arm64
	make build-arch TARGET=i686-unknown-linux-gnu FILE=linux-386
	make build-arch TARGET=armv7-unknown-linux-gnueabihf FILE=linux-armv7
	
	# musl targets (for OpenWrt, Alpine)
	make build-arch TARGET=x86_64-unknown-linux-musl FILE=linux-amd64-musl
	make build-arch TARGET=aarch64-unknown-linux-musl FILE=linux-arm64-musl
	make build-arch TARGET=i686-unknown-linux-musl FILE=linux-386-musl
	make build-arch TARGET=armv7-unknown-linux-musleabihf FILE=linux-armv7-musl

build-android:
	make build-arch TARGET=aarch64-linux-android FILE=android-arm64
	make build-arch TARGET=armv7-linux-androideabi FILE=android-armv7

pack-all:
	@mkdir -p dist
	@cd build/arch && for file in *; do \
		if [ -f "$$file" ] && [ ! -L "$$file" ]; then \
			echo "Packaging $$file..."; \
			tar -czf ../../dist/$$file.tar.gz $$file; \
		fi \
	done
	@echo "All packages created in dist/"

checksums:
	@cd dist && \
	echo "## SHA256 Checksums" > checksums.txt && \
	for file in *; do \
		if [ -f "$$file" ]; then \
			sha256sum "$$file" >> checksums.txt; \
		fi \
	done
	@cat dist/checksums.txt

release: pack-all checksums
	@echo "Release packages ready in dist/"
	@echo "Version: $(VERSION)"

clean:
	rm -rf build/arch build/static dist
	cd server && cargo clean
	cd web && rm -rf node_modules build

distclean: clean
	cd web && rm -rf node_modules
	cd server && rm -rf target

version:
	@echo "Homebox Build System"
	@echo "Version: $(VERSION)"
	@echo "Commit: $(COMMIT)"
	@echo "Build Date: $(BUILD_DATE)"
	@rustc --version
	@cargo --version
	@pnpm --version 2>/dev/null || echo "pnpm: not installed"

help:
	@echo "Homebox Build System"
	@echo ""
	@echo "Available targets:"
	@echo "  build          - Build both web and server"
	@echo "  build-web      - Build frontend assets"
	@echo "  build-server   - Build server for current platform"
	@echo "  build-arch     - Build for specific target (set TARGET and FILE)"
	@echo "  build-all-arch - Build for all platforms"
	@echo "  build-linux    - Build Linux targets (glibc + musl)"
	@echo "  build-darwin   - Build macOS targets"
	@echo "  build-windows  - Build Windows targets"
	@echo "  build-android  - Build Android targets"
	@echo ""
	@echo "  run-server     - Run server in development mode"
	@echo "  run-web        - Run web in development mode"
	@echo ""
	@echo "  pack-all       - Create distribution packages"
	@echo "  checksums      - Generate SHA256 checksums"
	@echo "  release        - Prepare release packages"
	@echo ""
	@echo "  clean          - Clean build artifacts"
	@echo "  distclean      - Clean everything including dependencies"
	@echo "  version        - Show version information"
	@echo "  help           - Show this help message"
	@echo ""
	@echo "Variables:"
	@echo "  VERSION        - Version tag (default: from git)"
	@echo "  TARGET         - Rust target triple"
	@echo "  FILE           - Output filename"
	@echo ""
	@echo "Example:"
	@echo "  make build-arch TARGET=x86_64-unknown-linux-musl FILE=linux-amd64-musl"

.PHONY: bootstrap bootstrap-web bootstrap-server run-server run-web build-server build-web build \
        build-arch pack-arch build-all-arch build-darwin build-windows build-linux build-android \
        pack-all checksums release clean distclean version help
