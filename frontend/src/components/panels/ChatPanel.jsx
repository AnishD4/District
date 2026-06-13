import { useState, useRef, useEffect } from 'react'
import { api } from '../../lib/api'

export function ChatPanel({ building }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Hi! I'm the AI for **${building.name}**. Ask me anything about this project.` }
  ])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef()

  const sendMessage = async () => {
    if (!input.trim() || streaming) return
    const userMsg = { role: 'user', content: input }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setStreaming(true)

    // Append empty assistant message to stream into
    setMessages(m => [...m, { role: 'assistant', content: '' }])

    try {
      const response = await api.chat(building.id, newMessages)
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          const data = line.slice(6)
          if (data === '[DONE]') { setStreaming(false); break }
          try {
            const { text } = JSON.parse(data)
            setMessages(m => {
              const updated = [...m]
              updated[updated.length - 1] = {
                role: 'assistant',
                content: updated[updated.length - 1].content + text
              }
              return updated
            })
          } catch {}
        }
      }
    } catch (err) {
      console.error('Chat error:', err)
      setMessages(m => {
        const updated = [...m]
        updated[updated.length - 1] = { role: 'assistant', content: 'Sorry, I encountered an error. Is the backend running?' }
        return updated
      })
    }
    setStreaming(false)
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%',
              borderRadius: '16px',
              padding: '10px 16px',
              fontSize: '13px',
              lineHeight: 1.6,
              background: m.role === 'user' ? 'var(--accent)' : 'var(--bg)',
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
            }}>
              {m.content}
              {streaming && m.role === 'assistant' && i === messages.length - 1 && (
                <span className="animate-pulse" style={{
                  display: 'inline-block',
                  width: '4px',
                  height: '16px',
                  background: 'var(--accent)',
                  marginLeft: '2px',
                  verticalAlign: 'text-bottom',
                }} />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Ask about this project..."
            style={{
              flex: 1,
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '10px 16px',
              fontSize: '13px',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={streaming}
            className="btn-accent"
            style={{ padding: '10px 16px', borderRadius: '12px' }}
          >
            ✦
          </button>
        </div>
      </div>
    </div>
  )
}
