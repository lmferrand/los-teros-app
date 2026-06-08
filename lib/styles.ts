import React from 'react'

// Tokens de estilo compartidos. Los colores salen de variables CSS
// (definidas en app/globals.css) para que el tema claro/oscuro sea coherente.
export const s = {
  bg: 'var(--bg)',
  bgSubtle: 'var(--bg-subtle)',
  card: 'var(--bg-card)',
  border: 'var(--border)',
  text: 'var(--text)',
  muted: 'var(--text-muted)',
  subtle: 'var(--text-subtle)',

  brand1: 'var(--brand-1)',
  brand2: 'var(--brand-2)',
  gradiente: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',

  green: 'var(--green)',
  amber: 'var(--amber)',
  red: 'var(--red)',

  cardStyle: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radio)',
    boxShadow: 'var(--shadow-sm)',
  } as React.CSSProperties,

  inputStyle: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    borderRadius: 12,
    padding: '10px 12px',
    fontSize: '0.95rem',
    outline: 'none',
    width: '100%',
  } as React.CSSProperties,

  headerStyle: {
    background: 'var(--bg-card)',
    borderBottom: '1px solid var(--border)',
  } as React.CSSProperties,

  btnPrimary: {
    background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
    color: 'white',
    border: 'none',
    borderRadius: 12,
    padding: '10px 18px',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: 'var(--shadow-sm)',
  } as React.CSSProperties,

  btnSecondary: {
    background: 'var(--bg-card)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '10px 18px',
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,
}
