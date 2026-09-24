import * as THREE from 'three'

// MeshPhysicalMaterial + vertex displacement (dent, rim, ripples, hover lift, sound-driven
// vibration) with normals rebuilt from the displaced surface, and an inner glow under the
// touch point. `uScale` scales every spatial constant, so smaller pebbles keep the same feel.

export const MAX_RIPPLES = 4

export function createSoftMaterial() {
  const uniforms = {
    uContact: { value: new THREE.Vector3(0, 10, 0) },
    uDepth: { value: 0 },
    uHover: { value: new THREE.Vector3(0, 10, 0) },
    uHoverAmt: { value: 0 },
    uRipples: { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4()) },
    uGlowColor: { value: new THREE.Color('#ff8a4c') },
    uStateColor: { value: new THREE.Color('#ffb27a') },
    uStateMix: { value: 0 },
    uBreath: { value: 0 },
    uScale: { value: 1 },
    uTime: { value: 0 },
    /** Measured loudness of this pebble's own voice (0..1): the surface vibrates as it sounds. */
    uVibAmp: { value: 0 },
    uVibK: { value: 30 },
    uVibOmega: { value: 0 },
    uVibCenter: { value: new THREE.Vector3() },
  }

  const material = new THREE.MeshPhysicalMaterial({
    color: '#e6d3c1',
    roughness: 0.48,
    sheen: 0.6,
    sheenColor: new THREE.Color('#ffd9c0'),
    sheenRoughness: 0.6,
    // A glossy skin over a soft body: reflections bend across the dent, which is how
    // people actually read soft deformation (diffuse shading alone barely shows it).
    clearcoat: 0.7,
    clearcoatRoughness: 0.12,
  })

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform vec3 uContact;
        uniform float uDepth;
        uniform vec3 uHover;
        uniform float uHoverAmt;
        uniform vec4 uRipples[${MAX_RIPPLES}];
        uniform float uScale;
        uniform float uTime;
        uniform float uVibAmp;
        uniform float uVibK;
        uniform float uVibOmega;
        uniform vec3 uVibCenter;
        varying vec3 vObjPos;
        varying float vUp;

        float softDisp(vec3 q, vec3 n) {
          // Only the top-facing surface responds; sides and base stay put.
          float up = smoothstep(0.0, 0.6, n.y);
          vec3 d = q - uContact;
          float r2 = dot(d, d);
          float s = (0.18 + 0.12 * uDepth) * uScale; // footprint widens as the finger sinks in
          float dent = -uDepth * 0.2 * uScale * exp(-r2 / (s * s));
          float rs = 2.4 * s;
          float rim = uDepth * 0.035 * uScale * exp(-r2 / (rs * rs)); // displaced volume bulges around the dent
          vec3 h = q - uHover;
          float rise = uHoverAmt * 0.012 * uScale * exp(-dot(h, h) / (0.04 * uScale * uScale)) * (1.0 - uDepth);
          float rip = 0.0;
          for (int i = 0; i < ${MAX_RIPPLES}; i++) {
            vec4 R = uRipples[i];
            if (R.w <= 0.0) continue;
            float rr = length(q.xz - R.xy) / uScale;
            float front = R.z * 0.9;
            float env = exp(-R.z * 1.6) * (1.0 - smoothstep(front - 0.25, front + 0.05, rr)) * exp(-rr * 1.5);
            rip += R.w * 0.018 * uScale * env * sin(rr * 22.0 - R.z * 14.0);
          }
          // Drum-like standing wave (antinode at the centre), driven by the measured audio level.
          float vr = length(q.xz - uVibCenter.xz);
          float vib = uVibAmp * 0.008 * uScale * cos(vr * uVibK) * cos(uTime * uVibOmega) * exp(-vr / (0.6 * uScale));
          return (dent + rim + rise + rip + vib) * up;
        }
        vec3 softDisplaced(vec3 q, vec3 n) { return q + n * softDisp(q, n); }`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        /* glsl */ `#include <beginnormal_vertex>
        vec3 baseN = normalize(objectNormal);
        vec3 tA = normalize(cross(baseN, abs(baseN.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
        vec3 tB = cross(baseN, tA);
        const float EPS = 0.006;
        vec3 dp0 = softDisplaced(position, baseN);
        vec3 dp1 = softDisplaced(position + tA * EPS, baseN);
        vec3 dp2 = softDisplaced(position + tB * EPS, baseN);
        vec3 dn = normalize(cross(dp1 - dp0, dp2 - dp0));
        objectNormal = dot(dn, baseN) < 0.0 ? -dn : dn;
        vObjPos = position;
        vUp = smoothstep(0.0, 0.6, baseN.y);`,
      )
      .replace('#include <begin_vertex>', 'vec3 transformed = dp0;')

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform vec3 uContact;
        uniform float uDepth;
        uniform vec3 uHover;
        uniform float uHoverAmt;
        uniform vec3 uGlowColor;
        uniform vec3 uStateColor;
        uniform float uStateMix;
        uniform float uBreath;
        uniform float uScale;
        uniform float uVibAmp;
        varying vec3 vObjPos;
        varying float vUp;`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        // Cavity occlusion: a pressed hollow receives less ambient light.
        {
          vec3 cd = vObjPos - uContact;
          float cs = 1.6 * (0.18 + 0.12 * uDepth) * uScale;
          diffuseColor.rgb *= 1.0 - 0.32 * uDepth * exp(-dot(cd, cd) / (cs * cs)) * vUp;
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        // Light seems to come from inside the material under the fingertip.
        vec3 gd = vObjPos - uContact;
        vec3 hd = vObjPos - uHover;
        float s2 = uScale * uScale;
        float glow = exp(-dot(gd, gd) / ((0.06 + 0.06 * uDepth) * s2)) * (uDepth * 1.6 + uVibAmp * 0.25)
                   + exp(-dot(hd, hd) / (0.05 * s2)) * uHoverAmt * 0.12;
        totalEmissiveRadiance += uGlowColor * glow * vUp;
        // On-state: a warm inner light that breathes very slightly.
        totalEmissiveRadiance += uStateColor * uStateMix * (0.3 + 0.08 * uBreath) * (0.35 + 0.65 * vUp);`,
      )
  }
  material.customProgramCacheKey = () => 'soft-touch-v3'

  return { material, uniforms }
}
