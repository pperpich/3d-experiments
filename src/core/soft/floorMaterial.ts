import * as THREE from 'three'
import { WAVE_SPEED } from './cluster'

// The shared surface the pebbles rest on. Waves are drawn as a travelling ring in the
// normal (so reflections bend as it passes) plus a faint warm light — seeing the wave
// travel is what makes a neighbour's response read as caused rather than random.

export const MAX_RINGS = 8

export function createFloorMaterial() {
  const uniforms = {
    uRings: { value: Array.from({ length: MAX_RINGS }, () => new THREE.Vector4()) },
    uRingColor: { value: new THREE.Color('#ff9a5c') },
  }
  const material = new THREE.MeshStandardMaterial({ color: '#221d1a', roughness: 0.38, metalness: 0 })

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRingPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRingPos = (modelMatrix * vec4(position, 1.0)).xyz;')

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform vec4 uRings[${MAX_RINGS}];
        uniform vec3 uRingColor;
        varying vec3 vRingPos;
        float ringLight = 0.0;
        vec2 ringGrad = vec2(0.0);

        void accumulateRings() {
          for (int i = 0; i < ${MAX_RINGS}; i++) {
            vec4 R = uRings[i];               // x, z, age, amplitude
            if (R.w <= 0.0) continue;
            vec2 d = vRingPos.xz - R.xy;
            float r = length(d) + 1e-4;
            float w = 0.1 + R.z * 0.06;       // the ring widens as it travels
            float x = (r - R.z * ${WAVE_SPEED.toFixed(3)}) / w;
            float g = exp(-x * x);
            float env = R.w * exp(-R.z * 1.1) / (1.0 + r * 1.2);
            ringGrad += env * (-2.0 * x / w) * g * (d / r);
            ringLight += env * g;
          }
        }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
        accumulateRings();
        normal = normalize(normal - (viewMatrix * vec4(ringGrad.x, 0.0, ringGrad.y, 0.0)).xyz * 0.15);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uRingColor * ringLight * 0.2;',
      )
  }
  material.customProgramCacheKey = () => 'soft-floor-v1'
  return { material, uniforms }
}
