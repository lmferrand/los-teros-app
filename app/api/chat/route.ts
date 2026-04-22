import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { mensaje, contexto } = await req.json()

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `Eres el asistente de Los Teros. Responde en espanol de forma concisa. Contexto: ${contexto || 'Sin datos'}`
          },
          {
            role: 'user',
            content: mensaje
          }
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json({ 
        respuesta: `Error Groq: ${data.error?.message || JSON.stringify(data)}` 
      })
    }

    const respuesta = data.choices?.[0]?.message?.content || 'Respuesta vacia'
    return NextResponse.json({ respuesta })

  } catch (error: any) {
    return NextResponse.json({ 
      respuesta: `Error tecnico: ${error.message}` 
    })
  }
}