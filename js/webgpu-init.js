// WebGPU initialization and setup
export async function initWebGPU() {
    // Check for WebGPU support
    if (!navigator.gpu) {
        console.error('WebGPU not supported!');
        return null;
    }

    console.log('WebGPU initialized successfully');

    // Get canvas and context
    const canvas = document.getElementById('webgpu-canvas');
    
    // Set initial canvas size
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    const context = canvas.getContext('webgpu');

    // Request adapter and device
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        console.error('Failed to get GPU adapter');
        return null;
    }

    const device = await adapter.requestDevice();
    if (!device) {
        console.error('Failed to get GPU device');
        return null;
    }

    console.log('GPU device initialized successfully');

    // Configure canvas
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device: device,
        format: format,
        alphaMode: 'opaque'
    });

    console.log('Canvas configured successfully');

    return { device, context, format, canvas };
}