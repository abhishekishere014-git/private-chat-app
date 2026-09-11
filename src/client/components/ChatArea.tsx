/**
 * NEXUS Chat Area Component
 *
 * Minimalist, high-density timeline differentiating own messages,
 * peer messages, and cryptographic system notifications.
 */

import React, { useEffect, useRef } from 'react';
import { TimelineItem } from '../../types/protocol.ts';
import { formatTimestamp, formatFileSize } from '../../utils/format.ts';
import {
  Lock,
  ShieldCheck,
  MessageSquare,
  Paperclip,
  Download,
  File,
  FileText,
  FileCode,
  FileArchive,
  Image as ImageIcon,
} from 'lucide-react';

interface ChatAreaProps {
  timeline: TimelineItem[];
  currentUserId: string;
  isEncrypted: boolean;
  peerTyping: string | null;
}

function getFileIcon(filename: string, mimeType: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
    return <ImageIcon className="w-5 h-5 text-[#38BDF8]" />;
  }
  if (['ts', 'tsx', 'js', 'jsx', 'json', 'py', 'rs', 'go', 'html', 'css', 'c', 'cpp', 'sh', 'sql'].includes(ext)) {
    return <FileCode className="w-5 h-5 text-emerald-400" />;
  }
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) {
    return <FileArchive className="w-5 h-5 text-amber-400" />;
  }
  if (['pdf', 'txt', 'md', 'doc', 'docx', 'rtf'].includes(ext) || mimeType.startsWith('text/')) {
    return <FileText className="w-5 h-5 text-cyan-400" />;
  }
  return <File className="w-5 h-5 text-[#8A909E]" />;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  timeline,
  currentUserId,
  isEncrypted,
  peerTyping,
}) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timeline, peerTyping]);

  return (
    <div
      id="chat-area"
      className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-sm font-sans"
    >
      {/* Session Security Banner */}
      <div className="mx-auto max-w-lg p-3 rounded-lg bg-[#0D0F12] border border-[#1F242D] text-xs text-[#8A909E] text-center font-mono">
        <div className="flex items-center justify-center gap-1.5 text-[#EDEDED] font-medium mb-1">
          <Lock className="w-3.5 h-3.5 text-[#38BDF8]" />
          <span>ZERO-KNOWLEDGE RELAY</span>
        </div>
        <p className="text-[11px] leading-relaxed">
          Messages and attachments are client-side encrypted with AES-256-GCM. The relay server routes encrypted envelopes without holding keys.
        </p>
      </div>

      {timeline.map((item) => {
        if (item.kind === 'system') {
          return (
            <div
              key={item.id}
              className="flex items-center justify-center gap-2 py-1 text-xs text-[#8A909E] font-mono"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#1F242D]"></span>
              <span className="text-center">{item.content}</span>
              <span className="text-[10px] text-[#8A909E]/70">
                {formatTimestamp(item.timestamp)}
              </span>
            </div>
          );
        }

        const isOwn = item.senderId === currentUserId;
        const isFile = Boolean(item.attachment);
        const attachment = item.attachment;
        const isImage = attachment?.type.startsWith('image/');
        const ext = attachment?.name.split('.').pop()?.toUpperCase() || 'FILE';

        return (
          <div
            key={item.id}
            className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-2xl mx-auto w-full group`}
          >
            {/* Sender, Type Badge, and Timestamp Header */}
            <div className="flex items-center gap-2 mb-1.5 px-1 text-[11px] font-mono text-[#8A909E]">
              <span className={isOwn ? 'text-[#38BDF8]' : 'text-[#EDEDED] font-medium'}>
                {item.senderName}
              </span>
              <span>·</span>
              <span>{formatTimestamp(item.timestamp)}</span>

              {/* Distinct visual badge indicating message payload type */}
              {isFile ? (
                <span
                  id={`msg-badge-file-${item.id}`}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-[#38BDF8] bg-[#38BDF8]/10 border border-[#38BDF8]/30 shadow-2xs"
                  title="Encrypted file payload negotiated with peer key"
                >
                  <Lock className="w-2.5 h-2.5 text-[#38BDF8]" />
                  <span>ENCRYPTED FILE</span>
                </span>
              ) : (
                <span
                  id={`msg-badge-text-${item.id}`}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-[#8A909E] bg-[#111318] border border-[#1F242D]"
                  title="Encrypted text message"
                >
                  <MessageSquare className="w-2.5 h-2.5 text-[#8A909E]" />
                  <span>TEXT</span>
                </span>
              )}

              {isEncrypted && (
                <ShieldCheck className="w-3 h-3 text-[#38BDF8]/70" title="End-to-end verified session" />
              )}
            </div>

            {/* Message Body with differentiated visual styles */}
            {isFile && attachment ? (
              /* Encrypted File Attachment Card */
              <div
                id={`chat-attachment-${item.id}`}
                className={`rounded-xl text-sm leading-relaxed max-w-[90%] sm:max-w-[80%] transition-all p-3 sm:p-3.5 ${
                  isOwn
                    ? 'bg-[#0B121C] border border-[#38BDF8]/40 text-[#EDEDED] shadow-sm ring-1 ring-[#38BDF8]/10'
                    : 'bg-[#0A1017] border border-[#1F3347] hover:border-[#38BDF8]/40 text-[#EDEDED] shadow-sm'
                }`}
              >
                {/* File Metadata Header Row */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#101A26] border border-[#1E3044] flex items-center justify-center shrink-0">
                    {getFileIcon(attachment.name, attachment.type)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs sm:text-sm font-semibold text-[#EDEDED] truncate" title={attachment.name}>
                      {attachment.name}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono text-[#8A909E]">
                      <span>{formatFileSize(attachment.size)}</span>
                      <span>·</span>
                      <span className="uppercase text-[9px] px-1 py-0.2 rounded bg-[#101824] text-[#38BDF8] border border-[#1F2E40]">
                        {ext}
                      </span>
                    </div>
                  </div>

                  {/* Decrypted Download Button */}
                  <a
                    id={`download-attachment-${item.id}`}
                    href={attachment.dataUrl}
                    download={attachment.name}
                    className="px-2.5 py-1.5 rounded-lg bg-[#142233] hover:bg-[#1C324D] border border-[#38BDF8]/30 hover:border-[#38BDF8]/60 text-xs font-mono text-[#38BDF8] flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer shadow-xs"
                    title="Save decrypted file locally"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Download</span>
                  </a>
                </div>

                {/* Optional Image Thumbnail Preview */}
                {isImage && (
                  <div className="mt-2.5 rounded-lg overflow-hidden border border-[#1F2E40] bg-[#05080C] max-h-64 flex items-center justify-center">
                    <img
                      src={attachment.dataUrl}
                      alt={attachment.name}
                      referrerPolicy="no-referrer"
                      className="max-h-64 max-w-full object-contain rounded-md"
                    />
                  </div>
                )}

                {/* Optional Caption */}
                {item.text ? (
                  <div className="mt-2.5 pt-2 border-t border-[#1E3044] text-xs sm:text-sm text-[#EDEDED] whitespace-pre-wrap">
                    {item.text}
                  </div>
                ) : null}

                {/* Cryptographic Verification Pill */}
                <div className="mt-2.5 pt-1.5 border-t border-[#1E3044]/60 flex items-center justify-between text-[10px] font-mono text-[#8A909E]/70">
                  <span className="flex items-center gap-1">
                    <Lock className="w-3 h-3 text-[#38BDF8]" />
                    <span>AES-256-GCM payload decrypted in memory</span>
                  </span>
                  <span>Direct blob</span>
                </div>
              </div>
            ) : (
              /* Standard Encrypted Text Message Bubble */
              <div
                id={`chat-text-${item.id}`}
                className={`px-4 py-2.5 rounded-xl text-sm leading-relaxed max-w-[85%] sm:max-w-[75%] break-words transition-all ${
                  isOwn
                    ? 'bg-[#111318] border border-[#1F242D] text-[#EDEDED] shadow-xs'
                    : 'bg-[#0D0F12] border border-[#1F242D] text-[#EDEDED] shadow-xs'
                }`}
              >
                <div className="whitespace-pre-wrap selection:bg-[#38BDF8]/30">
                  {item.text}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Subtle Typing Indicator */}
      {peerTyping && (
        <div className="max-w-2xl mx-auto w-full flex items-center gap-2 text-xs font-mono text-[#8A909E] px-1 animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8]"></span>
          <span>{peerTyping} is typing...</span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
