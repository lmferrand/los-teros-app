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
        model: 'llama3-8b-8192',
        messages: [
          {
            role: 'system',
            content: `Eres el asistente de Los Teros, una empresa de servicios tecnicos de limpieza y mantenimiento industrial especializada en sistemas de ventilacion, campanas industriales y turbinas.
Ayudas a los trabajadores y a la oficina con informacion sobre ordenes de trabajo, inventario, planificacion y clientes.
Responde siempre en espanol, de forma concisa y practica.
Contexto actual de la empresa:
${contexto || 'Sin datos adicionales'}`
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
    const respuesta = data.choices?.[0]?.message?.content || 'No pude procesar tu pregunta.'
    return NextResponse.json({ respuesta })
  } catch (error) {
    return NextResponse.json({ error: 'Error al conectar con la IA' }, { status: 500 })
  }
}