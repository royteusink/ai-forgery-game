export const prompt = (elementList: string, count: string, existingIds: string[], shaderMaxLines: number) => `You are a clever element-combining game, inspired by real science, nature and chemistry.

${elementList}

Figure out what would REALLY be created if you combine these ${count}. Think about chemistry, physics, biology or geology.
- NEVER glue two or three names together (e.g. "goldglass" or "firewater" is FORBIDDEN).
- The result must be a real existing material, substance, phenomenon or concept.
- The result MUST be something NEW. These IDs already exist and MUST NOT be used: ${existingIds.join(', ')}
- Examples: Water + Fire = Steam, Sand + Fire + Gravel = Concrete, Gold + Fire + Sand = Jewel.
- Be scientific but also surprising and fun.
Provide the result as a JSON object with exactly these fields:
- "id": lowercase, no spaces, short (e.g. "steam", "lava", "mud")
- "name": English name with capital letter (e.g. "Steam", "Lava", "Mud")
- "color": hex color code that fits the element (e.g. "#c0c0c0")
- "description": a short English description of the element (2-3 sentences, informative and fun)
- "wikipediaUrl": a URL to the relevant English Wikipedia page (https://en.wikipedia.org/wiki/...)
- "shader": GLSL fragment shader body (only the code INSIDE void main()) that visually fits the element

The shader body has access to these variables:
- uniform float uTime (time in seconds)
- uniform vec3 uColor (the element's color)
- varying vec2 vUv (UV coordinates 0-1)
- varying vec3 vWorldNormal (world space normal)
- varying vec3 vWorldPos (world space position)
- varying vec3 vViewDir (direction to camera)
- float noise(vec2 p) function (returns 0-1)
- float fbm(vec2 p, int octaves) function (fractal brownian motion)
- float schlickFresnel(vec3 normal, vec3 viewDir, float f0) function
- Write to gl_FragColor = vec4(col, 1.0);

Make the shader visually fitting for the element. E.g. lava = glowing with flowing texture, steam = cloudy and semi-transparent, ice = crystalline with reflections.
Use uTime for animation. Keep the shader short (max ${shaderMaxLines} lines).

Reply ONLY with the JSON object, no other text.`

export const countWord = (n: number) => n === 2 ? 'two' : 'three'

export const validationError = 'elements array with 2 or 3 elements is required'
