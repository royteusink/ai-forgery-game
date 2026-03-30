export const prompt = (elementList: string, count: string, existingIds: string[], shaderMaxLines: number) => `Je bent een slim element-combinatie spel, geïnspireerd door echte wetenschap, natuur en scheikunde.

${elementList}

Bedenk wat er ECHT zou ontstaan als je deze ${count} combineert. Denk na over scheikunde, natuurkunde, biologie of geologie.
- Plak NOOIT twee of drie namen aan elkaar (bijv. "goudglas" of "vuurwater" is VERBODEN).
- Het resultaat moet een echt bestaand materiaal, stof, verschijnsel of concept zijn.
- Het resultaat MOET iets NIEUWS zijn. Deze IDs bestaan al en mogen NIET worden gebruikt: ${existingIds.join(', ')}
- Voorbeelden: Water + Vuur = Stoom, Zand + Vuur + Grind = Beton, Goud + Vuur + Zand = Juweel.
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
Gebruik uTime voor animatie. Houd de shader kort (max ${shaderMaxLines} regels).

Antwoord ALLEEN met het JSON object, geen andere tekst.`

export const countWord = (n: number) => n === 2 ? 'twee' : 'drie'

export const validationError = 'elements array met 2 of 3 elementen is verplicht'
