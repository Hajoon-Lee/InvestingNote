export const handler = async (event: any) => {
  const { text } = event.arguments
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured')
  }
  if (!text?.trim()) {
    throw new Error('Input text is required')
  }

  const prompt = `당신은 투자 리서치 애널리스트입니다. 아래 텍스트를 읽고 투자 관점에서 이해하기 쉬운 한국어 리서치 메모를 작성하세요.

규칙:
- 원문의 언어와 관계없이 반드시 한국어로 작성하세요
- 단순 번역이 아니라 투자 관점에서 핵심을 정리하세요
- Feed에서 빠르게 읽을 수 있는 적당한 길이로 요약하세요

형식:
- title: 20~30자 내외의 간결한 제목. 핵심 투자 포인트가 한눈에 보여야 함. 종목 코드, 부연 설명, 수식어를 넣지 말 것.
  - 좋은 예: "소니 음악 사업의 AI 경쟁력"
  - 나쁜 예: "소니 그룹(6758.T): 강력한 음악 카탈로그와 높은 시장 점유율로 AI 시대 경쟁 우위 확보"
- summary: 2-3문장의 짧은 요약 (문단 형태)
- keyPoints: 3-5개의 핵심 Bullet Point (배열)

원문:
${text}`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
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
