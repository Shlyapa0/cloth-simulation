// User interface handling for cloth simulation

class ClothUI {
    constructor() {
        this.gravityEnabled = true;
        this.setupUI();
        this.setupEventListeners();
    }
    
    setupUI() {
        // Create UI container
        const uiContainer = document.createElement('div');
        uiContainer.id = 'ui-container';
        uiContainer.innerHTML = `
            <h1>Cloth Simulation (PBD + WebGPU)</h1>
            <div class="control-group">
                <input type="checkbox" id="gravity-toggle" checked>
                <label for="gravity-toggle">Enable Gravity</label>
            </div>
            <div class="info">
                <p>Corner vertices are pinned.</p>
                <p>Center vertex oscillates creating waves.</p>
            </div>
        `;
        
        document.body.appendChild(uiContainer);
    }
    
    setupEventListeners() {
        const gravityToggle = document.getElementById('gravity-toggle');
        
        gravityToggle.addEventListener('change', (event) => {
            this.gravityEnabled = event.target.checked;
        });
    }
    
    isGravityEnabled() {
        return this.gravityEnabled;
    }
}

// Export the class
export default ClothUI;
