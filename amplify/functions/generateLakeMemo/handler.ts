const GEMINI_MODEL = 'gemini-3-flash-preview'

export const handler = async (event: any) => {
  const { text, imagesJson } = event.arguments
  const apiKey = process.env.GEMINI_API_KEY

  console.log('[generateLakeMemo] args:', {
    textLength: text?.length || 0,
    hasImagesJson: !!imagesJson,
    imagesJsonLength: imagesJson?.length || 0,
    model: GEMINI_MODEL,
  })

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  let images: Array<{ base64: string; mimeType: string }> = []
  try {
    images = imagesJson ? JSON.parse(imagesJson) : []
  } catch (e) {
    console.error('[generateLakeMemo] imagesJson parse error:', e)
    throw new Error('imagesJson 파싱 실패')
  }
  const hasImages = images.length > 0
  console.log('[generateLakeMemo] parsed images:', images.length)

  if (!text?.trim() && !hasImages) {
    throw new Error('Input text or image is required')
  }

  const inputText = text?.trim() || ''
  const isShortInput = !hasImages && inputText.length <= 500 && inputText.split(/\n/).filter((l: string) => l.trim()).length <= 5
  const isMultiSource = hasImages ? (images.length > 1 || !!inputText) : false

  const formatInstruction = isShortInput
    ? `형식:
- title: 10~20자. 핵심 키워드만.
- summary: 1문장. 원문의 톤과 길이를 유지. 부풀리지 말 것.
- keyPoints: 1~3개 (배열). 각 포인트 1줄 이내.`
    : `형식:
- title: 15~25자. 핵심 투자 포인트가 한눈에 보여야 함. 종목 코드, 수식어 금지.
- summary: 1~2문장. 핵심만 압축.
- keyPoints: 3~5개 (배열). 각 포인트 1줄 이내. 서술 금지, 팩트 중심.`

  const sourceDesc = hasImages ? '아래 텍스트 및 이미지를' : '아래 텍스트를'
  const multiSourceRule = isMultiSource
    ? '\n- 여러 소스가 제공됨. 중복 제거 후 하나의 통합 메모로 작성. 파일별 나열 금지.'
    : ''

  const prompt = `투자 리서치 애널리스트로서 ${sourceDesc} 한국어 투자 메모로 정리하세요.

규칙:
- 반드시 한국어로 작성
- 단순 번역이 아니라 투자 관점에서 핵심만 추출
- 서술/수식어 최소화. 숫자와 팩트 중심.
- 카드 한 장에서 5초 내 훑을 수 있는 길이${multiSourceRule}

${formatInstruction}

원문:
${inputText || '(이미지 참조)'}`

  const parts: any[] = []
  for (const img of images) {
    parts.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.base64,
      },
    })
  }
  parts.push({ text: prompt })

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING' },
              summary: { type: 'STRING' },
              keyPoints: { type: 'ARRAY', items: { type: 'STRING' } },
            },
            required: ['title', 'summary', 'keyPoints'],
          },
        },
      }),
    }
  )

  console.log('[generateLakeMemo] Gemini response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[generateLakeMemo] Gemini error:', errorText.slice(0, 500))
    throw new Error(`Gemini API error (${response.status}): ${errorText.slice(0, 200)}`)
  }

  const data = await response.json()
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!content) {
    console.error('[generateLakeMemo] No content in response:', JSON.stringify(data).slice(0, 500))
    throw new Error('No content in Gemini response')
  }

  const result = JSON.parse(content)
  return {
    title: result.title,
    summary: result.summary,
    keyPoints: JSON.stringify(result.keyPoints),
  }
}
