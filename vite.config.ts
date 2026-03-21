import { defineConfig, type Plugin } from 'vite'
import { spawn } from 'child_process'
import { readFileSync, writeFileSync, existsSync } from 'fs'

const CACHE_FILE = './combine-cache.json'

function loadCache(): Record<string, unknown> {
  if (existsSync(CACHE_FILE)) {
    try { return JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) } catch { return {} }
  }
  return {}
}

function saveCache(cache: Record<string, unknown>): void {
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2))
}

function cacheKey(a: string, b: string): string {
  return [a, b].sort().join('+')
}

function combineApiPlugin(): Plugin {
  const cache = loadCache()

  return {
    name: 'combine-api',
    configureServer(server) {
      server.middlewares.use('/api/combine', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }

        const chunks: Buffer[] = []
        for await (const chunk of req) {
          chunks.push(chunk as Buffer)
        }
        const body = JSON.parse(Buffer.concat(chunks).toString())
        const { elementA, elementB } = body

        if (!elementA || !elementB) {
          res.statusCode = 400
          res.end('elementA en elementB zijn verplicht')
          return
        }

        const key = cacheKey(elementA, elementB)
        if (cache[key]) {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(cache[key]))
          return
        }

        const prompt = `Je bent een slim element-combinatie spel, geïnspireerd door echte wetenschap, natuur en scheikunde.

Element 1: ${elementA}
Element 2: ${elementB}

Bedenk wat er ECHT zou ontstaan als je deze twee combineert. Denk na over scheikunde, natuurkunde, biologie of geologie.
- Plak NOOIT twee namen aan elkaar (bijv. "goudglas" of "vuurwater" is VERBODEN).
- Het resultaat moet een echt bestaand materiaal, stof, verschijnsel of concept zijn.
- Voorbeelden: Water + Vuur = Stoom, Zand + Vuur = Glas, Goud + Glas = Silicium.
- Wees wetenschappelijk maar ook verrassend en leuk.
Geef het resultaat als JSON object met exact deze velden:
- "id": lowercase, geen spaties, kort (bijv. "steam", "lava", "mud")
- "name": Nederlandse naam met hoofdletter (bijv. "Stoom", "Lava", "Modder")
- "color": hex kleurcode die past bij het element (bijv. "#c0c0c0")
- "description": een korte Nederlandse beschrijving van het element (2-3 zinnen, informatief en leuk)
- "wikipediaUrl": een URL naar de relevante Nederlandse Wikipedia pagina (https://nl.wikipedia.org/wiki/...). Als er geen Nederlandse pagina bestaat, gebruik de Engelse (https://en.wikipedia.org/wiki/...)
- "shader": GLSL fragment shader body (alleen de code BINNEN void main()) die visueel past bij het element

De shader body heeft toegang tot deze variabelen:
- uniform float uTime (tijd in seconden)
- uniform vec3 uColor (de kleur van het element)
- varying vec2 vUv (UV coordinaten 0-1)
- varying vec3 vWorldNormal (world space normaal)
- varying vec3 vWorldPos (world space positie)
- varying vec3 vViewDir (richting naar camera)
- float noise(vec2 p) functie (returns 0-1)
- float fbm(vec2 p, int octaves) functie (fractal brownian motion)
- float schlickFresnel(vec3 normal, vec3 viewDir, float f0) functie
- Schrijf naar gl_FragColor = vec4(col, 1.0);

Maak de shader visueel passend bij het element. Bijv. lava = gloeiend met vloeiende textuur, stoom = wolkachtig en transparant-achtig, ijs = kristalachtig met reflecties.
Gebruik uTime voor animatie. Houd de shader kort (max 20 regels).

Antwoord ALLEEN met het JSON object, geen andere tekst.`

        try {
          const result = await new Promise<string>((resolve, reject) => {
            const proc = spawn('claude', [
              '-p', prompt,
              '--model', 'haiku',
              '--output-format', 'text',
            ], { timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] })

            proc.stdin.end()

            let stdout = ''
            let stderr = ''
            proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
            proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
            proc.on('close', (code) => {
              if (code !== 0 && !stdout.trim()) {
                reject(new Error(stderr || `claude exited with code ${code}`))
              } else {
                resolve(stdout.trim())
              }
            })
            proc.on('error', (err) => reject(err))
          })

          // Strip markdown codeblock formatting als dat er omheen zit
          const jsonStr = result.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
          const parsed = JSON.parse(jsonStr)

          cache[key] = parsed
          saveCache(cache)

          console.log(JSON.stringify(parsed, null, 2));

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(parsed))
        } catch (err) {
          console.error('Claude CLI error:', err)
          res.statusCode = 500
          res.end(String(err))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [combineApiPlugin()],
})
