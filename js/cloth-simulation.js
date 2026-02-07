import { config, getDeriveConfig } from '../utils/config.js';
import { createBuffer, createBindGroupLayout, createBindGroup, createComputePipeline } from './webgpu-init.js';

/**
 * Cloth simulation class using PBD (Position Based Dynamics)
 */
export class ClothSimulation {
    constructor(device) {
        this.device = device;
        this.derivedConfig = getDeriveConfig();
        this.time = 0.0;
        
        this.buffers = {};
        this.bindGroups = {};
        this.pipelines = {};
        
        // Initialize constraint count to 0
        this.constraintCount = 0;

        this.initialized = false;
    }
    
    /**
     * Initialize the cloth simulation
     */
    async initialize() {
        const { vertexCount, triangleCount, spacingX, spacingY, centerIndex } = this.derivedConfig;
        
        // Create all buffers
        this.createBuffers();
        
        // Create compute bind group layouts and bind groups
        this.createComputeBindGroups();
        
        // Load and create compute pipelines
        await this.createComputePipelines();
        
        // Initialize positions using init shader
        this.initializePositions();
        
        // Generate triangle indices for rendering
        await this.generateTriangleIndices();
        // Generate distance constraints
        this.generateConstraints();
        
        this.initialized = true;
    }
    
    /**
     * Create all GPU buffers
     */
    createBuffers() {
        const { vertexCount, triangleCount, spacingX, spacingY, centerIndex } = this.derivedConfig;
        
        // Position buffer (current positions)
        const positionData = new Float32Array(vertexCount * 3);
        this.buffers.positions = createBuffer(
            this.device,
            positionData.byteLength,
            GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        );
        
        // Predicted position buffer (for PBD)
        this.buffers.predictedPositions = createBuffer(
            this.device,
            positionData.byteLength,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        
        // Velocity buffer
        const velocityData = new Float32Array(vertexCount * 3);
        this.buffers.velocities = createBuffer(
            this.device,
            velocityData.byteLength,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        
        // Inverse mass buffer
        const massData = new Float32Array(vertexCount); // All 0.0 initially, set by init shader
        this.buffers.inverseMasses = createBuffer(
            this.device,
            massData.byteLength,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        
        // Triangle index buffer (for rendering)
        const indexData = new Uint16Array(triangleCount * 3);
        this.buffers.indices = createBuffer(
            this.device,
            indexData.byteLength,
            GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
        );
        
        // Constraint-related buffers
        this.buffers.constraintIndices = null; // Created after constraint generation
        this.buffers.constraintRestLengths = null; // Created after constraint generation
        
        // Uniform buffers
        // Init shader parameters
        const initParams = new Float32Array([
            config.cloth.width, config.cloth.height,
            -config.cloth.width / 2, -config.cloth.height / 2,
            spacingX, spacingY,
            config.cloth.resolutionX, config.cloth.resolutionY
        ]);
        this.buffers.initParams = createBuffer(
            this.device,
            initParams.byteLength,
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            initParams
        );
        
        // Simulation parameters (for PBD stages 1 and 3)
        const simParams = new Float32Array([
            config.simulation.dt,
            config.simulation.gravity,
            config.simulation.gravityEnabled ? 1.0 : 0.0,
            config.simulation.damping
        ]);
        this.buffers.simParams = createBuffer(
            this.device,
            simParams.byteLength,
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            simParams
        );
        
        // Constraint parameters
        const constraintParams = new Uint32Array([
            0, // iteration (updated each dispatch)
            0, // constraintCount (set after generation)
            0, 0
        ]);
        this.buffers.constraintParams = createBuffer(
            this.device,
            constraintParams.byteLength,
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            constraintParams
        );
        
        // Sine wave parameters
        const sineParams = new Float32Array([
            0.0, // time (updated each frame)
            config.wave.amplitude,
            config.wave.frequency,
            centerIndex
        ]);
        this.buffers.sineParams = createBuffer(
            this.device,
            sineParams.byteLength,
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            sineParams
        );
    }
    
    /**
     * Create compute bind group layouts and bind groups
     */
    createComputeBindGroups() {
        // Init bind group layout
        this.initBindGroupLayout = createBindGroupLayout(this.device, [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: true, bufferType: 'uniform' },
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: true, bufferType: 'read-only-storage' },
            { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: true, bufferType: 'read-only-storage' },
            { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: true, bufferType: 'read-only-storage' },
        ]);
        
        this.initBindGroup = createBindGroup(this.device, this.initBindGroupLayout, [
            { binding: 0, resource: { buffer: this.buffers.initParams } },
            { binding: 1, resource: { buffer: this.buffers.positions } },
            { binding: 2, resource: { buffer: this.buffers.velocities } },
            { binding: 3, resource: { buffer: this.buffers.inverseMasses } },
        ]);
        
        // PBD Stage 1 bind group layout
        this.pbd1BindGroupLayout = createBindGroupLayout(this.device, [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: true, bufferType: 'uniform' },
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: true, bufferType: 'read-only-storage' },
            { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: true, bufferType: 'read-only-storage' },
            { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: true, bufferType: 'read-only-storage' },
            { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: true, bufferType: 'read-only-storage' },
        ]);
        
