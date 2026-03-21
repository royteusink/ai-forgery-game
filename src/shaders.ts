import * as THREE from 'three'

const commonVertex = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

// Gedeelde noise functies
const noiseLib = `
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0); // quintic smoothstep
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p, int octaves) {
    float val = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    for (int i = 0; i < 6; i++) {
      if (i >= octaves) break;
      val += amp * noise(p * freq);
      freq *= 2.0;
      amp *= 0.5;
    }
    return val;
  }

  float schlickFresnel(vec3 normal, vec3 viewDir, float f0) {
    float cosTheta = max(dot(normal, viewDir), 0.0);
    return f0 + (1.0 - f0) * pow(1.0 - cosTheta, 5.0);
  }
`

const uniformHeader = `
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;
`

// Water: diep oceaanachtig met caustics en reflecties
const waterFragment = `
  ${uniformHeader}
  ${noiseLib}

  void main() {
    vec3 lightDir = normalize(vec3(0.8, 1.0, 0.6));

    // Golvende normaalverstoring
    vec2 uv1 = vUv * 4.0 + vec2(uTime * 0.08, uTime * 0.06);
    vec2 uv2 = vUv * 6.0 + vec2(-uTime * 0.05, uTime * 0.09);
    float wave1 = fbm(uv1, 4);
    float wave2 = fbm(uv2, 4);
    vec3 perturbedNormal = normalize(vWorldNormal + vec3(wave1 - 0.5, wave2 - 0.5, 0.0) * 0.35);

    // Diepte kleuren
    vec3 deepColor = vec3(0.01, 0.04, 0.18);
    vec3 midColor = uColor * 0.7;
    vec3 surfaceColor = uColor * 1.1;

    float depth = fbm(vUv * 3.0 + uTime * 0.03, 5);
    vec3 baseColor = mix(deepColor, midColor, smoothstep(0.2, 0.6, depth));
    baseColor = mix(baseColor, surfaceColor, smoothstep(0.55, 0.8, depth));

    // Caustics lichtpatroon
    float c1 = fbm(vUv * 8.0 + uTime * 0.15, 4);
    float c2 = fbm(vUv * 8.0 - uTime * 0.12 + 3.7, 4);
    float caustic = pow(max(0.0, 1.0 - abs(c1 - c2) * 4.0), 3.0);
    baseColor += vec3(0.15, 0.3, 0.5) * caustic * 0.6;

    // Belichting
    float NdotL = max(dot(perturbedNormal, lightDir), 0.0);
    float diffuse = NdotL * 0.6 + 0.4;

    // Specular
    vec3 halfDir = normalize(lightDir + vViewDir);
    float spec = pow(max(dot(perturbedNormal, halfDir), 0.0), 80.0);

    // Fresnel reflectie
    float fresnel = schlickFresnel(perturbedNormal, vViewDir, 0.04);
    vec3 reflectColor = vec3(0.4, 0.6, 0.9);

    vec3 col = baseColor * diffuse;
    col += vec3(0.9, 0.95, 1.0) * spec * 0.7;
    col = mix(col, reflectColor, fresnel * 0.5);

    gl_FragColor = vec4(col, 1.0);
  }
`

// Vuur: realistische vlammen met hete kern
const fireFragment = `
  ${uniformHeader}
  ${noiseLib}

  void main() {
    vec3 lightDir = normalize(vec3(0.8, 1.0, 0.6));

    // Naar boven stromende UV voor vlameffect
    vec2 flameUV = vUv;
    flameUV.y -= uTime * 0.6;

    // Turbulente vlamvorm
    float turb = fbm(flameUV * 4.0 + uTime * 0.3, 5);
    float turb2 = fbm(flameUV * 7.0 - uTime * 0.2, 4);
    float flame = turb * 0.6 + turb2 * 0.4;

    // Intensiteit gebaseerd op positie (heter aan onderkant)
    float heightGrad = 1.0 - vUv.y;
    float intensity = flame + heightGrad * 0.25;
    intensity = smoothstep(0.2, 0.8, intensity);

    // Temperatuur kleurverdeling (zwart > rood > oranje > geel > wit)
    vec3 black = vec3(0.05, 0.0, 0.0);
    vec3 darkRed = vec3(0.5, 0.0, 0.0);
    vec3 red = vec3(0.85, 0.1, 0.0);
    vec3 orange = vec3(1.0, 0.45, 0.0);
    vec3 yellow = vec3(1.0, 0.85, 0.2);
    vec3 white = vec3(1.0, 0.95, 0.8);

    vec3 col;
    if (intensity < 0.2) col = mix(black, darkRed, intensity / 0.2);
    else if (intensity < 0.4) col = mix(darkRed, red, (intensity - 0.2) / 0.2);
    else if (intensity < 0.6) col = mix(red, orange, (intensity - 0.4) / 0.2);
    else if (intensity < 0.8) col = mix(orange, yellow, (intensity - 0.6) / 0.2);
    else col = mix(yellow, white, (intensity - 0.8) / 0.2);

    // Emissive glow - vuur is zelf-verlichtend
    float glow = smoothstep(0.3, 0.7, intensity);
    col *= 0.7 + glow * 0.8;

    // Subtiele flikkering
    float flicker = noise(vec2(uTime * 8.0, 0.0)) * 0.08;
    col *= 1.0 + flicker;

    // Lichte belichting voor 3D-gevoel
    float NdotL = max(dot(vWorldNormal, lightDir), 0.0);
    col *= 0.8 + NdotL * 0.2;

    gl_FragColor = vec4(col, 1.0);
  }
`

