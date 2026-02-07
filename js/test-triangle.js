/**
 * Test Triangle - A rotating 3D triangle for testing WebGPU rendering
 */
export class TestTriangle {
    constructor(device, format) {
        this.device = device;
        this.format = format;
        
        this.vertexBuffer = null;
        this.uniformBuffer = null;
        this.bindGroup = null;
        this.pipeline = null;
        this.bindGroupLayout = null;
        
        this.rotation = 0.0;
        this.aspect = 1.0;
    }
    
    /**
     * Set aspect ratio
     */
    setAspectRatio(aspect) {
        this.aspect = aspect;
    }
    
    /**
     * Initialize the test triangle
     */
    async initialize() {
        // Define triangle vertices (with color per vertex)
        const vertices = new Float32Array([
            // Position (x, y, z)    Color (r, g, b)
             0.0,  1.0,  0.0,       1.0, 0.0, 0.0,  // Top vertex - Red
            -1.0, -1.0,  0.0,       0.0, 1.0, 0.0,  // Bottom left - Green
             1.0, -1.0,  0.0,       0.0, 0.0, 1.0,  // Bottom right - Blue
        ]);
        
        // Create vertex buffer
        this.vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);
        
        // Create uniform buffer for rotation matrix and aspect ratio
        const uniformData = new Float32Array(17);
        this.uniformBuffer = this.device.createBuffer({
            size: uniformData.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        
        // Create bind group layout
        this.bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: {
                        type: 'uniform',
                    },
                },
            ],
        });
        
        // Create bind group
        this.bindGroup = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.uniformBuffer,
                    },
                },
            ],
        });
        
        // Load shaders
        const [vertexCode, fragmentCode] = await Promise.all([
            fetch('../shaders/test-triangle-vertex.wgsl').then(r => r.text()),
            fetch('../shaders/test-triangle-fragment.wgsl').then(r => r.text()),
        ]);
        
        // Create separate shader modules (FIXED: Don't concatenate)
        const vertexShaderModule = this.device.createShaderModule({
            code: vertexCode,
        });

        const fragmentShaderModule = this.device.createShaderModule({
            code: fragmentCode,
        });
        
        // Create pipeline layout
        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [this.bindGroupLayout],
        });
        
        // Create render pipeline with separate shader modules
        this.pipeline = this.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: vertexShaderModule,
                entryPoint: 'main',
                buffers: [
                    {
                        arrayStride: 24,
                        attributes: [
                            {
                                shaderLocation: 0,
                                offset: 0,
                                format: 'float32x3',
                            },
                            {
                                shaderLocation: 1,
                                offset: 12,
                                format: 'float32x3',
                            },
                        ],
                    },
                ],
            },
            fragment: {
                module: fragmentShaderModule,
                entryPoint: 'main',
                targets: [
                    {
                        format: this.format,
                    },
                ],
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'back',
            },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: true,
                depthCompare: 'less',
            },
        });
        
        this.updateRotation();
    }
    
    /**
     * Update rotation
     */
    updateRotation() {
        this.rotation += 0.02;
        
        const cosX = Math.cos(this.rotation * 0.7);
        const sinX = Math.sin(this.rotation * 0.7);
        const cosY = Math.cos(this.rotation);
        const sinY = Math.sin(this.rotation);
        const cosZ = Math.cos(this.rotation * 1.3);
        const sinZ = Math.sin(this.rotation * 1.3);
        
        const rotationMatrix = new Float32Array([
            cosY * cosZ,  cosX * sinZ + sinX * sinY * cosZ,  sinX * sinZ - cosX * sinY * cosZ,  0.0,
            -cosY * sinZ, cosX * cosZ - sinX * sinY * sinZ,  sinX * cosZ + cosX * sinY * sinZ,  0.0,
            sinY,        -sinX * cosY,                       cosX * cosY,                       0.0,
            0.0,          0.0,                               0.0,                               1.0,
        ]);
        
        const uniformData = new Float32Array(17);
        uniformData.set(rotationMatrix, 0);
        uniformData[16] = this.aspect;
        
        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
    }
    
    /**
     * Render the triangle
     */
    render(commandEncoder, context, depthTexture) {
        try {
            this.updateRotation();
            
            const currentTexture = context.getCurrentTexture();
            
            if (!currentTexture) {
                console.error('Failed to get current texture in test triangle');
                return;
            }

            const renderPassDescriptor = {
                colorAttachments: [
                    {
                        view: currentTexture.createView(),
                        clearValue: { r: 0.1, g: 0.1, b: 0.12, a: 1.0 },
                        loadOp: 'clear',
                        storeOp: 'store',
                    },
                ],
                depthStencilAttachment: {
                    view: depthTexture ? depthTexture.createView() : null,
                    depthClearValue: 1.0,
                    depthLoadOp: 'clear',
                    depthStoreOp: 'store',
                },
            };
            
            const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
            
            passEncoder.setPipeline(this.pipeline);
            passEncoder.setBindGroup(0, this.bindGroup);
            passEncoder.setVertexBuffer(0, this.vertexBuffer);
            passEncoder.draw(3);
            
            passEncoder.end();
        } catch (error) {
            console.error('Error rendering test triangle:', error);
        }
    }
}
