#include <emscripten.h>
#include <stdint.h>

// EMSCRIPTEN_KEEPALIVE tells the compiler not to strip this function as dead code
EMSCRIPTEN_KEEPALIVE
void processBrightness(uint8_t* pixels, int length, int intensity) {
  // Loop through pixels. A pixel is 4 bytes (RGBA)
  for (int i = 0; i < length; i += 4) {
    int r = pixels[i] + intensity;
    int g = pixels[i+1] + intensity;
    int b = pixels[i+2] + intensity;
    
    // Clamp to 0-255 bounds
    pixels[i] = (r > 255) ? 255 : (r < 0 ? 0 : r);
    pixels[i+1] = (g > 255) ? 255 : (g < 0 ? 0 : g);
    pixels[i+2] = (b > 255) ? 255 : (b < 0 ? 0 : b);
    // Alpha channel at i+3 is unchanged
  }
}