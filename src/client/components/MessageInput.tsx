/**
 * NEXUS Message Input Component
 *
 * Auto-expanding, keyboard accessible message composer with character limit
 * and typing throttle dispatch.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, Lock, Paperclip, X, AlertCircle } from 'lucide-react';
import { useAutoResizeTextarea } from '../../hooks/useAutoResizeTextarea.ts';
import { EncryptedFileAttachment } from '../../types/protocol.ts';
import { formatFileSize } from '../../utils/format.ts';

const MAX_CHAR_COUNT = 2000;
const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB encrypted peer payload limit

interface MessageInputProps {
  onSendMessage: (text: string, file?: EncryptedFileAttachment) => void;
  onTyping: (isTyping: boolean) => void;
  disabled: boolean;
  disabledReason?: string;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onTyping,
  disabled,
  disabledReason,
}) => {
  const [text, setText] = useState('');
  const [stagedFile, setStagedFile] = useState<EncryptedFileAttachment | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const textareaRef = useAutoResizeTextarea(text, 160);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= MAX_CHAR_COUNT) {
      setText(val);

      // Typing notification
      onTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        onTyping(false);
      }, 2000);
    }
  };

  const processFile = (file: File) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError(`File exceeds 3 MB limit (${formatFileSize(file.size)}). Select a smaller file.`);
      return;
    }

    setFileError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setStagedFile({
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          dataUrl: reader.result,
        });
      }
    };
    reader.onerror = () => {
      setFileError('Failed to read file locally.');
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // Reset file input so user can re-select same file if desired
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if ((!trimmed && !stagedFile) || disabled) return;

    onSendMessage(trimmed, stagedFile || undefined);
    setText('');
    setStagedFile(null);
    setFileError(null);
    onTyping(false);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
  };

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  const canSend = Boolean(text.trim() || stagedFile) && !disabled;

  return (
    <div
      id="message-input-container"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`p-3 sm:p-4 border-t border-[#1F242D] bg-[#08090B]/90 backdrop-blur-md shrink-0 transition-colors ${
        isDragging ? 'bg-[#38BDF8]/5 border-[#38BDF8]/60' : ''
      }`}
    >
      <div className="max-w-3xl mx-auto">
        {/* Hidden File Input */}
        <input
          id="chat-file-input"
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          disabled={disabled}
          className="hidden"
          aria-label="Select file attachment"
        />

        {disabled && disabledReason && (
          <div className="mb-2 flex items-center justify-center gap-1.5 text-xs font-mono text-amber-400/90">
            <Lock className="w-3.5 h-3.5" />
            <span>{disabledReason}</span>
          </div>
        )}

        {/* File Error Notification */}
        {fileError && (
          <div className="mb-2 p-2 rounded-lg bg-rose-950/40 border border-rose-800/50 flex items-center justify-between text-xs font-mono text-rose-300">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>{fileError}</span>
            </div>
            <button
              type="button"
              onClick={() => setFileError(null)}
              className="p-1 hover:text-rose-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Staged File Preview Chip */}
        {stagedFile && (
          <div
            id="staged-file-preview"
            className="mb-2.5 p-2 px-3 rounded-lg bg-[#0C141F] border border-[#38BDF8]/40 flex items-center justify-between text-xs font-mono text-[#EDEDED] shadow-sm"
          >
            <div className="flex items-center gap-2 truncate min-w-0 pr-2">
              <Paperclip className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
              <span className="font-medium truncate">{stagedFile.name}</span>
              <span className="text-[#8A909E] shrink-0">({formatFileSize(stagedFile.size)})</span>
              <span className="hidden sm:inline-flex text-[10px] px-1.5 py-0.5 rounded bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/30 shrink-0">
                🔒 ENCRYPTED ATTACHMENT
              </span>
            </div>
            <button
              id="remove-staged-file-btn"
              type="button"
              onClick={() => setStagedFile(null)}
              className="p-1 text-[#8A909E] hover:text-rose-400 transition-colors cursor-pointer shrink-0"
              title="Remove attachment"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="relative flex items-end gap-2 bg-[#0D0F12] border border-[#1F242D] focus-within:border-[#38BDF8]/60 rounded-xl p-2 transition-all">
          {/* File Attachment Trigger Button */}
          <button
            id="attach-file-btn"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="p-2 rounded-lg bg-[#111318] hover:bg-[#1F242D] text-[#8A909E] hover:text-[#38BDF8] border border-[#1F242D] hover:border-[#38BDF8]/40 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            title="Attach encrypted file (drag & drop or click, max 3MB)"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Textarea */}
          <textarea
            id="chat-message-textarea"
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={
              disabled
                ? 'Waiting for secure session...'
                : stagedFile
                ? 'Add an optional caption... (Enter to send)'
                : 'Write a message or drop file... (Enter to send, Shift+Enter for newline)'
            }
            className="flex-1 bg-transparent text-[#EDEDED] text-sm placeholder-[#8A909E] focus:outline-none resize-none px-2 py-1.5 min-h-[40px] max-h-[160px] leading-relaxed disabled:opacity-40 disabled:cursor-not-allowed"
          />

          <div className="flex items-center gap-2 pb-0.5">
            {text.length > 500 && (
              <span className="text-[10px] font-mono text-[#8A909E] pr-1">
                {text.length}/{MAX_CHAR_COUNT}
              </span>
            )}

            {/* Send Button */}
            <button
              id="send-message-btn"
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className="p-2 rounded-lg bg-[#111318] hover:bg-[#1F242D] text-[#EDEDED] disabled:text-[#8A909E]/40 disabled:hover:bg-[#111318] border border-[#1F242D] disabled:border-transparent transition-all cursor-pointer disabled:cursor-not-allowed shadow-xs"
              title="Send encrypted message"
            >
              <Send className="w-4 h-4 text-[#38BDF8]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
