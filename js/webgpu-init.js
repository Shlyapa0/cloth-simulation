import { config } from '../utils/config.js';

/**
 * Initialize WebGPU device and context
 */
export async function initWebGPU(canvas) {
    if (!navigator.gpu) {
        throw new Error('WebGPU not supported');
    }
    
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error('No appropriate GPUAdapter found');
    }
    
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device: device,
        format: format,
        alphaMode: 'opaque',
    });
    
    return { device, context, format };
}

/**
 * Create a buffer with initial data
 */
export function createBuffer(device, size, usage, data = null) {
    const bufferDescriptor = {
        size,
        usage,
        mappedAtCreation: data !== null,
    };
    
    const buffer = device.createBuffer(bufferDescriptor);
    
    if (data !== null) {
        const mappedBuffer = new Uint8Array(buffer.getMappedRange());
        mappedBuffer.set(new Uint8Array(data));
        buffer.unmap();
    }
    
    return buffer;
}

/**
 * Create bind group layout
 */
export function createBindGroupLayout(device, entries) {
    return device.createBindGroupLayout({
        entries: entries.map(entry => ({
            binding: entry.binding,
            visibility: entry.visibility,
            buffer: entry.buffer ? { type: entry.bufferType } : undefined,
        })),
    });
}

/**
 * Create bind group
 */
export function createBindGroup(device, layout, entries) {
    return device.createBindGroup({
        layout,
        entries: entries.map(entry => ({
            binding: entry.binding,
            resource: entry.resource,
        })),
    });
}

/**
 * Create compute pipeline
 */
export function createComputePipeline(device, shaderCode, bindGroupLayouts) {
    const shaderModule = device.createShaderModule({
        code: shaderCode,
    });
    
    return device.createComputePipeline({
        layout: device.createPipelineLayout({
            bindGroupLayouts,
        }),
        compute: {
            module: shaderModule,
            entryPoint: 'main',
        },
    });
}

/**
 * Create render pipeline
 */
export function createRenderPipeline(device, shaderCode, vertexFormat, bindGroupLayout, format, primitiveTopology) {
    const shaderModule = device.createShaderModule({
        code: shaderCode,
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
    
    return device.createRenderPipeline({
        layout: device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
        }),
        vertex: {
            module: shaderModule,
            entryPoint: 'main',
            buffers: [vertexBufferLayout],
        },
        fragment: {
            module: shaderModule,
            entryPoint: 'main',
            targets: [
                {
                    format,
                },
            ],
        },
        primitive: {
            topology: primitiveTopology,
            cullMode: 'back',
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus',
        },
    });
}

/**
 * Load shader code from file
 */
export async function loadShaderModule(device, filepath) {
    const response = await fetch(filepath);
    const code = await response.text();
    return device.createShaderModule({ code });
}

