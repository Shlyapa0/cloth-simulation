// PBD Stage 2: Solve distance constraints
@group(0) @binding(0) var<uniform> uniforms : vec4f;
@group(0) @binding(1) var<storage, read_write> positions : array<vec3f>;
@group(0) @binding(2) var<storage, read_write> velocities : array<vec4f>;
@group(0) @binding(3) var<storage, read_write> inverseMasses : array<f32>;
@group(0) @binding(4) var<storage, read_write> constraintIndices : array<u32>;
@group(0) @binding(5) var<storage, read_write> restLengths : array<f32>;

@compute
@workgroup_size(64)
fn main(@builtin(global_invocation_id) globalID : vec3u) {
    let index = globalID.x;
    
    // Get constraint indices
    let constraintIdx = index * 2;
    let vertexA = constraintIndices[constraintIdx];
    let vertexB = constraintIndices[constraintIdx + 1];
    
    // Get rest length
    let restLength = restLengths[index];
    
    // Skip if either vertex is pinned
    if (inverseMasses[vertexA] == 0.0 || inverseMasses[vertexB] == 0.0) {
        return;
    }
    
    // Get current positions
    let posA = positions[vertexA];
    let posB = positions[vertexB];
    
    // Calculate current distance
    let diff = posA - posB;
    let currentDist = length(diff);
    
    // Skip if distance is zero
    if (currentDist == 0.0) {
        return;
    }
    
    // Calculate correction
    let diffRatio = (currentDist - restLength) / currentDist;
    let correction = diff * diffRatio * 0.5;
    
    // Apply correction based on inverse masses
    let invMassA = inverseMasses[vertexA];
    let invMassB = inverseMasses[vertexB];
    let totalInvMass = invMassA + invMassB;
    
    if (totalInvMass > 0.0) {
        let correctionA = correction * invMassA / totalInvMass;
        let correctionB = correction * invMassB / totalInvMass;
        
        positions[vertexA] = posA - correctionA;
        positions[vertexB] = posB + correctionB;
    }
}