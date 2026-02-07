struct ConstraintParams {
    iteration: u32,
    constraintCount: u32,
    padding1: u32,
    padding2: u32,
};

@group(0) @binding(0) var<uniform> params: ConstraintParams;
@group(0) @binding(1) var<storage, read_write> predictedPositions: array<vec3<f32>>;
@group(0) @binding(2) var<storage, read> constraintIndices: array<vec2<u32>>;
@group(0) @binding(3) var<storage, read> constraintRestLengths: array<f32>;
@group(0) @binding(4) var<storage, read> inverseMasses: array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    
    if (index >= params.constraintCount) {
        return;
    }
    
    // Get constraint data
    let indices = constraintIndices[index];
    let idxA = indices.x;
    let idxB = indices.y;
    let restLength = constraintRestLengths[index];
    
    // Get inverse masses
    let invMassA = inverseMasses[idxA];
    let invMassB = inverseMasses[idxB];
    
    // Skip if both vertices are pinned
    if (invMassA + invMassB == 0.0) {
        return;
    }
    
    var posA = predictedPositions[idxA];
    var posB = predictedPositions[idxB];
    
    // Calculate current distance
    let delta = posB - posA;
   let currentDist = length(delta);
    
    // Avoid division by zero
    if (currentDist < 0.0001) {
        return;
    }
    
    // Calculate correction scalar
    // lambda = (currentDist - restLength) / (invMassA + invMassB)
    let denominator = invMassA + invMassB;
    let lambda = (currentDist - restLength) / denominator;
    
    // Calculate correction direction
    let correctionDir = delta / currentDist;
    let correction = correctionDir * lambda;
    
    // Apply corrections based on inverse masses
    predictedPositions[idxA] = posA + correction * invMassA;
    predictedPositions[idxB] = posB - correction * invMassB;
}
