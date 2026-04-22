import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { mensaje, contexto, imagen } = body

    let messages: any[]

    if (imagen) {
      messages = [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imagen }
            },
            {
              type: 'text',
              text: `Analiza este presupuesto y extrae los siguientes datos en formato JSON exacto, sin texto adicional:
{
  "numero": "numero del presupuesto",
  "cliente": "nombre del cliente",
  "importe": 0.00,
  "fecha": "DD/MM/YYYY",
  "descripcion": "descripcion resumida de los trabajos"
}
Si no encuentras algun dato deja el campo vacio o en 0.`
            }
          ]
        }
      ]
    } else {
      messages = [
        {
          role: 'system',
          content: `Eres el asistente de Los Teros, empresa de mantenimiento industrial. Responde en espanol de forma concisa. Contexto: ${contexto || 'Sin datos'}`
        },
        {
          role: 'user',
          content: mensaje
        }
      ]
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: imagen ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.1,
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