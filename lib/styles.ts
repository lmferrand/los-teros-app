import React from 'react'

export const s = {
  bg: 'var(--bg)',
  card: 'var(--bg-card)',
  border: 'var(--border)',
  text: 'var(--text)',
  muted: 'var(--text-muted)',
  subtle: 'var(--text-subtle)',

  cardStyle: { background: 'var(--bg-card)', border: '1px solid var(--border)' } as React.CSSProperties,
  inputStyle: { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' } as React.CSSProperties,
  headerStyle: { background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' } as React.CSSProperties,

  btnPrimary: { background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', color: 'white' } as React.CSSProperties,
  btnSecondary: { background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' } as React.CSSProperties,

  gradiente: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
}