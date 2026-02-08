// WebGPU rendering pipeline for cloth simulation
export class ClothRenderer {
    constructor(device, context, format, canvas) {
        this.device = device;
        this.context = context;
        this.format = format;
        this.canvas = canvas;
        
        // Create depth texture
        this.depthTexture = this.device.createTexture({
            size: [canvas.width, canvas.height],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });
        
        // Create bind group layout for rendering
        this.renderBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: {}
                }
            ]
        });
        
        // Create pipeline layout
        this.pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [this.renderBindGroupLayout]
        });
        
        // Create render pipeline
        this.createRenderPipeline();
    }
    
    // Helper function to fetch shader code
    async fetchShader(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch shader ${url}: ${response.statusText}`);
        }
        return await response.text();
    }
    
    createRenderPipeline() {
        // Load shaders
        this.fetchShader('./shaders/vertex.wgsl')
            .then(vertexShaderCode => {
                this.fetchShader('./shaders/fragment.wgsl')
                    .then(fragmentShaderCode => {
                        // Create shader modules
                        const vertexModule = this.device.createShaderModule({
                            code: vertexShaderCode
                        });
                        
                        const fragmentModule = this.device.createShaderModule({
                            code: fragmentShaderCode
                        });
                        
                        // Create render pipeline
                        this.pipeline = this.device.createRenderPipeline({
                            layout: this.pipelineLayout,
                            vertex: {
                                module: vertexModule,
                                entryPoint: 'vertex_main',
                                buffers: [{
                                    arrayStride: 3 * 4, // 3 floats per vertex (x,y,z)
                                    attributes: [
                                        { shaderLocation: 0, offset: 0, format: 'float32x3' }, // position
                                    ]
                                }]
                            },
                            fragment: {
                                module: fragmentModule,
                                entryPoint: 'fragment_main',
                                targets: [{ format: this.format }]
                            },
                            primitive: {
                                topology: 'triangle-list',
                                cullMode: 'back'
                            },
                            depthStencil: {
                                depthWriteEnabled: true,
                                depthCompare: 'less',
                                format: 'depth24plus'
                            }
                        });
                        
                        console.log('Render pipeline created successfully');
                    });
            })
            .catch(error => {
                console.error('Error loading shaders:', error);
            });
    }
    
    createRenderBindGroup(uniformBuffer) {
        return this.device.createBindGroup({
            layout: this.renderBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: uniformBuffer }
                }
            ]
        });
    }
    
    render(positionBuffer, uniformBuffer, cloth) {
        // Create command encoder
        const commandEncoder = this.device.createCommandEncoder();
        const renderPassDescriptor = {
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            }
        };

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

        // Set pipeline and bind group
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, this.createRenderBindGroup(uniformBuffer));

        // Set vertex and index buffers
        passEncoder.setVertexBuffer(0, positionBuffer);
        passEncoder.setIndexBuffer(cloth.indexBuffer, 'uint16');

        // Draw
        passEncoder.drawIndexed(cloth.triangleCount * 3);

        passEncoder.end();

        // Submit commands
        this.device.queue.submit([commandEncoder.finish()]);
    }
    
    updateDepthTexture(width, height) {
        this.depthTexture.destroy();
        this.depthTexture = this.device.createTexture({
            size: [width, height],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });
    }
}