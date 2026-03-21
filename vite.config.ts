import { defineConfig, type Plugin } from 'vite'
import { execFile } from 'child_process'

function combineApiPlugin(): Plugin {
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

        const prompt = `Je bent een creatief element-combinatie spel. Combineer deze twee elementen tot een nieuw element.

Element 1: ${elementA}
Element 2: ${elementB}

Bedenk een creatief en logisch nieuw element dat ontstaat als je deze twee combineert.
Geef het resultaat als JSON object met exact deze velden:
- "id": lowercase, geen spaties, kort (bijv. "steam", "lava", "mud")
- "name": Nederlandse naam met hoofdletter (bijv. "Stoom", "Lava", "Modder")
- "color": hex kleurcode die past bij het element (bijv. "#c0c0c0")

Antwoord ALLEEN met het JSON object, geen andere tekst.`

        try {
          const result = await new Promise<string>((resolve, reject) => {
            execFile('claude', [
              '-p',
              prompt,
              '--model', 'haiku',
              '--output-format',
              'text'
            ], { timeout: 30000 }, (err, stdout, stderr) => {
              if (err) reject(new Error(stderr || err.message))
              else resolve(stdout.trim())
            })
          })

          // Strip markdown codeblock formatting als dat er omheen zit
          const jsonStr = result.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
          const parsed = JSON.parse(jsonStr)

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
