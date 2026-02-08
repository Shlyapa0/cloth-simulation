// Main JavaScript file for WebGPU cloth simulation
console.log('main.js loading...');

import { initWebGPU } from './js/webgpu-init.js';
import { ClothSimulation } from './js/cloth-simulation.js';
import { ClothRenderer } from './js/renderer.js';

console.log('About to import ClothUI...');
import ClothUI from './js/ui.js'; // Changed to default import
console.log('ClothUI imported successfully');

// Helper function to fetch shader code
async function fetchShader(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch shader ${url}: ${response.statusText}`);
    }
    return await response.text();
}

async function init() {
    // Initialize WebGPU
    const webgpuData = await initWebGPU();
    if (!webgpuData) {
        console.error('Failed to initialize WebGPU');
        return;
    }

    const { device, context, format, canvas } = webgpuData;

    // Initialize UI
    console.log('Creating ClothUI instance...');
    const ui = new ClothUI(); // This should work now
    console.log('ClothUI instance created successfully');

    // Initialize cloth simulation
    const cloth = new ClothSimulation(device, canvas, 32);

    // Initialize renderer
    const renderer = new ClothRenderer(device, context, format, canvas);
    
    // Animation variables
    let lastTime = 0;
    const rotationSpeed = 0.002;
    let rotationAngle = 0;

    // Handle resize events
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            const canvas = entry.target;
            const width = entry.contentBoxSize[0].inlineSize;
            const height = entry.contentBoxSize[0].blockSize;
            
            if (width !== canvas.width || height !== canvas.height) {
                canvas.width = width;
                canvas.height = height;
                
                // Recreate depth texture with new size
                renderer.updateDepthTexture(width, height);
            }
        }
    });
    
    resizeObserver.observe(canvas);

    // Render loop
    async function render(currentTime) {
        // Calculate delta time
        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;

        // Update rotation
        rotationAngle += rotationSpeed * (deltaTime / 16); // Normalize to 60fps

        // Simulate cloth
        await cloth.simulate(ui.isGravityEnabled(), currentTime / 1000);
        
        // Render cloth
        renderer.render(cloth.positionBuffer, cloth.uniformBuffer, cloth);
        
        requestAnimationFrame(render);
    }

    console.log('Starting render loop...');
    // Start rendering
    requestAnimationFrame(render);
}

// Initialize when page loads
window.addEventListener('load', init);
