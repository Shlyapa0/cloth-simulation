import { config } from '../utils/config.js';
import { createBuffer, createBindGroup, createBindGroupLayout, createRenderPipeline } from './webgpu-init.js';
import { createPerspectiveMatrix, createViewMatrix, createViewProjectionMatrix } from '../utils/math-utils.js';

/**
 * Renderer class for rendering the cloth simulation
 */
export class Renderer {
    constructor(device, context, format) {
        this.device = device;
        this.context = context;
        this.format = format;
        
        this.pipelines = {
            wireframe: null,
            solid: null,
        };
        
        this.bindGroups = {
            wireframe: null,
            solid: null,
        };
        
        this.bindGroupLayout = null;
        this.uniformBuffer = null;
        this.depthTexture = null;
        
        this.currentMode = 'wireframe'; // 'wireframe' or 'solid'
    }
    
    /**
     * Initialize the renderer
     */
    async initialize() {
        console.log('Initializing renderer...');
        
        const canvas = this.context.canvas;
        console.log('Canvas size:', canvas.width, canvas.height);
        
        if (canvas.width <= 0 || canvas.height <= 0) {
            throw new Error(`Invalid canvas size: ${canvas.width}x${canvas.height}`);
        }
        
        // Create uniform buffer for view-projection matrix and color
        // Note: WebGPU requires uniform buffers to be aligned to 256-byte boundaries
        const uniformData = new Float32Array(16 + 4); // matrix (16) + color (4)
        const alignedSize = Math.ceil(uniformData.byteLength / 256) * 256; // Align to 256-byte boundary
        this.uniformBuffer = createBuffer(
            this.device,
            alignedSize,
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        );
        
        console.log('Uniform buffer created with size:', alignedSize);
        
        // Create render bind group layout
        this.bindGroupLayout = createBindGroupLayout(this.device, [
            { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: true, bufferType: 'uniform' },
        ]);
        
        // Load shaders and create render pipelines
        await this.createRenderPipelines();
        console.log('Render pipelines created');
        
        // FIX: Create initial depth texture
        this.depthTexture = this.device.createTexture({
            size: [canvas.width, canvas.height],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
        
        console.log('Depth texture created with size:', canvas.width, canvas.height);
        
        // Update uniform buffer with initial values
        this.updateUniforms();
        
        console.log('Renderer initialized successfully');
    }
    
    /**
     * Load shaders and create render pipelines
     */
    async createRenderPipelines() {
        try {
        // Load vertex and fragment shaders as separate modules
        const [vertexCode, fragmentCode] = await Promise.all([
            fetch('../shaders/vertex.wgsl').then(r => r.text()),
            fetch('../shaders/fragment.wgsl').then(r => r.text()),
        ]);
        
            console.log('Vertex shader code length:', vertexCode.length);
            console.log('Fragment shader code length:', fragmentCode.length);

            // Validate shader codes
            if (!vertexCode.trim()) {
                throw new Error('Vertex shader code is empty');
            }

            if (!fragmentCode.trim()) {
                throw new Error('Fragment shader code is empty');
            }

        const vertexShaderModule = this.device.createShaderModule({
            code: vertexCode,
        });

        const fragmentShaderModule = this.device.createShaderModule({
            code: fragmentCode,
        });

        const vertexBufferLayout = {
            arrayStride: 12, // 3 floats * 4 bytes
            attributes: [
                {
                    shaderLocation: 0,
                    offset: 0,
                    format: 'float32x3',
                },
            ],
        };
        
        const renderPipelineDescriptor = {
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout],
            }),
            vertex: {
                module: vertexShaderModule,
                entryPoint: 'main',
                buffers: [vertexBufferLayout],
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
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus',
            },
        };

        // Create wireframe pipeline (line-list)
        renderPipelineDescriptor.primitive.topology = 'line-list';
        this.pipelines.wireframe = this.device.createRenderPipeline(renderPipelineDescriptor);

        // Create solid pipeline (triangle-list)
        renderPipelineDescriptor.primitive.topology = 'triangle-list';
        this.pipelines.solid = this.device.createRenderPipeline(renderPipelineDescriptor);

        // Create bind groups for both modes (they share the same layout)
        const wireframeBindGroup = createBindGroup(this.device, this.bindGroupLayout, [
            { binding: 0, resource: { buffer: this.uniformBuffer } },
        ]);
        
        const solidBindGroup = createBindGroup(this.device, this.bindGroupLayout, [
            { binding: 0, resource: { buffer: this.uniformBuffer } },
        ]);
        
        this.bindGroups.wireframe = wireframeBindGroup;
        this.bindGroups.solid = solidBindGroup;

            console.log('Render pipelines created successfully');
        } catch (error) {
            console.error('Failed to create render pipelines:', error);
            throw error;
    }
    }
    
    /**
     * Resize depth texture to match canvas size
     */
    resizeDepthTexture(width, height) {
        if (this.depthTexture) {
            this.depthTexture.destroy();
        }
        
        this.depthTexture = this.device.createTexture({
            size: [width, height],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
    }
    
    /**
     * Update uniforms (view-projection matrix and color)
     */
    updateUniforms() {
        // Create view matrix
        const view = createViewMatrix(
            config.camera.position,
            config.camera.target,
            config.camera.up
        );
        
        // Get canvas dimensions
        const canvas = this.context.canvas;
        const aspect = canvas.width / canvas.height;
        
        // Create projection matrix
        const projection = createPerspectiveMatrix(
            config.camera.fov,
            aspect,
            config.camera.near,
            config.camera.far
        );
        
        // Combine into view-projection matrix
        const viewProjection = createViewProjectionMatrix(view, projection);
        
        // Create color based on render mode
        const color = config.rendering.wireframeColor;
        
        // Combine into uniform buffer
        const uniformData = new Float32Array(16 + 4);
        uniformData.set(viewProjection, 0);
        uniformData[16] = color.r;
        uniformData[17] = color.g;
        uniformData[18] = color.b;
        uniformData[19] = color.a;
        
        this.device.queue.writeBuffer(
            this.uniformBuffer,
            0,
            uniformData
        );
    }
    
    /**
     * Set render mode
     */
    setRenderMode(mode) {
        this.currentMode = mode;
    }
    
    /**
     * Render the cloth
     */
    render(commandEncoder, positionBuffer, indexBuffer, triangleCount) {
        // Get current texture from swap chain
        const currentTexture = this.context.getCurrentTexture();
        
        if (!currentTexture) {
            console.error('Failed to get current texture from swap chain');
            return;
        }

        // Create render pass descriptor
        const renderPassDescriptor = {
            colorAttachments: [
                {
                    view: currentTexture.createView(),
                    clearValue: config.rendering.backgroundColor,
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        };
        
        // Begin render pass
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        
        // Set pipeline and bind group based on render mode
        const pipeline = this.pipelines[this.currentMode];
        const bindGroup = this.bindGroups[this.currentMode];
        
        if (!pipeline) {
            console.error(`Pipeline not found for mode: ${this.currentMode}`);
            passEncoder.end();
            return;
        }
        
        passEncoder.setPipeline(pipeline);
        passEncoder.setBindGroup(0, bindGroup);
        
        // Set vertex and index buffers
        passEncoder.setVertexBuffer(0, positionBuffer);
        passEncoder.setIndexBuffer(indexBuffer, 'uint16');
        
        // Draw
        if (this.currentMode === 'wireframe') {
            // Draw as lines (3 per triangle)
            passEncoder.drawIndexed(triangleCount * 3);
        } else {
            // Draw as triangles
            passEncoder.drawIndexed(triangleCount * 3);
        }
        
        passEncoder.end();
    }
}

