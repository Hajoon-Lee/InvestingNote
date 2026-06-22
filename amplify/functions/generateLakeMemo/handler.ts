export const handler = async (event: any) => {
  const { text, imageBase64, imageMimeType } = event.arguments
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured')
  }
  if (!text?.trim() && !imageBase64) {
    throw new Error('Input text or image is required')
  }

  const inputText = text?.trim() || ''
  const hasImage = !!imageBase64 && !!imageMimeType
  const isShortInput = !hasImage && inputText.length < 200 && inputText.split(/\n/).filter((l: string) => l.trim()).length <= 3

  const formatInstruction = isShortInput
    ? `형식:
- title: 10~20자 내외의 간결한 제목. 핵심만 담을 것.
- summary: 1문장 요약. 원문의 톤과 길이를 유지하세요.
- keyPoints: 1-2개의 핵심 포인트 (배열)

입력이 짧으므로 간결하게 요약하세요. 불필요하게 내용을 부풀리지 마세요.`
    : `형식:
- title: 20~30자 내외의 간결한 제목. 핵심 투자 포인트가 한눈에 보여야 함. 종목 코드, 부연 설명, 수식어를 넣지 말 것.
  - 좋은 예: "소니 음악 사업의 AI 경쟁력"
  - 나쁜 예: "소니 그룹(6758.T): 강력한 음악 카탈로그와 높은 시장 점유율로 AI 시대 경쟁 우위 확보"
- summary: 2-3문장의 짧은 요약 (문단 형태)
- keyPoints: 3-5개의 핵심 Bullet Point (배열)`

  const sourceDesc = hasImage ? '아래 텍스트 및 이미지를' : '아래 텍스트를'

  const prompt = `당신은 투자 리서치 애널리스트입니다. ${sourceDesc} 읽고 투자 관점에서 이해하기 쉬운 한국어 리서치 메모를 작성하세요.

규칙:
- 원문의 언어와 관계없이 반드시 한국어로 작성하세요
- 단순 번역이 아니라 투자 관점에서 핵심을 정리하세요
- Feed에서 빠르게 읽을 수 있는 적당한 길이로 요약하세요

${formatInstruction}

원문:
${inputText || '(이미지 참조)'}`

  const parts: any[] = []
  if (hasImage) {
    parts.push({
      inlineData: {
        mimeType: imageMimeType,
        data: imageBase64,
      },
    })
  }
  parts.push({ text: prompt })

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!content) {
    throw new Error('No content in Gemini response')
  }

  const result = JSON.parse(content)
  return {
    title: result.title,
    summary: result.summary,
    keyPoints: JSON.stringify(result.keyPoints),
  }
}
