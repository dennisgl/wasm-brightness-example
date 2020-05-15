# WebAssembly Image Brightness Adjustment

This project demonstrates how to use WebAssembly (Wasm) to accelerate client-side image processing, specifically for high-resolution images like dental X-rays.

By offloading the pixel-level manipulation from JavaScript to C compiled to Wasm, we achieve a significant performance boost, ensuring the UI remains responsive even when processing large files.

## Case Study
The motivation and technical details behind the initial implementation are documented in the blog post:
**[Fixing UI Freezes with WebAssembly: An Image Processing Case Study](https://blog.dennislin.io/posts/2020-05-16-accelerating-the-web-with-wasm)**

## Performance Comparison
- **Vanilla JavaScript**: ~250ms for 4K images (blocks the UI thread).
- **WebAssembly (V1)**: ~45ms for 4K images (as described in the blog post).
- **WebAssembly (V2 - Optimized)**: **~5-8ms** for 4K images (current implementation).

## V2 Optimizations (Beyond the Blog Post)
While the initial blog post focused on the transition from JS to C, this version includes several optimizations that push the performance into the sub-10ms zone:

1. **128-bit SIMD (Single Instruction, Multiple Data)**: 
   - Instead of processing one pixel at a time, we use WebAssembly SIMD intrinsics (`wasm_simd128.h`) to process **4 pixels (16 bytes) simultaneously**.
   - We utilize **Saturating Arithmetic** (`wasm_u8x16_add_sat`), which automatically handles the 0-255 clamping at the CPU level, removing all conditional branches (`if/else`) from the hot loop.

2. **Zero-Copy Memory Architecture**:
   - The original implementation copied data from JS to Wasm and back on every slider movement.
   - **V2** keeps a persistent source buffer in Wasm memory and uses a shared `Uint8ClampedArray` view on the Wasm heap to create the `ImageData` object. This eliminates the overhead of moving millions of pixels across the JS/Wasm boundary on every frame.

3. **Branchless Logic**:
   - By splitting the logic into separate "Increase" and "Decrease" SIMD paths, we further reduced per-pixel checks, allowing the CPU to pipeline instructions with maximum efficiency.
