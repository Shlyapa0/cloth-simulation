import { config } from '../utils/config.js';

export class UIHandler {
    constructor(simulation, renderer, app) {
        this.simulation = simulation;
        this.renderer = renderer;
        this.app = app;
        
        this.testModeToggle = null;
        this.gravityToggle = null;
        this.renderModeSelect = null;
        this.fpsElement = null;
        this.errorContainer = null;
        
        this.frameCount = 0;
        this.lastFpsUpdate = performance.now();
        this.fps = 0;
    }
    
    initialize() {
        this.testModeToggle = document.getElementById('test-mode');
        this.gravityToggle = document.getElementById('gravity-toggle');
        this.renderModeSelect = document.getElementById('render-mode');
        this.fpsElement = document.getElementById('fps');
        this.errorContainer = document.getElementById('error-container');
        
        this.gravityToggle.checked = config.simulation.gravityEnabled;
        this.renderModeSelect.value = config.rendering.wireframe ? 'wireframe' : 'solid';
        
        this.updateControlState();
        
        this.addEventListeners();
        
        this.renderer.setRenderMode(this.renderModeSelect.value);
    }
    
    addEventListeners() {
        this.testModeToggle.addEventListener('change', (e) => {
            this.app.setTestMode(e.target.checked);
            this.updateControlState();
        });
        
        this.gravityToggle.addEventListener('change', (e) => {
            config.simulation.gravityEnabled = e.target.checked;
            this.simulation.updateSimulationParams();
        });
        
        this.renderModeSelect.addEventListener('change', (e) => {
            const mode = e.target.value;
            config.rendering.wireframe = (mode === 'wireframe');
            this.renderer.setRenderMode(mode);
        });
    }
    
    updateControlState() {
        const isTestMode = this.testModeToggle.checked;
        
        this.gravityToggle.disabled = isTestMode;
        this.renderModeSelect.disabled = isTestMode;
        
        if (isTestMode) {
            this.gravityToggle.parentElement.style.opacity = '0.5';
            this.renderModeSelect.parentElement.style.opacity = '0.5';
        } else {
            this.gravityToggle.parentElement.style.opacity = '1';
            this.renderModeSelect.parentElement.style.opacity = '1';
        }
    }
    
    showError(message) {
        this.errorContainer.style.display = 'flex';
        const errorText = this.errorContainer.querySelector('p');
        errorText.textContent = message;
    }
    
    updateFPS() {
        this.frameCount++;
        const now = performance.now();
        
        if (now - this.lastFpsUpdate >= 500) {
            this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
            this.fpsElement.textContent = this.fps;
            
            console.log(`FPS: ${this.fps}`);
            
            this.frameCount = 0;
            this.lastFpsUpdate = now;
        }
    }
    
    getFPS() {
        return this.fps;
    }
}
