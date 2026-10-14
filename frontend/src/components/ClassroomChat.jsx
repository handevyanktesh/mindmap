import React, { useState, useEffect, useRef } from 'react'
import Button from './Button'
import { API_BASE_URL } from '../config/api'

function ChatBubbleIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function SendIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

export default function ClassroomChat({
  sessionId,
  currentUser,
  isWsConnected,
  connectionState,
  retryCount = 0,
  lastMessage,
  onSendMessage,
  className = ''
}) {
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [sendError, setSendError] = useState('')

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Scroll to bottom when messages update
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load message history from REST API
  useEffect(() => {
    let isMounted = true
    const fetchChatHistory = async () => {
      if (!sessionId) return
      setLoadingHistory(true)
      setHistoryError('')

      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/chat?limit=100`, {
          headers: { Authorization: `Bearer ${token}` }
        })

        if (!res.ok) {
          if (res.status === 403) {
            throw new Error('Not authorized to access chat for this session.')
          }
          throw new Error('Failed to load chat history.')
        }

        const data = await res.json()
        if (isMounted) {
          setMessages(data)
        }
      } catch (err) {
        console.error('Chat history fetch error:', err)
        if (isMounted) {
          setHistoryError(err.message || 'Could not load messages.')
        }
      } finally {
        if (isMounted) setLoadingHistory(false)
      }
    }

    fetchChatHistory()

    return () => {
      isMounted = false
    }
  }, [sessionId])

  // Process incoming WebSocket messages with deduplication
  useEffect(() => {
    if (!lastMessage) return

    if (lastMessage.type === 'chat_message' && lastMessage.data) {
      const newMsg = lastMessage.data
      setMessages((prev) => {
        // Prevent duplicate delivery
        if (prev.some((m) => m.id === newMsg.id)) {
          return prev
        }
        return [...prev, newMsg]
      })
      setSendError('')
    } else if (lastMessage.type === 'session_ended') {
      const sysMsg = {
        id: `sys-ended-${Date.now()}`,
        is_system: true,
        content: 'This classroom session has ended.',
        created_at: new Date().toISOString()
      }
      setMessages((prev) => [...prev, sysMsg])
    }
  }, [lastMessage])

  // Handle message sending
  const handleSend = (e) => {
    e?.preventDefault()
    setSendError('')

    const trimmed = inputText.trim()
    if (!trimmed) return

    if (trimmed.length > 500) {
      setSendError('Message must be 500 characters or less.')
      return
    }

    if (!isWsConnected) {
      setSendError('Cannot send: Chat is disconnected.')
      return
    }

    if (onSendMessage) {
      const success = onSendMessage(trimmed)
      if (success) {
        setInputText('')
        if (inputRef.current) inputRef.current.focus()
      } else {
        setSendError('Failed to send message over WebSocket.')
      }
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (isoString) => {
    if (!isoString) return ''
    try {
      const d = new Date(isoString)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch (_) {
      return ''
    }
  }

  const charCount = inputText.length
  const isOverLimit = charCount > 500

  return (
    <div className={`card-panel flex flex-col h-[520px] p-0 overflow-hidden border border-neutral-border shadow-xs bg-panel-bg rounded-xl ${className}`}>
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-border bg-slate-50/70">
        <div className="flex items-center gap-2">
          <ChatBubbleIcon className="w-4 h-4 text-brand-navy" />
          <h3 className="text-xs font-bold text-brand-navy uppercase tracking-wider">Classroom Chat</h3>
          <span className="text-[10px] text-text-muted font-mono bg-neutral-200/60 px-1.5 py-0.5 rounded">
            {messages.length} msg{messages.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Live Status Indicator */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span
            className={`w-2 h-2 rounded-full ${
              isWsConnected
                ? 'bg-emerald-500'
                : connectionState === 'reconnecting'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-rose-500'
            }`}
          />
          <span className="text-text-muted text-xs">
            {isWsConnected
              ? 'Live'
              : connectionState === 'reconnecting'
                ? `Reconnecting (${retryCount}/5)...`
                : 'Offline'}
          </span>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-white/70">
        {loadingHistory ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted space-y-2">
            <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs">Loading message history...</p>
          </div>
        ) : historyError ? (
          <div className="flex flex-col items-center justify-center h-full text-danger-600 space-y-1 p-4 text-center">
            <p className="text-xs font-semibold">{historyError}</p>
            <p className="text-[10px] text-text-muted">Chat requires active session participation.</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted space-y-2.5 text-center p-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-primary-600 shadow-xs">
              <ChatBubbleIcon className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-brand-navy">No messages yet</p>
              <p className="text-[11px] text-text-muted max-w-[220px] mt-0.5 leading-relaxed">
                Ask a question or share thoughts with your instructor and peers.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.is_system) {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <span className="text-[10px] font-sans italic text-text-muted bg-neutral-light border border-neutral-border/60 px-3 py-1 rounded-full">
                    {msg.content}
                  </span>
                </div>
              )
            }

            const isMine = currentUser && msg.sender_id === currentUser.id
            const isTeacher = msg.sender_role === 'teacher'

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
              >
                {/* Sender metadata */}
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[11px] font-semibold text-brand-navy">
                    {msg.sender_name} {isMine && <span className="text-primary-600 font-normal">(You)</span>}
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                      isTeacher
                        ? 'bg-brand-navy text-white border-brand-navy'
                        : 'bg-primary-50 text-primary-700 border-primary-200'
                    }`}
                  >
                    {isTeacher ? 'Teacher' : 'Student'}
                  </span>
                  <span className="text-[9px] text-text-muted font-mono">
                    {formatTime(msg.created_at)}
                  </span>
                </div>

                {/* Message bubble */}
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2 text-xs leading-relaxed break-words shadow-xs border ${
                    isMine
                      ? 'bg-primary-600 text-white border-primary-700 rounded-tr-none'
                      : isTeacher
                        ? 'bg-brand-navy/5 text-brand-navy border-brand-navy/20 rounded-tl-none font-medium'
                        : 'bg-neutral-light text-slate-800 border-neutral-border rounded-tl-none'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-neutral-border bg-slate-50/50 p-3">
        {sendError && (
          <div className="text-[11px] text-danger-600 mb-2 px-1 font-medium flex items-center justify-between">
            <span>{sendError}</span>
            <button
              onClick={() => setSendError('')}
              className="text-text-muted hover:text-danger-700 text-xs font-bold ml-2"
            >
              &times;
            </button>
          </div>
        )}

        <form onSubmit={handleSend} className="flex flex-col gap-1.5">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows="2"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isWsConnected ? "Type a message... (Press Enter to send)" : "Chat is offline..."}
              disabled={!isWsConnected}
              className={`input-text flex-1 resize-none text-xs p-2.5 rounded-lg border transition-colors ${
                isOverLimit ? 'border-danger-500 focus:ring-danger-500' : 'border-neutral-border'
              }`}
            />
            <Button
              type="submit"
              variant="primary"
              disabled={!isWsConnected || !inputText.trim() || isOverLimit}
              className="text-xs py-2 px-3.5 self-stretch flex items-center justify-center gap-1.5 shrink-0"
            >
              <SendIcon className="w-3.5 h-3.5" />
              <span>Send</span>
            </Button>
          </div>

          <div className="flex justify-between items-center px-1 text-[10px] text-text-muted">
            <span>Shift + Enter for new line</span>
            <span className={`font-mono ${isOverLimit ? 'text-danger-600 font-bold' : ''}`}>
              {charCount} / 500
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}
