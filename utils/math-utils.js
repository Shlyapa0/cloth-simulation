// Matrix4 utility class for 3D transformations
export class Mat4 {
    constructor() {
        this.data = new Float32Array(16);
        this.identity();
    }
    
    identity() {
        this.data.fill(0);
        this.data[0] = 1;
        this.data[5] = 1;
        this.data[10] = 1;
        this.data[15] = 1;
        return this;
    }
    
    multiply(other) {
        const result = new Float32Array(16);
        const a = this.data;
        const b = other.data;
        
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                let sum = 0;
                for (let k = 0; k < 4; k++) {
                    sum += a[i * 4 + k] * b[k * 4 + j];
                }
                result[i * 4 + j] = sum;
            }
        }
        
        this.data.set(result);
        return this;
    }
    
    copy() {
        const mat = new Mat4();
        mat.data.set(this.data);
        return mat;
    }
}

// Create a perspective projection matrix
export function createPerspectiveMatrix(fov, aspect, near, far) {
    const mat = new Mat4();
    const f = 1.0 / Math.tan((fov * Math.PI / 180) / 2);
    
    mat.data[0] = f / aspect;
    mat.data[5] = f;
    mat.data[10] = (far + near) / (near - far);
    mat.data[11] = -1;
    mat.data[14] = (2 * far * near) / (near - far);
    mat.data[15] = 0;
    
    return mat.data;
}

// Create a view matrix (look-at)
export function createViewMatrix(eye, target, up) {
    const mat = new Mat4();
    
    // Calculate camera basis vectors
    const zAxis = normalize(subtract(eye, target)); // Forward
    const xAxis = normalize(cross(up, zAxis));      // Right
    const yAxis = cross(zAxis, xAxis);              // Up
    
    // Create rotation matrix
    mat.data[0] = xAxis[0];
    mat.data[1] = yAxis[0];
    mat.data[2] = zAxis[0];
    mat.data[4] = xAxis[1];
    mat.data[5] = yAxis[1];
    mat.data[6] = zAxis[1];
    mat.data[8] = xAxis[2];
    mat.data[9] = yAxis[2];
    mat.data[10] = zAxis[2];
    
    // Create translation matrix
    const transMat = new Mat4();
    transMat.data[12] = -eye[0];
    transMat.data[13] = -eye[1];
    transMat.data[14] = -eye[2];
    
    mat.multiply(transMat);
    
    return mat.data;
}

// Vector operations
function normalize(v) {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    if (len < 0.0001) return [0, 0, 0];
    return [v[0] / len, v[1] / len, v[2] / len];
}

function subtract(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

// Combine view and projection matrices
export function createViewProjectionMatrix(view, projection) {
    const viewMat = new Mat4();
    viewMat.data.set(view);
    
    const projMat = new Mat4();
    projMat.data.set(projection);
    
    projMat.multiply(viewMat);
    return projMat.data;
}
