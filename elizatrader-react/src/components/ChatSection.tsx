import { useState, useRef, useEffect, Dispatch, SetStateAction } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message } from '../types';
import { sendMessage } from '../services/api';
import AnalysisCard from './AnalysisCard';

interface ChatSectionProps {
  messages: Message[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
  isScanning?: boolean;
}

const ChatSection = ({ messages, setMessages, isScanning = false }: ChatSectionProps) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMultiline, setIsMultiline] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 200);
      textarea.style.height = newHeight + 'px';
      setIsMultiline(newHeight > 38);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    adjustTextareaHeight();
  };

  // Reset textarea height when message is sent
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      setIsMultiline(false);
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      type: 'user',
      timestamp: new Date(),
    };

    setMessages((prev: Message[]) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await sendMessage(input);
      setMessages((prev: Message[]) => [...prev, response]);
    } catch (error) {
      console.error('Failed to get response:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error. Please try again.',
        type: 'bot',
        timestamp: new Date(),
      };
      setMessages((prev: Message[]) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Enter key to submit, Shift+Enter for new line
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages container */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2">
        <div className="flex flex-col">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`py-2 ${message.type === 'bot' ? 'bg-transparent' : ''}`}
            >
              <div className="flex items-start">
                {message.type === 'update' ? (
                  // Update message - simple text with loading indicator
                  <div className="w-full text-left text-sm text-[#8131CF] px-4 py-1 rounded-md">
                    {message.text}
                  </div>
                ) : (
                  // Regular chat messages (user or bot)
                  <>
                    {message.type === 'bot' ? (
                      <div className="w-7 h-7 shrink-0 rounded-full bg-[#8131CF] flex items-center justify-center text-white text-xs mr-3 shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
                        AI
                      </div>
                    ) : (
                      <div className="w-7 h-7 shrink-0 rounded-full bg-[#ffffff] flex items-center justify-center text-[#0F172A] text-xs mr-3 shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
                        U
                      </div>
                    )}
                    <div className="flex flex-col gap-2 min-w-0 max-w-[85%]">
                      <div 
                        className={`text-sm break-words whitespace-pre-wrap text-left inline-block ${
                          message.type === 'user' 
                            ? 'bg-[#8131CF] text-white rounded-2xl rounded-tl-sm py-2 px-3 shadow-[0_2px_8px_rgba(0,0,0,0.2)]' 
                            : 'bg-[#ffffff] text-[#0F172A] rounded-2xl rounded-tl-sm py-2 px-3 prose prose-invert prose-sm max-w-none prose-headings:mt-4 prose-headings:mb-2 prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-strong:text-[#8131CF] shadow-[0_2px_8px_rgba(0,0,0,0.2)]'
                        }`}
                        style={{ wordBreak: 'break-word' }}
                      >
                        {message.type === 'bot' ? (
                          message.text.startsWith('{') && message.text.endsWith('}') ? (
                            <div className="w-full">
                              <AnalysisCard data={JSON.parse(message.text)} />
                            </div>
                          ) : (
                            <ReactMarkdown className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                              {message.text}
                            </ReactMarkdown>
                          )
                        ) : (
                          message.text
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
          {(isLoading || isScanning) && (
            <div className="py-2 bg-transparent -mx-4 px-4">
              <div className="flex items-start">
                <div className="w-7 h-7 shrink-0 rounded-full bg-[#8131CF] flex items-center justify-center text-white text-xs mr-3 shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
                  AI
                </div>
                <div className="bg-white rounded-2xl rounded-tl-sm py-2 px-3 shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-[#8131CF] rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-[#8131CF] rounded-full animate-bounce delay-100"></div>
                    <div className="w-1.5 h-1.5 bg-[#8131CF] rounded-full animate-bounce delay-200"></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Chat Input Section */}
      <div className="mt-auto border-t border-gray-200 p-2 space-y-2 bg-transparent">
        <form onSubmit={handleSubmit}>
          <div className={`flex items-${isMultiline ? 'end' : 'center'} relative`}>
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              disabled={isLoading || isScanning}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm text-[#0F172A] outline-none focus:border-[#8131CF] transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.2)] resize-none overflow-y-auto max-h-[200px] disabled:opacity-50"
              style={{ minHeight: '38px' }}
            />
            <button
              type="submit"
              disabled={isLoading || isScanning || !input.trim()}
              className="flex-none ml-2 h-[38px] w-[38px] bg-[#8131CF] hover:bg-[#6f2ab3] disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors flex items-center justify-center"
            >
              <svg 
                viewBox="0 0 24 24"
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatSection; 