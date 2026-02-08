import { config } from '../utils/config.js';
import { createBuffer, createBindGroup, createBindGroupLayout, createRenderPipeline } from './webgpu-init.js';
import { createPerspectiveMatrix, createViewMatrix, createViewProjectionMatrix } from '../utils/math-utils.js';

/**
 * Sphere renderer class for drawing a rotating sphere
 */
export class SphereRenderer {
    constructor(device, context, format) {
        this.device = device;
        this.context = context;
        this.format = format;
        
        this.pipelines = {
            solid: null,
        };
        
        this.bindGroups = {
            solid: null,
        };
        
        this.bindGroupLayout = null;
        this.uniformBuffer = null;
        this.depthTexture = null;
        
        this.sphereBuffer = null;
        this.indexBuffer = null;
        this.indexCount = 0;
    }
    
    /**
     * Initialize the sphere renderer
     */
    async initialize() {
        console.log('Initializing sphere renderer...');
        
        const canvas = this.context.canvas;
        
        if (canvas.width <= 0 || canvas.height <= 0) {
            throw new Error(`Invalid canvas size: ${canvas.width}x${canvas.height}`);
        }
        
        // Create uniform buffer for view-projection matrix and color
        const uniformData = new Float32Array(16 + 4); // matrix (16) + color (4)
        const alignedSize = Math.ceil(uniformData.byteLength / 256) * 256; // Align to 256-byte boundary
        this.uniformBuffer = createBuffer(
            this.device,
            alignedSize,
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        );
        
        // Create render bind group layout
        this.bindGroupLayout = createBindGroupLayout(this.device, [
            { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: true, bufferType: 'uniform' },
        ]);
        
        // Load shaders and create render pipelines
        await this.createRenderPipelines();
        
        // Create sphere geometry
        this.createSphereGeometry();
        
        // Create initial depth texture
        this.depthTexture = this.device.createTexture({
            size: [canvas.width, canvas.height],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
        
        // Update uniform buffer with initial values
        this.updateUniforms();
        
        console.log('Sphere renderer initialized successfully');
    }
    
    /**
     * Load shaders and create render pipelines
     */
    async createRenderPipelines() {
        try {
            // Load vertex and fragment shaders as separate modules
            const [vertexCode, fragmentCode] = await Promise.all([
                fetch('../shaders/sphere-vertex.wgsl').then(r => r.text()),
                fetch('../shaders/sphere-fragment.wgsl').then(r => r.text()),
            ]);

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

            // Create solid pipeline (triangle-list)
            this.pipelines.solid = this.device.createRenderPipeline(renderPipelineDescriptor);

            // Create bind group for solid mode
            const solidBindGroup = createBindGroup(this.device, this.bindGroupLayout, [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
            ]);
            
            this.bindGroups.solid = solidBindGroup;

            console.log('Sphere render pipelines created successfully');
        } catch (error) {
            console.error('Failed to create sphere render pipelines:', error);
            throw error;
        }
    }
    
    /**
     * Create sphere geometry using a simplified approach
     */
    createSphereGeometry() {
        // Create a simple sphere using a subdivided icosahedron approach
        const radius = 2.0;
        const latitudeBands = 16;
        const longitudeBands = 32;
        
        const positions = [];
        const indices = [];
        
        // Generate vertices
        for (let lat = 0; lat <= latitudeBands; lat++) {
            const theta = lat * Math.PI / latitudeBands;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);
            
            for (let lon = 0; lon <= longitudeBands; lon++) {
                const phi = lon * 2 * Math.PI / longitudeBands;
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);
                
                const x = cosPhi * sinTheta;
                const y = cosTheta;
                const z = sinPhi * sinTheta;
                
                positions.push(x * radius, y * radius, z * radius);
            }
        }
        
        // Generate indices
        for (let lat = 0; lat < latitudeBands; lat++) {
            for (let lon = 0; lon < longitudeBands; lon++) {
                const first = lat * (longitudeBands + 1) + lon;
                const second = first + longitudeBands + 1;
                
                indices.push(first, second, first + 1);
                indices.push(second, second + 1, first + 1);
            }
        }
        
        this.indexCount = indices.length;
        
        // Create vertex buffer
        const positionData = new Float32Array(positions);
        this.sphereBuffer = createBuffer(
            this.device,
            positionData.byteLength,
            GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            positionData
        );
        
        // Create index buffer
        const indexData = new Uint16Array(indices);
        this.indexBuffer = createBuffer(
            this.device,
            indexData.byteLength,
            GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            indexData
        );
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
        
        // Create color
        const color = { r: 0.3, g: 0.8, b: 1.0, a: 1.0 }; // Blue-ish color
        
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
     * Render the sphere
     */
    render(commandEncoder) {
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
        
        // Set pipeline and bind group
        const pipeline = this.pipelines.solid;
        const bindGroup = this.bindGroups.solid;
        
        if (!pipeline) {
            console.error('Solid pipeline not found');
            passEncoder.end();
            return;
        }
        
        passEncoder.setPipeline(pipeline);
        passEncoder.setBindGroup(0, bindGroup);
        
        // Set vertex and index buffers
        passEncoder.setVertexBuffer(0, this.sphereBuffer);
        passEncoder.setIndexBuffer(this.indexBuffer, 'uint16');
        
        // Draw
        passEncoder.drawIndexed(this.indexCount);
        
        passEncoder.end();
    }
}