// Aarde: gelaagd gesteente met aders
const earthFragment = `
  ${uniformHeader}
  ${noiseLib}

  void main() {
    vec3 lightDir = normalize(vec3(0.8, 1.0, 0.6));

    // Gelaagde rots textuur
    float rock = fbm(vUv * 6.0, 6);
    float strata = sin(vUv.y * 20.0 + rock * 5.0) * 0.5 + 0.5;
    strata = smoothstep(0.3, 0.7, strata);

    // Kleurvariatie in het gesteente
    vec3 darkRock = uColor * 0.35;
    vec3 midRock = uColor * 0.75;
    vec3 lightRock = uColor * 1.1;

    vec3 baseColor = mix(darkRock, midRock, rock);
    baseColor = mix(baseColor, lightRock, strata * 0.4);

    // Mineraaladers
    float vein = fbm(vUv * 12.0 + 2.5, 5);
    float veinLine = smoothstep(0.47, 0.50, vein) * (1.0 - smoothstep(0.50, 0.53, vein));
    baseColor = mix(baseColor, uColor * 0.2, veinLine * 0.7);

    // Ruwheid / korrel
    float grain = noise(vUv * 50.0) * 0.08;
    baseColor += grain;

    // Langzame subtiele verschuiving (bijna stil)
    float shift = noise(vUv * 2.0 + uTime * 0.02) * 0.06;
    baseColor += shift;

    // Belichting
    float NdotL = max(dot(vWorldNormal, lightDir), 0.0);
    float diffuse = NdotL * 0.7 + 0.3;

    // Matte specular (ruw oppervlak)
    vec3 halfDir = normalize(lightDir + vViewDir);
    float spec = pow(max(dot(vWorldNormal, halfDir), 0.0), 8.0);

    vec3 col = baseColor * diffuse + vec3(0.15) * spec * 0.15;

    gl_FragColor = vec4(col, 1.0);
  }
`

// Lucht: etherische wolken met subsurface scattering look
const airFragment = `
  ${uniformHeader}
  ${noiseLib}

  void main() {
    vec3 lightDir = normalize(vec3(0.8, 1.0, 0.6));

    // Langzaam drijvende wolkachtige patronen
    vec2 uv1 = vUv * 2.0 + vec2(uTime * 0.04, uTime * 0.03);
    vec2 uv2 = vUv * 3.0 + vec2(-uTime * 0.03, uTime * 0.05);

    float cloud1 = fbm(uv1, 5);
    float cloud2 = fbm(uv2, 5);
    float cloudPattern = cloud1 * 0.6 + cloud2 * 0.4;

    // Zachte werveling
    float swirl = sin(vUv.x * 6.0 + cloudPattern * 3.0 + uTime * 0.2);
    swirl = swirl * 0.5 + 0.5;

    // Kleur menging - zacht en etherisch
    vec3 skyBlue = vec3(0.7, 0.85, 1.0);
    vec3 cloudWhite = vec3(0.95, 0.97, 1.0);
    vec3 baseColor = mix(uColor * 0.8, cloudWhite, cloudPattern * 0.5);
    baseColor = mix(baseColor, skyBlue, swirl * 0.15);

    // Belichting met subsurface scattering effect
    float NdotL = max(dot(vWorldNormal, lightDir), 0.0);
    float wrap = max(dot(vWorldNormal, lightDir) * 0.5 + 0.5, 0.0); // wrap lighting
    float diffuse = wrap * 0.6 + 0.4;

    // Sterke fresnel voor glasachtig/etherisch effect
    float fresnel = schlickFresnel(vWorldNormal, vViewDir, 0.02);
    vec3 rimColor = vec3(0.85, 0.92, 1.0);

    // Specular
    vec3 halfDir = normalize(lightDir + vViewDir);
    float spec = pow(max(dot(vWorldNormal, halfDir), 0.0), 32.0);

    vec3 col = baseColor * diffuse;
    col += rimColor * fresnel * 0.6;
    col += vec3(1.0) * spec * 0.3;

    gl_FragColor = vec4(col, 1.0);
  }
`

