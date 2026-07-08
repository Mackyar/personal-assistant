'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Paperclip, Square, Bot, User, Plus, Zap } from 'lucide-react';
import { cn, formatRelativeDate } from '@/lib/utils';
import { addMessage, getMessages, createConversation } from '@/lib/db/conversations';
import { processChat } from '@/lib/ai/chat';
import type { Message } from '@/lib/db/schema';
import type { AIMessage } from '@/lib/ai/client';
import toast from 'react-hot-toast';

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params?.id as string | undefined;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [currentConvId, setCurrentConvId] = useState<string | undefined>(conversationId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    if (conversationId) {
      setCurrentConvId(conversationId);
      loadMessages(conversationId);
    }
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  async function loadMessages(convId: string) {
    const msgs = await getMessages(convId);
    setMessages(msgs);
  }

  function scrollToBottom() {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }

  async function handleSend() {
    if (!input.trim() || isStreaming) return;

    const userText = input.trim();
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // Ensure we have a conversation
    let convId = currentConvId;
    if (!convId) {
      const conv = await createConversation(userText.slice(0, 60));
      convId = conv.id;
      setCurrentConvId(convId);
      router.replace(`/chat/${convId}`);
    }

    // Add user message to DB and state
    const userMsg = await addMessage({ conversationId: convId, role: 'user', content: userText });
    setMessages((prev) => [...prev, userMsg]);

    // Build context for AI
    const allMsgs = await getMessages(convId);
    const aiMessages: AIMessage[] = allMsgs
      .filter((m) => m.role !== 'system')
      .slice(-20) // last 20 messages for context
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // Start streaming
    setIsStreaming(true);
    setStreamingContent('');
    abortRef.current = false;
    let fullResponse = '';

    try {
      const { content } = await processChat(
        aiMessages,
        (chunk) => {
          if (abortRef.current) return;
          if (chunk.type === 'delta' && chunk.content) {
            fullResponse += chunk.content;
            setStreamingContent(fullResponse);
          }
          if (chunk.type === 'tool_call') {
            // Tool notifications handled via toast
          }
        },
        (toolResult) => {
          toast.success(toolResult.displayText.replace(/\*\*/g, ''), { icon: '🔧', duration: 3000 });
        }
      );

      if (!abortRef.current) {
        const finalContent = fullResponse || content;
        const assistantMsg = await addMessage({
          conversationId: convId,
          role: 'assistant',
          content: finalContent,
        });
        setMessages((prev) => [...prev, assistantMsg]);
        setStreamingContent('');
      }
    } catch (err) {
      toast.error('Something went wrong. Check your API key in Settings.');
    } finally {
      setIsStreaming(false);
    }
  }

  function handleStop() {
    abortRef.current = true;
    setIsStreaming(false);
    setStreamingContent('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  }

  const SUGGESTIONS = [
    'Meeting with team tomorrow at 2 PM',
    'Remember to submit my assignment next Friday',
    'Note: Great idea for a startup — AI-powered meal planning',
    'What am I doing this week?',
  ];

  const isEmpty = messages.length === 0 && !streamingContent;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center">
            <Bot size={14} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">AI Assistant</h2>
            <p className="text-xs text-muted-foreground">Your personal second brain</p>
          </div>
        </div>
        <button
          onClick={async () => {
            const conv = await createConversation();
            router.push(`/chat/${conv.id}`);
          }}
          className="btn-ghost flex items-center gap-1.5 text-xs"
        >
          <Plus size={13} />
          New chat
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full text-center pb-20 fade-in">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center mb-4 glow-primary">
              <Bot size={32} className="text-white" />
            </div>
            <h2 className="text-xl font-semibold gradient-text mb-2">What can I help you with?</h2>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Tell me about meetings, save notes, set reminders, or ask questions about your stored memories.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                  className="text-left px-3 py-2.5 rounded-xl border border-border bg-card hover:bg-secondary text-xs text-muted-foreground hover:text-foreground transition-all"
                >
                  <Zap size={11} className="inline mr-1.5 text-primary" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Streaming message */}
        {isStreaming && (
          <div className="flex gap-3 fade-in">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot size={13} className="text-white" />
            </div>
            <div className="message-assistant rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
              {streamingContent ? (
                <div className="prose-chat">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 py-1">
                  <span className="thinking-dot" />
                  <span className="thinking-dot" />
                  <span className="thinking-dot" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2">
        <div className="glass rounded-2xl border border-border p-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Message your assistant... (Enter to send, Shift+Enter for new line)"
            rows={1}
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none min-h-[24px] max-h-[200px]"
            style={{ height: 'auto' }}
          />
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">
                {isStreaming ? 'Generating...' : 'Shift+Enter for new line'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isStreaming ? (
                <button onClick={handleStop} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-destructive/20 text-destructive hover:bg-destructive/30 transition-all">
                  <Square size={11} fill="currentColor" />
                  Stop
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="btn-primary flex items-center gap-1.5 text-xs"
                >
                  <Send size={12} />
                  Send
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex gap-3 fade-in', isUser && 'flex-row-reverse')}>
      <div className={cn(
        'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
        isUser ? 'bg-primary' : 'bg-gradient-to-br from-sky-500 to-cyan-500'
      )}>
        {isUser ? <User size={13} className="text-primary-foreground" /> : <Bot size={13} className="text-white" />}
      </div>
      <div className={cn(
        'rounded-2xl px-4 py-3 max-w-[80%] text-sm',
        isUser ? 'message-user text-white rounded-tr-sm' : 'message-assistant rounded-tl-sm'
      )}>
        {isUser ? (
          <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose-chat">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        )}
        <p className={cn('text-[10px] mt-1.5', isUser ? 'text-white/60 text-right' : 'text-muted-foreground')}>
          {formatRelativeDate(message.createdAt)}
        </p>
      </div>
    </div>
  );
}
