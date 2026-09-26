import React, { useState } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';
import { Room } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { QRCodeView } from '../ui/QRCodeView';
import { useToastStore } from '../ui/Toast';

export interface ShareInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
}

export const ShareInviteModal: React.FC<ShareInviteModalProps> = ({
  isOpen,
  onClose,
  room,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  const roomUrl = `${window.location.origin}/room/${room.id}`;
  const roomCode = room.id.toUpperCase();

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl);
      setCopiedLink(true);
      addToast('Room link copied to clipboard!', 'success');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      addToast('Failed to copy link', 'error');
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      addToast('Room code copied to clipboard!', 'success');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      addToast('Failed to copy code', 'error');
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join "${room.name}" on Modern`,
          text: `Listening together in real-time. Join the room!`,
          url: roomUrl,
        });
      } catch (_) {}
    } else {
      handleCopyLink();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Invite Friends"
      description="Anyone with the link or code can join this room in real time."
      maxWidth="md"
    >
      <div className="space-y-6 pt-2">
        {/* QR Code Presentation */}
        <div className="flex flex-col items-center justify-center p-4 bg-surface-elevated/40 border border-border rounded-2xl">
          <QRCodeView value={roomUrl} size={160} />
          <p className="text-xs text-text-secondary mt-3">
            Scan with camera to join on mobile
          </p>
        </div>

        {/* Room Code */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">
            Room Code
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-surface-elevated border border-border rounded-xl px-4 py-2.5 font-mono text-base font-semibold tracking-widest text-text-primary">
              {roomCode}
            </div>
            <Button
              variant="secondary"
              onClick={handleCopyCode}
              className="px-4 py-2.5 rounded-xl"
            >
              {copiedCode ? <Check className="w-4 h-4 text-accent-emerald" /> : <Copy className="w-4 h-4" />}
              <span>{copiedCode ? 'Copied' : 'Copy'}</span>
            </Button>
          </div>
        </div>

        {/* Direct Link */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">
            Invite Link
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={roomUrl}
              className="flex-1 bg-surface-elevated border border-border rounded-xl px-4 py-2.5 text-xs text-text-secondary select-all truncate"
            />
            <Button
              variant="secondary"
              onClick={handleCopyLink}
              className="px-4 py-2.5 rounded-xl"
            >
              {copiedLink ? <Check className="w-4 h-4 text-accent-emerald" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'Copied' : 'Copy'}</span>
            </Button>
          </div>
        </div>

        {/* Quick Share Trigger */}
        <div className="pt-2">
          <Button
            variant="primary"
            onClick={handleNativeShare}
            className="w-full py-3 rounded-xl font-semibold"
          >
            <Share2 className="w-4 h-4" />
            <span>Share Room via System</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};