// Goud: realistisch metaal met Blinn-Phong en environment-achtige reflecties
const goldFragment = `
  ${uniformHeader}
  ${noiseLib}

  void main() {
    vec3 lightDir1 = normalize(vec3(0.8, 1.0, 0.6));
    vec3 lightDir2 = normalize(vec3(-0.5, 0.3, 0.8));

    // Goud materiaal kleuren (PBR-achtig)
    vec3 goldBase = uColor;
    vec3 goldSpec = vec3(1.0, 0.88, 0.55);
    vec3 goldDark = uColor * 0.4;

    // Microsurface variatie (gepolijst maar niet perfect)
    float micro = fbm(vUv * 30.0, 3) * 0.04;

    // Basis belichting - meerdere lichten voor metal look
    float NdotL1 = max(dot(vWorldNormal, lightDir1), 0.0);
    float NdotL2 = max(dot(vWorldNormal, lightDir2), 0.0);
    float diffuse = NdotL1 * 0.5 + NdotL2 * 0.25 + 0.25;

    vec3 baseColor = mix(goldDark, goldBase, diffuse + micro);

    // Specular highlights van beide lichten (scherp, metallic)
    vec3 halfDir1 = normalize(lightDir1 + vViewDir);
    vec3 halfDir2 = normalize(lightDir2 + vViewDir);
    float spec1 = pow(max(dot(vWorldNormal, halfDir1), 0.0), 120.0);
    float spec2 = pow(max(dot(vWorldNormal, halfDir2), 0.0), 80.0);

    // Bij metalen is de specular kleur == het metaal zelf (niet wit)
    vec3 specContrib = goldSpec * (spec1 * 1.0 + spec2 * 0.5);

    // Fresnel - metalen hebben hoge base reflectivity (f0 ~ 0.7-0.9)
    float fresnel = schlickFresnel(vWorldNormal, vViewDir, 0.75);

    // Reflectie simulatie (environment map fake)
    vec3 reflDir = reflect(-vViewDir, vWorldNormal);
    float envFake = smoothstep(-0.3, 0.8, reflDir.y) * 0.3 + 0.1;
    envFake += noise(reflDir.xy * 3.0 + uTime * 0.1) * 0.08;
    vec3 envColor = mix(goldDark, goldSpec, envFake);

    // Combineer
    vec3 col = baseColor * (1.0 - fresnel * 0.5);
    col += specContrib;
    col += envColor * fresnel * 0.6;

    // Subtiele warm shimmer (heel licht)
    float shimmer = sin(vWorldPos.x * 15.0 + vWorldPos.y * 15.0 + uTime * 1.5) * 0.02;
    col += goldSpec * shimmer;

    gl_FragColor = vec4(col, 1.0);
  }
`

// Default: mooie geanimeerde shader voor AI-gegenereerde elementen
const defaultFragment = `
  ${uniformHeader}
  ${noiseLib}

  void main() {
    vec3 lightDir = normalize(vec3(0.8, 1.0, 0.6));

    // Subtiel bewegend oppervlak patroon
    float pattern = fbm(vUv * 5.0 + uTime * 0.08, 4);
    float pattern2 = fbm(vUv * 7.0 - uTime * 0.06, 3);

    vec3 darkCol = uColor * 0.4;
    vec3 lightCol = uColor * 1.2;
    vec3 baseColor = mix(darkCol, lightCol, pattern * 0.6 + pattern2 * 0.3);

    // Belichting
    float NdotL = max(dot(vWorldNormal, lightDir), 0.0);
    float diffuse = NdotL * 0.6 + 0.4;

    // Specular
    vec3 halfDir = normalize(lightDir + vViewDir);
    float spec = pow(max(dot(vWorldNormal, halfDir), 0.0), 32.0);

    // Fresnel
    float fresnel = schlickFresnel(vWorldNormal, vViewDir, 0.04);

    // Pulserende energie
    float pulse = sin(uTime * 1.5 + pattern * 3.0) * 0.08 + 0.92;

    vec3 col = baseColor * diffuse * pulse;
    col += uColor * spec * 0.3;
    col += uColor * 0.5 * fresnel * 0.35;

    gl_FragColor = vec4(col, 1.0);
  }
`

const fragmentShaders: Record<string, string> = {
  water: waterFragment,
  fire: fireFragment,
  earth: earthFragment,
  air: airFragment,
  gold: goldFragment,
}

export function createElementMaterial(elementId: string, color: string): THREE.ShaderMaterial {
  const fragment = fragmentShaders[elementId] ?? defaultFragment

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
    },
    vertexShader: commonVertex,
    fragmentShader: fragment,
  })
}
