# WebAssembly Image Brightness Adjustment

This project demonstrates how to use WebAssembly (Wasm) to accelerate client-side image processing, specifically for high-resolution images like dental X-rays.

By offloading the pixel-level manipulation from JavaScript to C compiled to Wasm, we ensure the UI remains responsive even when processing large files.

## Case Study
The motivation behind this simplified demo is documented in the blog post:
**[Fixing UI Freezes with WebAssembly: An Image Processing Case Study](https://blog.dennislin.io/posts/2020-05-16-accelerating-the-web-with-wasm)**
