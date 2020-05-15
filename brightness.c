#include <emscripten.h>
#include <stdint.h>
#include <wasm_simd128.h>

// EMSCRIPTEN_KEEPALIVE tells the compiler not to strip this function as dead code
EMSCRIPTEN_KEEPALIVE
void processBrightness(const uint8_t* src, uint8_t* dst, int length, int intensity) {
    int i = 0;
    
    // Mask to only affect RGB channels, leaving Alpha (index 3, 7, 11, 15) untouched.
    // We do this by setting the increment/decrement for those lanes to 0.
    v128_t mask = wasm_i8x16_make((int8_t)0xFF, (int8_t)0xFF, (int8_t)0xFF, 0x00, 
                                  (int8_t)0xFF, (int8_t)0xFF, (int8_t)0xFF, 0x00, 
                                  (int8_t)0xFF, (int8_t)0xFF, (int8_t)0xFF, 0x00, 
                                  (int8_t)0xFF, (int8_t)0xFF, (int8_t)0xFF, 0x00);

    if (intensity >= 0) {
        v128_t v_inc = wasm_i8x16_splat((int8_t)intensity);
        v_inc = wasm_v128_and(v_inc, mask);

        for (; i <= length - 16; i += 16) {
            v128_t v_p = wasm_v128_load(&src[i]);
            // wasm_u8x16_add_sat performs unsigned addition with saturation (claps at 255)
            wasm_v128_store(&dst[i], wasm_u8x16_add_sat(v_p, v_inc));
        }
    } else {
        v128_t v_dec = wasm_i8x16_splat((int8_t)(-intensity));
        v_dec = wasm_v128_and(v_dec, mask);

        for (; i <= length - 16; i += 16) {
            v128_t v_p = wasm_v128_load(&src[i]);
            // wasm_u8x16_sub_sat performs unsigned subtraction with saturation (clamps at 0)
            wasm_v128_store(&dst[i], wasm_u8x16_sub_sat(v_p, v_dec));
        }
    }

    // Handle remaining bytes (less than 16)
    for (; i < length; i += 4) {
        int r = src[i] + intensity;
        int g = src[i+1] + intensity;
        int b = src[i+2] + intensity;
        
        dst[i]   = (r > 255) ? 255 : (r < 0 ? 0 : r);
        dst[i+1] = (g > 255) ? 255 : (g < 0 ? 0 : g);
        dst[i+2] = (b > 255) ? 255 : (b < 0 ? 0 : b);
        dst[i+3] = src[i+3]; // Keep Alpha
    }
}