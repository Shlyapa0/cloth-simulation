// Main JavaScript file for WebGPU rotating sphere
async function initWebGPU() {
    // Check for WebGPU support
    if (!navigator.gpu) {
        console.error('WebGPU not supported!');
        return;
    }

    console.log('WebGPU initialized successfully');

    // Get canvas and context
    const canvas = document.getElementById('webgpu-canvas');
    
    // Set initial canvas size
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    const context = canvas.getContext('webgpu');

    // Request adapter and device
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        console.error('Failed to get GPU adapter');
        return;
    }

    const device = await adapter.requestDevice();
    if (!device) {
        console.error('Failed to get GPU device');
        return;
    }

    console.log('GPU device initialized successfully');

    // Configure canvas
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device: device,
        format: format,
        alphaMode: 'opaque'
    });

    console.log('Canvas configured successfully');

    // Create sphere geometry
    const sphere = createSphere(1.0, 32);
    console.log(`Created sphere with ${sphere.vertices.length/6} vertices and ${sphere.indices.length} indices`);

    // Create vertex buffer
    const vertexBuffer = device.createBuffer({
        size: sphere.vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    });
    new Float32Array(vertexBuffer.getMappedRange()).set(sphere.vertices);
    vertexBuffer.unmap();

    // Create index buffer
    const indexBuffer = device.createBuffer({
        size: sphere.indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    });
    new Uint16Array(indexBuffer.getMappedRange()).set(sphere.indices);
    indexBuffer.unmap();

    // Load shaders
    const vertexShaderCode = await fetchShader('./shaders/vertex.wgsl');
    const fragmentShaderCode = await fetchShader('./shaders/fragment.wgsl');
    console.log('Shaders loaded successfully');

    // Create shader modules
    const vertexModule = device.createShaderModule({
        code: vertexShaderCode
    });

    const fragmentModule = device.createShaderModule({
        code: fragmentShaderCode
    });

    // Create bind group layout
    const bindGroupLayout = device.createBindGroupLayout({
        entries: []
    });

    // Create pipeline layout
    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
    });

    // Create render pipeline
    const pipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
            module: vertexModule,
            entryPoint: 'vertex_main',
            buffers: [{
                arrayStride: 6 * 4, // 6 floats per vertex (position + normal)
                attributes: [
                    { shaderLocation: 0, offset: 0, format: 'float32x3' }, // position
                    { shaderLocation: 1, offset: 3 * 4, format: 'float32x3' } // normal
                ]
            }]
        },
        fragment: {
            module: fragmentModule,
            entryPoint: 'fragment_main',
            targets: [{ format: format }]
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

    console.log('Pipeline created successfully');

    // Create depth texture
    let depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });

    // Create bind group
    const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: []
    });

    console.log('Bind group created successfully');

    // Animation variables
    let rotationAngle = 0;
    const rotationSpeed = 0.005;

    // Handle resize events
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            const canvas = entry.target;
            const width = entry.contentBoxSize[0].inlineSize;
            const height = entry.contentBoxSize[0].blockSize;
            
            if (width !== canvas.width || height !== canvas.height) {
                canvas.width = width;
                canvas.height = height;
                
                // Recreate depth texture with new size
                depthTexture.destroy();
                depthTexture = device.createTexture({
                    size: [canvas.width, canvas.height],
                    format: 'depth24plus',
                    usage: GPUTextureUsage.RENDER_ATTACHMENT
                });
            }
        }
    });
    
    resizeObserver.observe(canvas);

    // Render loop
    function render() {
        // Update rotation
        rotationAngle += rotationSpeed;

        // Create command encoder
        const commandEncoder = device.createCommandEncoder();
        const renderPassDescriptor = {
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            }
        };

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

        // Set pipeline and bind group
        passEncoder.setPipeline(pipeline);
        passEncoder.setBindGroup(0, bindGroup);

        // Set vertex and index buffers
        passEncoder.setVertexBuffer(0, vertexBuffer);
        passEncoder.setIndexBuffer(indexBuffer, 'uint16');

        // Draw
        passEncoder.drawIndexed(sphere.indices.length);

        passEncoder.end();

        // Submit commands
        device.queue.submit([commandEncoder.finish()]);

        requestAnimationFrame(render);
    }

    console.log('Starting render loop...');
    // Start rendering
    render();
}

// Helper function to create sphere geometry
function createSphere(radius, segments) {
    const vertices = [];
    const indices = [];

    // Generate vertices
    for (let i = 0; i <= segments; i++) {
        const phi = Math.PI * i / segments;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);

        for (let j = 0; j <= segments; j++) {
            const theta = 2 * Math.PI * j / segments;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);

            const x = radius * sinPhi * cosTheta;
            const y = radius * cosPhi;
            const z = radius * sinPhi * sinTheta;

            const nx = sinPhi * cosTheta;
            const ny = cosPhi;
            const nz = sinPhi * sinTheta;

            vertices.push(x, y, z, nx, ny, nz);
        }
    }

    // Generate indices
    for (let i = 0; i < segments; i++) {
        for (let j = 0; j < segments; j++) {
            const a = i * (segments + 1) + j;
            const b = a + 1;
            const c = (i + 1) * (segments + 1) + j;
            const d = c + 1;

            indices.push(a, b, c);
            indices.push(b, d, c);
        }
    }

    return {
        vertices: new Float32Array(vertices),
        indices: new Uint16Array(indices)
    };
}

// Helper function to fetch shader code
async function fetchShader(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch shader: ${response.statusText}`);
    }
    return await response.text();
}

// Initialize when page loads
window.addEventListener('load', initWebGPU);