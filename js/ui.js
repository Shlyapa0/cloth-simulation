import { config } from '../utils/config.js';

export class UIHandler {
    constructor(renderer, app) {
        this.renderer = renderer;
        this.app = app;
        
        this.fpsElement = null;
        this.errorContainer = null;
        this.frameCount = 0;
        this.lastFpsUpdate = performance.now();
        this.fps = 0;
    }
    
    initialize() {
        this.fpsElement = document.getElementById('fps');
        this.errorContainer = document.getElementById('error-container');
        this.updateControlState();
        
        this.addEventListeners();
    }
    
    addEventListeners() {
        // No event listeners needed since we removed the test mode and gravity toggle
    }
    updateControlState() {
        // No control state updates needed for this simplified version
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

