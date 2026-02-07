struct InitParams {
    width: f32,
    height: f32,
    startX: f32,
    startZ: f32,
    spacingX: f32,
    spacingZ: f32,
    resolutionX: u32,
    resolutionY: u32,
};

@group(0) @binding(0) var<uniform> params: InitParams;
@group(0) @binding(1) var<storage, read_write> positions: array<vec3<f32>>;
@group(0) @binding(2) var<storage, read_write> velocities: array<vec3<f32>>;
@group(0) @binding(3) var<storage, read_write> inverseMasses: array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    
    if (index >= params.resolutionX * params.resolutionY) {
        return;
    }
    
    let x = index % params.resolutionX;
    let z = index / params.resolutionX;
    
    // Calculate position on grid
    let posX = params.startX + f32(x) * params.spacingX;
    let posZ = params.startZ + f32(z) * params.spacingZ;
    
    positions[index] = vec3<f32>(posX, 0.0, posZ);
    velocities[index] = vec3<f32>(0.0, 0.0, 0.0);
    
    // Set inverse mass: 0.0 for pinned corners, 1.0 for others
    let isCorner = (x == 0u || x == params.resolutionX - 1u) && 
                   (z == 0u || z == params.resolutionY - 1u);
    
    inverseMasses[index] = select(1.0, 0.0, isCorner);
}

