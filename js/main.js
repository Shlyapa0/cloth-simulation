import { initWebGPU } from './webgpu-init.js';
import { ClothSimulation } from './cloth-simulation.js';
import { Renderer } from './renderer.js';
import { UIHandler } from './ui.js';
import { TestTriangle } from './test-triangle.js';
import { config } from '../utils/config.js';

class ClothSimulationApp {
    constructor() {
        this.canvas = null;
        this.device = null;
        this.context = null;
        this.format = null;
        
        this.simulation = null;
        this.renderer = null;
        this.uiHandler = null;
        this.testTriangle = null;
        
        this.testMode = false;
        
        this.isRunning = false;
        this.animationFrameId = null;
    }
    
    async initialize() {
        try {
            this.canvas = document.getElementById('canvas');
            
            // Ensure canvas has proper size before WebGPU initialization
            if (this.canvas.width === 0 || this.canvas.height === 0) {
                this.resizeCanvas();
            }
            
            // Verify canvas dimensions
            if (this.canvas.width <= 0 || this.canvas.height <= 0) {
                throw new Error('Canvas has invalid dimensions');
            }
            
            console.log(`Canvas size: ${this.canvas.width}x${this.canvas.height}`);
            
            const webgpu = await initWebGPU(this.canvas);
            this.device = webgpu.device;
            this.context = webgpu.context;
            this.format = webgpu.format;
            
            this.simulation = new ClothSimulation(this.device);
            await this.simulation.initialize();
            
            this.renderer = new Renderer(this.device, this.context, this.format);
            await this.renderer.initialize();
            
            this.testTriangle = new TestTriangle(this.device, this.format);
            await this.testTriangle.initialize();
            
            this.uiHandler = new UIHandler(this.simulation, this.renderer, this);
            this.uiHandler.initialize();
            
            window.addEventListener('resize', () => this.onResize());
            
            this.setupCameraControls();
            
            this.start();
            
            console.log('Cloth simulation initialized successfully!');
            
        } catch (error) {
            console.error('Failed to initialize:', error);
            if (this.uiHandler) {
                this.uiHandler.showError(error.message);
            } else {
                const errorContainer = document.getElementById('error-container');
                errorContainer.style.display = 'flex';
                errorContainer.querySelector('p').textContent = error.message;
            }
        }
    }
    
    setupCameraControls() {
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };
        let cameraAngleX = 0.3;
        let cameraAngleY = 0;
        const cameraDistance = 12;
        
        this.canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });
        
        window.addEventListener('mouseup', () => {
            isDragging = false;
        });
        
        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - previousMousePosition.x;
            const deltaY = e.clientY - previousMousePosition.y;
            
            cameraAngleY += deltaX * 0.01;
            cameraAngleX += deltaY * 0.01;
            
            cameraAngleX = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, cameraAngleX));
            
            config.camera.position.x = cameraDistance * Math.cos(cameraAngleX) * Math.sin(cameraAngleY);
            config.camera.position.y = cameraDistance * Math.sin(cameraAngleX) + 3;
            config.camera.position.z = cameraDistance * Math.cos(cameraAngleX) * Math.cos(cameraAngleY);
            
            this.renderer.updateUniforms();
            
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });
        
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                isDragging = true;
                previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
        });
        
        window.addEventListener('touchend', () => {
            isDragging = false;
        });
        
        window.addEventListener('touchmove', (e) => {
            if (!isDragging || e.touches.length !== 1) return;
            e.preventDefault();
            
            const deltaX = e.touches[0].clientX - previousMousePosition.x;
            const deltaY = e.touches[0].clientY - previousMousePosition.y;
            
            cameraAngleY += deltaX * 0.01;
            cameraAngleX += deltaY * 0.01;
            
            cameraAngleX = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, cameraAngleX));
            
            config.camera.position.x = cameraDistance * Math.cos(cameraAngleX) * Math.sin(cameraAngleY);
            config.camera.position.y = cameraDistance * Math.sin(cameraAngleX) + 3;
            config.camera.position.z = cameraDistance * Math.cos(cameraAngleX) * Math.cos(cameraAngleY);
            
            this.renderer.updateUniforms();
            
            previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }, { passive: false });
    }
    
    resizeCanvas() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    this.canvas.width = width;
    this.canvas.height = height;
    if (this.renderer) {
        this.renderer.resizeDepthTexture(width, height);
        this.renderer.updateUniforms();
    }
    
    if (this.testTriangle) {
        const aspect = width / height;
        this.testTriangle.setAspectRatio(aspect);
    }
}
    
    onResize() {
        this.resizeCanvas();
    }
    
    setTestMode(enabled) {
        this.testMode = enabled;
    }
    
    start() {
        this.isRunning = true;
        this.animate();
    }
    
    stop() {
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }
    
    animate() {
        if (!this.isRunning) return;
        
        const commandEncoder = this.device.createCommandEncoder();
        
        if (this.testMode) {
            this.testTriangle.render(
                commandEncoder,
                this.context,
                this.renderer.depthTexture
            );
        } else {
            this.simulation.simulate(commandEncoder);
            
            this.renderer.render(
                commandEncoder,
                this.simulation.getPositionBuffer(),
                this.simulation.getIndexBuffer(),
                this.simulation.getTriangleCount()
            );
        }
        
        this.device.queue.submit([commandEncoder.finish()]);
        
        this.uiHandler.updateFPS();
        
        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new ClothSimulationApp();
    app.initialize();
});

