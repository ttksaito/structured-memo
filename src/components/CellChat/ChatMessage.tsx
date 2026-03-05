import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage as ChatMessageType } from '../../types';

interface Props {
  message: ChatMessageType;
}

const tableStyle: React.CSSProperties = {
  borderCollapse: 'collapse',
  width: '100%',
  marginTop: 8,
  marginBottom: 8,
  fontSize: 12,
};

const thStyle: React.CSSProperties = {
  border: '1px solid #d1d5db',
  padding: '5px 10px',
  background: '#e5e7eb',
  fontWeight: 600,
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  border: '1px solid #d1d5db',
  padding: '5px 10px',
  verticalAlign: 'top',
};

export function ChatMessageItem({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 8,
      }}
    >
      <div
        style={{
          maxWidth: '85%',
          padding: '10px 14px',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: isUser ? '#3b82f6' : '#f3f4f6',
          color: isUser ? '#fff' : '#1f2937',
          fontSize: 13,
          lineHeight: 1.6,
          wordBreak: 'break-word',
        }}
      >
        {isUser ? (
          <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
        ) : (
          <div className="markdown-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({ children }) => <table style={tableStyle}>{children}</table>,
                th: ({ children }) => <th style={thStyle}>{children}</th>,
                td: ({ children }) => <td style={tdStyle}>{children}</td>,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
