import type { IncomingMessage, ServerResponse } from 'http'
import { spawn } from 'child_process'
import { cacheKey, saveCache, type Cache } from './cache'
import { getPromptLocale } from './prompts'

export function handleCombine(cache: Cache, lang: string, shaderMaxLines: number = 30) {
  const { prompt, countWord, validationError } = getPromptLocale(lang)

  return async (req: IncomingMessage, res: ServerResponse) => {
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
    const elements: string[] = body.elements

    if (!elements || elements.length < 2 || elements.length > 3) {
      res.statusCode = 400
      res.end(validationError)
      return
    }

    const key = cacheKey(elements)
    if (cache[key]) {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(cache[key]))
      return
    }

    const elementList = elements.map((e, i) => `Element ${i + 1}: ${e}`).join('\n')
    const count = countWord(elements.length)
    const existingIds = [...new Set(
      Object.entries(cache)
        .filter(([k]) => elements.some((el) => k.includes(el)))
        .map(([, e]) => e.id),
    )]

    console.log(elementList, existingIds);

    try {
      const result = await new Promise<string>((resolve, reject) => {
        const proc = spawn('claude', [
          '-p', prompt(elementList, count, existingIds, shaderMaxLines),
          '--model', 'haiku',
          '--output-format', 'text',
          '--no-session-persistence',
        ], { timeout: 80000, stdio: ['pipe', 'pipe', 'pipe'] })

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

      const jsonStr = result.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
      const parsed = JSON.parse(jsonStr)

      const isDuplicate = Object.values(cache).some((e) => e.id === parsed.id)
      if (!isDuplicate) {
        cache[key] = parsed
        saveCache(cache)
      }

      console.log(JSON.stringify(parsed, null, 2))

      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(parsed))
    } catch (err) {
      console.error('Claude CLI error:', err)
      res.statusCode = 500
      res.end(String(err))
    }
  }
}
