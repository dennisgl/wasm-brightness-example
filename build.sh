#!/bin/bash
# Compiles the brightness.c file to WebAssembly

# Ensure the script stops on first error
set -e

echo "Compiling brightness.c to WebAssembly..."

emcc brightness.c \
  -o brightness.js \
  -O3 \
  -msimd128 \
  -s WASM=1 \
  -s EXPORTED_FUNCTIONS="['_processBrightness', '_malloc', '_free']" \
  -s EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap']" \
  -s ALLOW_MEMORY_GROWTH=1

echo "Compilation successful. Generated brightness.js and brightness.wasm"
