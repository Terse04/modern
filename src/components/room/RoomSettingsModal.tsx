import React, { useState } from 'react';
import { Shield, Users, Radio, MessageSquare, PlayCircle } from 'lucide-react';
import { Room } from '../../types';
import { roomService } from '../../services/roomService';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToastStore } from '../ui/Toast';

export interface RoomSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  onSettingsUpdated?: (updatedRoom: Room) => void;
}

export const RoomSettingsModal: React.FC<RoomSettingsModalProps> = ({
  isOpen,
  onClose,
  room,
  onSettingsUpdated,
}) => {
  const [settings, setSettings] = useState(room.settings);
  const [isLoading, setIsLoading] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await roomService.updateRoom(room.id, { settings });
      addToast('Room settings updated successfully');
      if (onSettingsUpdated) {
        onSettingsUpdated({ ...room, settings });
      }
      onClose();
    } catch {
      addToast('Failed to update settings', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Room Settings"
      description="Manage permissions and visibility for your listening space."
      maxWidth="md"
    >
      <div className="space-y-6 pt-2">
        {/* Visibility */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-3">
            <Radio className="w-4 h-4 text-text-muted" />
            Visibility
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['public', 'unlisted', 'private'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setSettings({ ...settings, visibility: v })}
                className={`px-3 py-2 rounded-xl text-xs font-medium capitalize border transition-all ${
                  settings.visibility === v
                    ? 'bg-accent-cream text-bg border-accent-cream'
                    : 'bg-surface-elevated text-text-secondary border-border hover:border-border-focus'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Playback Permissions */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-3">
            <PlayCircle className="w-4 h-4 text-text-muted" />
            Playback Control
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['host_only', 'voting', 'everyone'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setSettings({ ...settings, playbackPermissions: p })}
                className={`px-3 py-2 rounded-xl text-[11px] font-medium uppercase tracking-wider border transition-all ${
                  settings.playbackPermissions === p
                    ? 'bg-accent-cream text-bg border-accent-cream'
                    : 'bg-surface-elevated text-text-secondary border-border hover:border-border-focus'
                }`}
              >
                {p.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-3">
            <Shield className="w-4 h-4 text-text-muted" />
            Features
          </label>
          
          <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface-elevated/50">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-4 h-4 text-text-muted" />
              <div>
                <p className="text-sm font-medium text-text-primary">Enable Chat</p>
                <p className="text-xs text-text-muted">Allow members to send messages</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings.allowChat}
                onChange={(e) => setSettings({ ...settings, allowChat: e.target.checked })}
              />
              <div className="w-9 h-5 bg-surface-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-emerald"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface-elevated/50">
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-text-muted" />
              <div>
                <p className="text-sm font-medium text-text-primary">Queue Additions</p>
                <p className="text-xs text-text-muted">Allow members to add tracks</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings.allowQueueAdditions}
                onChange={(e) => setSettings({ ...settings, allowQueueAdditions: e.target.checked })}
              />
              <div className="w-9 h-5 bg-surface-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-emerald"></div>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 mt-2 border-t border-border flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} isLoading={isLoading}>
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
};
