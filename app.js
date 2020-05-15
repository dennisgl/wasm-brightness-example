// UI Elements
const dropzone = document.getElementById('dropzone');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const brightnessSlider = document.getElementById('brightness');
const brightnessVal = document.getElementById('brightness-val');
const perfTime = document.getElementById('perf-time');
const loadingIndicator = document.getElementById('loading');
const modeRadios = document.getElementsByName('mode');

// State
let originalImageData = null;
let currentImageData = null;
let isProcessing = false;
let processTimeout = null;

// Wait for WASM to load
let wasmReady = false;
let processBrightnessWasm = null;

// The Emscripten generated brightness.js creates a global Module object
// We can use it to know when WASM is ready and get our C functions.
if (typeof Module !== 'undefined') {
    Module.onRuntimeInitialized = () => {
        wasmReady = true;
        processBrightnessWasm = Module.cwrap('processBrightness', null, ['number', 'number', 'number', 'number']);
        console.log("WASM Module Initialized");
    };
} else {
    // If running before emcc compile
    console.warn("WASM Module not found. Run build.sh to generate it.");
}

// ----------------------------------------------------
// Image Processing Logic
// ----------------------------------------------------

function adjustBrightnessJS(originalData, intensity) {
    // 1. Clone original imageData
    const pixels = new Uint8ClampedArray(originalData.data);
    const len = pixels.length;
    
    // 2. Process
    for (let i = 0; i < len; i += 4) {
        let r = pixels[i] + intensity;
        let g = pixels[i+1] + intensity;
        let b = pixels[i+2] + intensity;
        
        pixels[i] = (r > 255) ? 255 : (r < 0 ? 0 : r);
        pixels[i+1] = (g > 255) ? 255 : (g < 0 ? 0 : g);
        pixels[i+2] = (b > 255) ? 255 : (b < 0 ? 0 : b);
    }
    return new ImageData(pixels, originalData.width, originalData.height);
}

let wasmSrcPtr = null;
let wasmDstPtr = null;
let wasmPtrLength = 0;
let lastOriginalData = null;

function adjustBrightnessWasm(originalData, intensity) {
    if (!wasmReady) {
        console.warn("WASM not ready, falling back to JS");
        return adjustBrightnessJS(originalData, intensity);
    }

    const length = originalData.data.length;
    
    // 1. Manage Wasm memory buffers
    if (wasmPtrLength !== length) {
        if (wasmSrcPtr) Module._free(wasmSrcPtr);
        if (wasmDstPtr) Module._free(wasmDstPtr);
        wasmSrcPtr = Module._malloc(length);
        wasmDstPtr = Module._malloc(length);
        wasmPtrLength = length;
        lastOriginalData = null; // Force re-copy of source
    }
    
    // 2. Copy source image to Wasm memory ONLY if it's a new image
    // This removes one major copy from the hot-path (slider ticks)
    if (lastOriginalData !== originalData) {
        const srcHeap = new Uint8Array(HEAPU8.buffer, wasmSrcPtr, length);
        // Use originalData.data directly as it is a Uint8ClampedArray
        srcHeap.set(originalData.data);
        lastOriginalData = originalData;
    }
    
    // 3. Run the SIMD C function: src -> dst
    Module._processBrightness(wasmSrcPtr, wasmDstPtr, length, intensity);
    
    // 4. Zero-copy: Create ImageData view directly from Wasm heap
    // By passing the Wasm-backed Uint8ClampedArray directly to ImageData,
    // we avoid the second major copy.
    const finalPixels = new Uint8ClampedArray(HEAPU8.buffer, wasmDstPtr, length);
    return new ImageData(finalPixels, originalData.width, originalData.height);
}


function applyBrightness() {
    if (!originalImageData) return;
    
    const intensity = parseInt(brightnessSlider.value, 10);
    brightnessVal.textContent = intensity;

    // Get selected mode
    let mode = 'js';
    for (const radio of modeRadios) {
        if (radio.checked) {
            mode = radio.value;
            break;
        }
    }

    const startTime = performance.now();

    if (mode === 'wasm') {
        currentImageData = adjustBrightnessWasm(originalImageData, intensity);
    } else {
        currentImageData = adjustBrightnessJS(originalImageData, intensity);
    }

    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(2);
    
    // Update Canvas
    ctx.putImageData(currentImageData, 0, 0);
    
    // Update UI
    perfTime.textContent = `${duration} ms`;
    
    // Add color coding to performance
    if (duration > 100) {
        perfTime.className = "text-2xl font-mono font-bold text-red-400";
    } else if (duration > 50) {
        perfTime.className = "text-2xl font-mono font-bold text-yellow-400";
    } else {
        perfTime.className = "text-2xl font-mono font-bold text-emerald-400";
    }
}

// ----------------------------------------------------
// TIFF Loading & UI Logic
// ----------------------------------------------------

async function loadTiffFromBuffer(buffer) {
    try {
        loadingIndicator.classList.remove('hidden');
        canvas.classList.add('hidden');
        
        // Ensure UI updates before heavy processing
        await new Promise(resolve => setTimeout(resolve, 50));

        const ifds = UTIF.decode(buffer);
        UTIF.decodeImage(buffer, ifds[0]);
        const rgba = UTIF.toRGBA8(ifds[0]);
        
        const width = ifds[0].width;
        const height = ifds[0].height;

        canvas.width = width;
        canvas.height = height;

        // Store original data
        originalImageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
        
        // Reset slider
        brightnessSlider.value = 0;
        brightnessVal.textContent = "0";
        perfTime.textContent = "-- ms";
        perfTime.className = "text-2xl font-mono font-bold text-emerald-400";
        
        // Initial render
        applyBrightness();

        loadingIndicator.classList.add('hidden');
        canvas.classList.remove('hidden');

    } catch (err) {
        console.error("Error loading TIFF:", err);
        alert("Failed to load TIFF image.");
        loadingIndicator.classList.add('hidden');
    }
}

async function loadDefaultImage() {
    try {
        const response = await fetch('image-00000.tiff');
        if (!response.ok) throw new Error("Network response was not ok");
        const buffer = await response.arrayBuffer();
        await loadTiffFromBuffer(buffer);
    } catch (err) {
        console.error("Could not load default image:", err);
        loadingIndicator.innerHTML = '<p class="text-red-400">Failed to load default image. Drop a TIFF to try.</p>';
    }
}

// Event Listeners
brightnessSlider.addEventListener('input', () => {
    // Basic debouncing/throttling for smoother UI if JS is slow
    if (isProcessing) return;
    
    if (processTimeout) clearTimeout(processTimeout);
    
    processTimeout = setTimeout(() => {
        isProcessing = true;
        applyBrightness();
        isProcessing = false;
    }, 10);
});

modeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        applyBrightness();
    });
});

// Drag and Drop Handling
dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        
        if (!file.name.toLowerCase().endsWith('.tiff') && !file.name.toLowerCase().endsWith('.tif')) {
            alert("Please drop a valid TIFF file.");
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            await loadTiffFromBuffer(event.target.result);
        };
        reader.readAsArrayBuffer(file);
    }
});

// Initialize
window.addEventListener('DOMContentLoaded', loadDefaultImage);