        this.pbd1BindGroup = createBindGroup(this.device, this.pbd1BindGroupLayout, [
            { binding: 0, resource: { buffer: this.buffers.simParams } },
            { binding: 1, resource: { buffer: this.buffers.positions } },
            { binding: 2, resource: { buffer: this.buffers.velocities } },
            { binding: 3, resource: { buffer: this.buffers.predictedPositions } },
            { binding: 4, resource: { buffer: this.buffers.inverseMasses } },
        ]);
        
        // PBD Stage 2 bind group layout
        this.pbd2BindGroupLayout = createBindGroupLayout(this.device, [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: true, bufferType: 'uniform' },
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: true, bufferType: 'read-only-storage' },
            { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: true, bufferType: 'read-only-storage' },
            { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: true, bufferType: 'read-only-storage' },
            { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: true, bufferType: 'read-only-storage' },
        ]);
        
        // Create render bind group layout
        this.renderBindGroupLayout = createBindGroupLayout(this.device, [
            { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: true, bufferType: 'uniform' },
        ]);
    }
    
    /**
     * Load and create compute pipelines
     */
    async createComputePipelines() {
        const workgroupSize = config.compute.workgroupSize;
        
        // Load shader codes
        const [initCode, pbd1Code, pbd2Code, pbd3Code, sineCode] = await Promise.all([
            fetch('../shaders/compute-init.wgsl').then(r => r.text()),
            fetch('../shaders/compute-pbd-1.wgsl').then(r => r.text()),
            fetch('../shaders/compute-pbd-2.wgsl').then(r => r.text()),
            fetch('../shaders/compute-pbd-3.wgsl').then(r => r.text()),
            fetch('../shaders/compute-sine.wgsl').then(r => r.text()),
        ]);
        
        // Create compute pipelines
        this.pipelines.init = createComputePipeline(
            this.device,
            initCode,
            [this.initBindGroupLayout]
        );
        
        this.pipelines.pbd1 = createComputePipeline(
            this.device,
            pbd1Code,
            [this.pbd1BindGroupLayout]
        );
        
        this.pipelines.pbd2 = createComputePipeline(
            this.device,
            pbd2Code,
            [this.pbd2BindGroupLayout]
        );
        
        this.pipelines.pbd3 = createComputePipeline(
            this.device,
            pbd3Code,
            [this.pbd1BindGroupLayout] // Reuses same layout as pbd1
        );
        
        this.pipelines.sine = createComputePipeline(
            this.device,
            sineCode,
            [this.initBindGroupLayout] // Reuses same layout as init, adapted in shader
        );
    }
    
    /**
     * Run init shader to set initial positions
     */
    initializePositions() {
        const commandEncoder = this.device.createCommandEncoder();
        
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(this.pipelines.init);
        passEncoder.setBindGroup(0, this.initBindGroup);
        
        const vertexCount = this.derivedConfig.vertexCount;
        const workgroupSize = config.compute.workgroupSize;

        // Validate inputs
        const safeVertexCount = Math.max(0, Math.floor(vertexCount));
        const safeWorkgroupSize = Math.max(1, Math.floor(workgroupSize));
        const workgroups = Math.ceil(safeVertexCount / safeWorkgroupSize);
        const finalWorkgroups = Math.max(0, Math.floor(workgroups));

        if (finalWorkgroups > 0) {
            passEncoder.dispatchWorkgroups(finalWorkgroups);
        }
        passEncoder.end();
        
        this.device.queue.submit([commandEncoder.finish()]);
    }
    /**
     * Generate triangle indices for rendering
     */
    async generateTriangleIndices() {
        const { resolutionX, resolutionY } = config.cloth;
        
        const indices = [];
        for (let z = 0; z < resolutionY - 1; z++) {
            for (let x = 0; x < resolutionX - 1; x++) {
                const topLeft = z * resolutionX + x;
                const topRight = topLeft + 1;
                const bottomLeft = (z + 1) * resolutionX + x;
                const bottomRight = bottomLeft + 1;
                
                // Triangle 1: top-left, bottom-left, top-right
                indices.push(topLeft, bottomLeft, topRight);
                // Triangle 2: top-right, bottom-left, bottom-right
                indices.push(topRight, bottomLeft, bottomRight);
            }
        }
        
        const indexData = new Uint16Array(indices);
        this.device.queue.writeBuffer(
            this.buffers.indices,
            0,
            indexData
        );
    }
    
    /**
     * Generate distance constraints
     */
    async generateConstraints() {
        const { resolutionX, resolutionY } = config.cloth;
        const { vertexCount, spacingX, spacingY } = this.derivedConfig;
        
        // Read initial positions to compute rest lengths (async)
        const positionArrayBuffer = await this.readBufferToCPU(
            this.buffers.positions,
            0,
            vertexCount * 3 * 4  // 3 floats per vertex, 4 bytes per float
        );
        const positionData = new Float32Array(positionArrayBuffer);
        
        const constraints = [];
        const restLengths = [];

        // Get position helper
        const getPos = (idx) => [
            positionData[idx * 3],
            positionData[idx * 3 + 1],
            positionData[idx * 3 + 2]
        ];

        const distance = (a, b) => {
            const dx = a[0] - b[0];
            const dy = a[1] - b[1];
            const dz = a[2] - b[2];
            return Math.sqrt(dx * dx + dy * dy + dz * dz);
        };

        // Generate structural constraints (horizontal and vertical)
        for (let z = 0; z < resolutionY; z++) {
            for (let x = 0; x < resolutionX; x++) {
                const idx = z * resolutionX + x;

                // Horizontal constraint (connect to right neighbor)
                if (x < resolutionX - 1) {
                    const rightIdx = idx + 1;
                    constraints.push(new Uint32Array([idx, rightIdx]));
                    restLengths.push(distance(getPos(idx), getPos(rightIdx)));
                }

                // Vertical constraint (connect to bottom neighbor)
                if (z < resolutionY - 1) {
                    const bottomIdx = idx + resolutionX;
                    constraints.push(new Uint32Array([idx, bottomIdx]));
                    restLengths.push(distance(getPos(idx), getPos(bottomIdx)));
                }
            }
        }

        // Create constraint buffers
        const constraintIndexData = new Uint32Array(constraints.length * 2);
        for (let i = 0; i < constraints.length; i++) {
            constraintIndexData[i * 2] = constraints[i][0];
            constraintIndexData[i * 2 + 1] = constraints[i][1];
        }

        const constraintRestLengthData = new Float32Array(restLengths);

        this.buffers.constraintIndices = createBuffer(
            this.device,
            constraintIndexData.byteLength,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            constraintIndexData
        );

        this.buffers.constraintRestLengths = createBuffer(
            this.device,
            constraintRestLengthData.byteLength,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            constraintRestLengthData
        );
        
        // Ensure constraint count is a valid positive integer
        const constraintCount = Math.max(0, Math.floor(constraints.length));
        this.constraintCount = constraintCount;

        // Update constraint parameters
        const constraintParams = new Uint32Array([
            0, // iteration
            constraintCount,
            0, 0
        ]);
            this.device.queue.writeBuffer(
                this.buffers.constraintParams,
                0,
                constraintParams
            );
            
        // Create PBD Stage 2 bind group (now that constraint buffers exist)
        this.pbd2BindGroup = createBindGroup(this.device, this.pbd2BindGroupLayout, [
            { binding: 0, resource: { buffer: this.buffers.constraintParams } },
            { binding: 1, resource: { buffer: this.buffers.predictedPositions } },
            { binding: 2, resource: { buffer: this.buffers.constraintIndices } },
            { binding: 3, resource: { buffer: this.buffers.constraintRestLengths } },
            { binding: 4, resource: { buffer: this.buffers.inverseMasses } },
        ]);

        // Create sine wave bind group
        this.sineBindGroup = createBindGroup(this.device, this.initBindGroupLayout, [
            { binding: 0, resource: { buffer: this.buffers.sineParams } },
            { binding: 1, resource: { buffer: this.buffers.positions } },
            { binding: 2, resource: { buffer: this.buffers.velocities } },
            { binding: 3, resource: { buffer: this.buffers.inverseMasses } },
        ]);
    }

    /**
     * Update simulation parameters
     */
    updateSimulationParams() {
        const simParams = new Float32Array([
            config.simulation.dt,
            config.simulation.gravity,
            config.simulation.gravityEnabled ? 1.0 : 0.0,
            config.simulation.damping
        ]);
        this.device.queue.writeBuffer(
            this.buffers.simParams,
            0,
            simParams
        );
    }

    /**
     * Run one frame of simulation
     */
    simulate(commandEncoder) {
        const vertexCount = this.derivedConfig.vertexCount;
        const constraintCount = this.constraintCount;
        const workgroupSize = config.compute.workgroupSize;

        // Validate and ensure integer values
        const validatedVertexCount = Math.max(0, Math.floor(vertexCount));
        const validatedConstraintCount = Math.max(0, Math.floor(constraintCount));
        const validatedWorkgroupSize = Math.max(1, Math.floor(workgroupSize));

        // Ensure all values are valid numbers
        const safeVertexCount = isNaN(validatedVertexCount) ? 0 : validatedVertexCount;
        const safeConstraintCount = isNaN(validatedConstraintCount) ? 0 : validatedConstraintCount;
        const safeWorkgroupSize = isNaN(validatedWorkgroupSize) ? 1 : validatedWorkgroupSize;

        // Update time for sine wave
        this.time += config.simulation.dt;
        const sineParams = new Float32Array([
            this.time,
            config.wave.amplitude,
            config.wave.frequency,
            this.derivedConfig.centerIndex
        ]);
        this.device.queue.writeBuffer(
            this.buffers.sineParams,
            0,
            sineParams
        );

        // Stage 1: Apply external forces and predict positions
        let passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(this.pipelines.pbd1);
        passEncoder.setBindGroup(0, this.pbd1BindGroup);
        const pbd1Workgroups = Math.ceil(safeVertexCount / safeWorkgroupSize);
        // Ensure the workgroup count is a valid integer
        const finalPbd1Workgroups = Math.max(0, Math.floor(pbd1Workgroups));
        if (finalPbd1Workgroups > 0) {
            passEncoder.dispatchWorkgroups(finalPbd1Workgroups);
        }
        passEncoder.end();

        // Stage 2: Solve distance constraints (multiple iterations)
        const iterationCount = config.simulation.constraintIterations;
        for (let i = 0; i < iterationCount; i++) {
            // Update iteration in params
            const constraintParams = new Uint32Array([i, safeConstraintCount, 0, 0]);
            this.device.queue.writeBuffer(
                this.buffers.constraintParams,
                0,
                constraintParams
            );

            if (safeConstraintCount > 0) {
            passEncoder = commandEncoder.beginComputePass();
            passEncoder.setPipeline(this.pipelines.pbd2);
            passEncoder.setBindGroup(0, this.pbd2BindGroup);
                const pbd2Workgroups = Math.ceil(safeConstraintCount / safeWorkgroupSize);
                // Ensure the workgroup count is a valid integer
                const finalPbd2Workgroups = Math.max(0, Math.floor(pbd2Workgroups));
                if (finalPbd2Workgroups > 0) {
                    passEncoder.dispatchWorkgroups(finalPbd2Workgroups);
            }
            passEncoder.end();
        }
        }

        // Stage 3: Update velocities and positions
        passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(this.pipelines.pbd3);
        passEncoder.setBindGroup(0, this.pbd1BindGroup);
        const pbd3Workgroups = Math.ceil(safeVertexCount / safeWorkgroupSize);
        // Ensure the workgroup count is a valid integer
        const finalPbd3Workgroups = Math.max(0, Math.floor(pbd3Workgroups));
        if (finalPbd3Workgroups > 0) {
            passEncoder.dispatchWorkgroups(finalPbd3Workgroups);
        }
        passEncoder.end();

        // Stage 4: Apply sine wave to center vertex
        passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(this.pipelines.sine);
        passEncoder.setBindGroup(0, this.sineBindGroup);
        passEncoder.dispatchWorkgroups(1);
        passEncoder.end();
    }
    /**
     * Get position buffer for rendering
     */
    getPositionBuffer() {
        return this.buffers.positions;
    }

    /**
     * Get index buffer for rendering
     */
    getIndexBuffer() {
        return this.buffers.indices;
    }

    /**
     * Get triangle count for rendering
     */
    getTriangleCount() {
        return this.derivedConfig.triangleCount;
    }

    /**
     * Get vertex count
     */
    getVertexCount() {
        return this.derivedConfig.vertexCount;
    }

    /**
     * Read buffer data back to CPU
     */
    async readBufferToCPU(buffer, byteOffset, byteLength) {
        // Create a staging buffer for reading
        const stagingBuffer = this.device.createBuffer({
            size: byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
        // Copy from GPU buffer to staging buffer
        const copyEncoder = this.device.createCommandEncoder();
        copyEncoder.copyBufferToBuffer(
            buffer,
            byteOffset,
            stagingBuffer,
            0,
            byteLength
        );
        this.device.queue.submit([copyEncoder.finish()]);

        // Map and read the staging buffer
        await stagingBuffer.mapAsync(GPUMapMode.READ, 0, byteLength);
        const arrayBuffer = stagingBuffer.getMappedRange(0, byteLength);

        // Copy the data (slice it to create a new ArrayBuffer before unmapping)
        const result = arrayBuffer.slice(0);

        stagingBuffer.unmap();
        stagingBuffer.destroy();

        return result;
    }
}

