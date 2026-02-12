// Cloth simulation using Position Based Dynamics (PBD)
export class ClothSimulation {
    constructor(device, canvas, resolution = 32) {
        this.device = device;
        this.canvas = canvas;
        this.resolution = resolution;
        this.vertexCount = resolution * resolution;
        this.triangleCount = (resolution - 1) * (resolution - 1) * 2;
        this.constraintCount = (resolution - 1) * resolution * 2 + (resolution - 1) * (resolution - 1);
        
        // Simulation parameters
        this.dt = 0.016; // Time step (60fps)
        this.gravity = 9.81;
        this.damping = 0.99;
        this.iterations = 5;
        
        // Cloth properties
        this.pinnedVertices = [
            { x: 0, y: 0 },     // Top-left
            { x: resolution - 1, y: 0 }, // Top-right
            { x: 0, y: resolution - 1 },  // Bottom-left
            { x: resolution - 1, y: resolution - 1 } // Bottom-right
        ];
        
        // Initialize buffers
        this.initializeBuffers();
        
        // Create compute pipelines
        this.createComputePipelines();
        
        // Flag to track if pipelines are ready
        this.pipelinesReady = false;
    }
    
    // Helper function to fetch shader code
    async fetchShader(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch shader ${url}: ${response.statusText}`);
        }
        return await response.text();
    }
    
    initializeBuffers() {
        // Create vertex buffers
        this.positionBuffer = this.device.createBuffer({
            size: this.vertexCount * 3 * 4, // 3 floats per vertex (x,y,z)
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        this.positionBuffer.unmap();
        
        this.velocityBuffer = this.device.createBuffer({
            size: this.vertexCount * 4 * 4, // 4 floats per vertex
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        this.velocityBuffer.unmap();
        
        this.inverseMassBuffer = this.device.createBuffer({
            size: this.vertexCount * 4, // 1 float per vertex
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        this.inverseMassBuffer.unmap();
        
        // Create index buffer - this is used for rendering, not compute
        this.indexBuffer = this.device.createBuffer({
            size: this.triangleCount * 3 * 2, // 3 indices per triangle * 2 bytes per index
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        this.indexBuffer.unmap();
        
        // Create constraint buffers
        this.constraintIndicesBuffer = this.device.createBuffer({
            size: this.constraintCount * 2 * 4, // 2 indices per constraint * 4 bytes per index
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        this.constraintIndicesBuffer.unmap();
        
        this.restLengthBuffer = this.device.createBuffer({
            size: this.constraintCount * 4, // 1 float per constraint
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        this.restLengthBuffer.unmap();
        
        // Create uniform buffer
        this.uniformBuffer = this.device.createBuffer({
            size: 4 * 16, // 16 floats for uniform data
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        
        // Initialize data
        this.initializeClothData();
    }
    
    initializeClothData() {
        // Initialize positions
        const positions = new Float32Array(this.vertexCount * 3);
        const velocities = new Float32Array(this.vertexCount * 4);
        const inverseMasses = new Float32Array(this.vertexCount);
        
        // Generate grid positions
        const width = 2.0;
        const height = 2.0;
        const spacingX = width / (this.resolution - 1);
        const spacingY = height / (this.resolution - 1);
        
        for (let i = 0; i < this.resolution; i++) {
            for (let j = 0; j < this.resolution; j++) {
                const idx = i * this.resolution + j;
                const x = (j * spacingX) - (width / 2);
                const y = 0; // Start at y=0
                const z = (i * spacingY) - (height / 2);
                
                positions[idx * 3] = x;
                positions[idx * 3 + 1] = y;
                positions[idx * 3 + 2] = z;
                velocities[idx * 4] = 0;
                velocities[idx * 4 + 1] = 0;
                velocities[idx * 4 + 2] = 0;
                velocities[idx * 4 + 3] = 0;
                // Check if vertex is pinned
                const isPinned = this.pinnedVertices.some(pin => 
                    pin.x === j && pin.y === i
                );
                inverseMasses[idx] = isPinned ? 0 : 1;
            }
        }
        
        // Upload positions
        this.device.queue.writeBuffer(this.positionBuffer, 0, positions);
        this.device.queue.writeBuffer(this.velocityBuffer, 0, velocities);
        this.device.queue.writeBuffer(this.inverseMassBuffer, 0, inverseMasses);
        
        // Initialize indices
        const indices = new Uint16Array(this.triangleCount * 3);
        let index = 0;
        
        for (let i = 0; i < this.resolution - 1; i++) {
            for (let j = 0; j < this.resolution - 1; j++) {
                const a = i * this.resolution + j;
                const b = a + 1;
                const c = (i + 1) * this.resolution + j;
                const d = c + 1;
                
                // Two triangles per grid cell
                indices[index++] = a;
                indices[index++] = b;
                indices[index++] = c;
                
                indices[index++] = b;
                indices[index++] = d;
                indices[index++] = c;
            }
        }
        
        this.device.queue.writeBuffer(this.indexBuffer, 0, indices);
        
        // Initialize constraints
        const constraintIndices = new Uint32Array(this.constraintCount * 2);
        const restLengths = new Float32Array(this.constraintCount);
        let constraintIdx = 0;
        
        // Structural constraints (horizontal and vertical)
        for (let i = 0; i < this.resolution; i++) {
            for (let j = 0; j < this.resolution; j++) {
                const idx = i * this.resolution + j;
                
                // Horizontal constraint
                if (j < this.resolution - 1) {
                    const rightIdx = i * this.resolution + (j + 1);
                    constraintIndices[constraintIdx * 2] = idx;
                    constraintIndices[constraintIdx * 2 + 1] = rightIdx;
                    const dx = positions[idx * 3] - positions[rightIdx * 3];
                    const dy = positions[idx * 3 + 1] - positions[rightIdx * 3 + 1];
                    const dz = positions[idx * 3 + 2] - positions[rightIdx * 3 + 2];
                    restLengths[constraintIdx] = Math.sqrt(dx*dx + dy*dy + dz*dz);
                    constraintIdx++;
                }
                
                // Vertical constraint
                if (i < this.resolution - 1) {
                    const belowIdx = (i + 1) * this.resolution + j;
                    constraintIndices[constraintIdx * 2] = idx;
                    constraintIndices[constraintIdx * 2 + 1] = belowIdx;
                    const dx = positions[idx * 3] - positions[belowIdx * 3];
                    const dy = positions[idx * 3 + 1] - positions[belowIdx * 3 + 1];
                    const dz = positions[idx * 3 + 2] - positions[belowIdx * 3 + 2];
                    restLengths[constraintIdx] = Math.sqrt(dx*dx + dy*dy + dz*dz);
                    constraintIdx++;
                }
            }
        }
        
        this.device.queue.writeBuffer(this.constraintIndicesBuffer, 0, constraintIndices);
        this.device.queue.writeBuffer(this.restLengthBuffer, 0, restLengths);
    }
    
    createComputePipelines() {
        // Create bind group layouts
        this.bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'uniform'
                    }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'storage'
                    }
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'storage'
                    }
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'storage'
                    }
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'storage'
                    }
                },
                {
                    binding: 5,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'storage'
                    }
                }
            ]
        });
        // Create pipeline layout
        this.pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [this.bindGroupLayout]
        });
        
        // Load shaders and create pipelines
        this.loadComputeShaders();
    }
    
    async loadComputeShaders() {
        try {
            // Load compute shaders
            const initShaderCode = await this.fetchShader('./shaders/compute-init.wgsl');
            const pbd1ShaderCode = await this.fetchShader('./shaders/compute-pbd-1.wgsl');
            const pbd2ShaderCode = await this.fetchShader('./shaders/compute-pbd-2.wgsl');
            const pbd3ShaderCode = await this.fetchShader('./shaders/compute-pbd-3.wgsl');
            const sineShaderCode = await this.fetchShader('./shaders/compute-sine.wgsl');
            
            // Create shader modules
            const initShaderModule = this.device.createShaderModule({
                code: initShaderCode
            });
            
            const pbd1ShaderModule = this.device.createShaderModule({
                code: pbd1ShaderCode
            });
            
            const pbd2ShaderModule = this.device.createShaderModule({
                code: pbd2ShaderCode
            });
            
            const pbd3ShaderModule = this.device.createShaderModule({
                code: pbd3ShaderCode
            });
            
            const sineShaderModule = this.device.createShaderModule({
                code: sineShaderCode
            });
            
            // Create compute pipelines
            this.initPipeline = this.device.createComputePipeline({
                layout: this.pipelineLayout,
                compute: {
                    module: initShaderModule,
                    entryPoint: 'main'
                }
            });
            
            this.pbd1Pipeline = this.device.createComputePipeline({
                layout: this.pipelineLayout,
                compute: {
                    module: pbd1ShaderModule,
                    entryPoint: 'main'
                }
            });
            
            this.pbd2Pipeline = this.device.createComputePipeline({
                layout: this.pipelineLayout,
                compute: {
                    module: pbd2ShaderModule,
                    entryPoint: 'main'
                }
            });
            
            this.pbd3Pipeline = this.device.createComputePipeline({
                layout: this.pipelineLayout,
                compute: {
                    module: pbd3ShaderModule,
                    entryPoint: 'main'
                }
            });
            
            this.sinePipeline = this.device.createComputePipeline({
                layout: this.pipelineLayout,
                compute: {
                    module: sineShaderModule,
                    entryPoint: 'main'
                }
            });
            
            this.pipelinesReady = true;
            console.log('Compute pipelines created successfully');
        } catch (error) {
            console.error('Error creating compute pipelines:', error);
            // Even if there's an error, set the flag so we don't keep trying
            this.pipelinesReady = true;
        }
    }
    
    createBindGroup() {
        return this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.uniformBuffer }
                },
                {
                    binding: 1,
                    resource: { buffer: this.positionBuffer }
                },
                {
                    binding: 2,
                    resource: { buffer: this.velocityBuffer }
                },
                {
                    binding: 3,
                    resource: { buffer: this.inverseMassBuffer }
                },
                {
                    binding: 4,
                    resource: { buffer: this.constraintIndicesBuffer }
                },
                {
                    binding: 5,
                    resource: { buffer: this.restLengthBuffer }
                }
                // Note: indexBuffer is not included in compute bind group as it's only used for rendering
            ]
        });
    }
    
    updateUniforms(gravityEnabled, time) {
        const uniforms = new Float32Array([
            this.dt,
            gravityEnabled ? this.gravity : 0,
            this.damping,
            this.iterations,
            this.resolution,
            this.vertexCount,
            this.constraintCount,
            time, // Current time for sine wave
            0, 0, 0, 0, // padding
            0, 0, 0, 0  // padding
        ]);
        
        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniforms);
    }
    
    async simulate(gravityEnabled, time) {
        // Wait for pipelines to be ready (if they haven't been created yet)
        // This is a simple approach - in a real app you'd want better synchronization
        if (!this.pipelinesReady) {
            console.warn("Waiting for pipelines to be ready...");
            // Simple wait - in practice you might want to use a more sophisticated approach
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Update uniform buffer
        this.updateUniforms(gravityEnabled, time);
        
        // Create bind group
        const bindGroup = this.createBindGroup();
        
        // Create command encoder
        const commandEncoder = this.device.createCommandEncoder();
        
        // Compute pass
        const computePass = commandEncoder.beginComputePass();
        
        // Dispatch compute shaders - Check if pipelines are ready
        if (!this.pbd1Pipeline) {
            console.warn("pbd1Pipeline not ready - skipping stage 1");
        } else {
            computePass.setPipeline(this.pbd1Pipeline);
            computePass.setBindGroup(0, bindGroup);
            computePass.dispatchWorkgroups(Math.ceil(this.vertexCount / 64));
        }
        
        // PBD Stage 2: Solve distance constraints
        if (!this.pbd2Pipeline) {
            console.warn("pbd2Pipeline not ready - skipping stage 2");
        } else {
            for (let i = 0; i < this.iterations; i++) {
                computePass.setPipeline(this.pbd2Pipeline);
                computePass.setBindGroup(0, bindGroup);
                computePass.dispatchWorkgroups(Math.ceil(this.constraintCount / 64));
            }
        }
        
        // PBD Stage 3: Update velocities & positions
        if (!this.pbd3Pipeline) {
            console.warn("pbd3Pipeline not ready - skipping stage 3");
        } else {
            computePass.setPipeline(this.pbd3Pipeline);
            computePass.setBindGroup(0, bindGroup);
            computePass.dispatchWorkgroups(Math.ceil(this.vertexCount / 64));
        }
        
        // Apply sine wave to center vertex
        if (!this.sinePipeline) {
            console.warn("sinePipeline not ready - skipping sine wave");
        } else {
            computePass.setPipeline(this.sinePipeline);
            computePass.setBindGroup(0, bindGroup);
            computePass.dispatchWorkgroups(1);
        }
        
        computePass.end();
        
        // Submit commands
        this.device.queue.submit([commandEncoder.finish()]);
    }
}