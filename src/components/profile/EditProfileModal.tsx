import React, { useState, useRef } from 'react';
import { X, Upload, Sparkles, Check, Image as ImageIcon, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

const AVATAR_PRESETS = [
  {
    id: 'lofi_chill',
    label: 'Lo-Fi Chill',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'studio_producer',
    label: 'Studio Producer',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'cyber_neon',
    label: 'Neon Beats',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'audiophile',
    label: 'Audiophile',
    url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'vinyl_collector',
    label: 'Vinyl Master',
    url: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'synthwave',
    label: 'Synthwave',
    url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'deep_focus',
    label: 'Deep Focus',
    url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'midnight_dj',
    label: 'Midnight DJ',
    url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'ambient_dream',
    label: 'Ambient Dream',
    url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'minimal_wave',
    label: 'Minimalist',
    url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80',
  },
];

const STATUS_PRESETS = [
  'Listening with friends',
  'Exploring Lo-Fi soundscapes',
  'Deep focus coding flow',
  'Digging for rare vinyl',
  'Chilling in ambient space',
  'Ready to DJ next track',
];

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialName: string;
  initialBio: string;
  initialStatus: string;
  initialAvatar: string;
  onSave: (data: { name: string; bio: string; currentStatus: string; avatar: string }) => Promise<void>;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  initialName,
  initialBio,
  initialStatus,
  initialAvatar,
  onSave,
}) => {
  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(initialBio);
  const [currentStatus, setCurrentStatus] = useState(initialStatus);
  const [selectedAvatar, setSelectedAvatar] = useState(initialAvatar);
  const [avatarTab, setAvatarTab] = useState<'presets' | 'upload' | 'url'>('presets');
  const [customUrl, setCustomUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image size should be less than 5MB.');
      return;
    }

    setUploadError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          const maxDim = 512;
          
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Output as WEBP for smaller size, max 1.5MB equivalent
            const dataUrl = canvas.toDataURL('image/webp', 0.85);
            setSelectedAvatar(dataUrl);
          } else {
            setSelectedAvatar(event.target!.result as string);
          }
        };
        img.onerror = () => {
          setUploadError('Failed to process image.');
        };
        img.src = event.target.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyUrl = () => {
    if (customUrl.trim().startsWith('http')) {
      setSelectedAvatar(customUrl.trim());
      setUploadError(null);
    } else {
      setUploadError('Please enter a valid HTTP/HTTPS image URL.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setIsSaving(true);
      await onSave({
        name: name.trim(),
        bio: bio.trim(),
        currentStatus: currentStatus.trim() || 'Listening with friends',
        avatar: selectedAvatar,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-surface border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/40 bg-surface-elevated/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-accent-cream/10 border border-accent-cream/20 text-accent-cream">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">Customize Sound Identity</h2>
              <p className="text-xs text-text-muted">Update your display name, avatar, and vibe status</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-primary rounded-xl hover:bg-surface-elevated transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1">
          {/* Avatar Preview & Source Selector */}
          <div className="bg-surface-elevated/50 border border-border/60 rounded-2xl p-4">
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="relative group flex-shrink-0">
                <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-accent-cream/40 shadow-xl ring-4 ring-accent-cream/10 relative">
                  <img
                    src={selectedAvatar}
                    alt="Avatar preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-accent-cream text-bg text-[9px] font-bold">
                  Preview
                </div>
              </div>

              <div className="flex-1 w-full text-center sm:text-left">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">
                  Choose Avatar Style
                </h3>
                {/* Tabs */}
                <div className="flex items-center justify-center sm:justify-start gap-1 p-1 bg-surface rounded-xl border border-border/60">
                  <button
                    type="button"
                    onClick={() => setAvatarTab('presets')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      avatarTab === 'presets'
                        ? 'bg-accent-cream text-bg font-semibold shadow'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Presets</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvatarTab('upload')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      avatarTab === 'upload'
                        ? 'bg-accent-cream text-bg font-semibold shadow'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <Upload className="w-3 h-3" />
                    <span>Upload</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvatarTab('url')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      avatarTab === 'url'
                        ? 'bg-accent-cream text-bg font-semibold shadow'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <LinkIcon className="w-3 h-3" />
                    <span>URL</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Avatar Tab Content */}
            <div className="mt-4 pt-4 border-t border-border/40">
              {avatarTab === 'presets' && (
                <div>
                  <div className="grid grid-cols-5 gap-2.5">
                    {AVATAR_PRESETS.map((preset) => {
                      const isSelected = selectedAvatar === preset.url;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setSelectedAvatar(preset.url)}
                          title={preset.label}
                          className={`relative rounded-xl overflow-hidden aspect-square border-2 transition-all group ${
                            isSelected
                              ? 'border-accent-cream scale-105 shadow-md ring-2 ring-accent-cream/30'
                              : 'border-border/60 hover:border-accent-cream/50 opacity-80 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={preset.url}
                            alt={preset.label}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-accent-cream/20 flex items-center justify-center">
                              <Check className="w-4 h-4 text-accent-cream drop-shadow" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-text-muted text-center mt-2.5">
                    Click any curated aesthetic sound avatar to select
                  </p>
                </div>
              )}

              {avatarTab === 'upload' && (
                <div className="space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border/80 hover:border-accent-cream/60 rounded-xl p-5 text-center cursor-pointer transition-colors bg-surface/40 hover:bg-surface/70"
                  >
                    <ImageIcon className="w-8 h-8 text-accent-cream/80 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-text-primary">Click to select photo</p>
                    <p className="text-[11px] text-text-muted mt-0.5">Supports PNG, JPG, or WEBP up to 5MB</p>
                  </div>
                  {uploadError && (
                    <p className="text-xs text-accent-coral text-center">{uploadError}</p>
                  )}
                </div>
              )}

              {avatarTab === 'url' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://example.com/avatar.jpg"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      className="flex-1 bg-surface border border-border rounded-xl px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cream"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleApplyUrl}
                    >
                      Apply
                    </Button>
                  </div>
                  {uploadError && (
                    <p className="text-xs text-accent-coral">{uploadError}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Name Field */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary block mb-2">
              Display Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name or DJ alias"
              maxLength={40}
              className="w-full bg-surface-elevated/70 border border-border/80 rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cream"
            />
          </div>

          {/* Status Message Field */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary block mb-2">
              Current Listening Vibe / Status
            </label>
            <input
              type="text"
              value={currentStatus}
              onChange={(e) => setCurrentStatus(e.target.value)}
              placeholder="e.g. Exploring Lo-Fi soundscapes"
              maxLength={50}
              className="w-full bg-surface-elevated/70 border border-border/80 rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cream mb-2"
            />
            {/* Quick status chips */}
            <div className="flex flex-wrap gap-1.5">
              {STATUS_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCurrentStatus(preset)}
                  className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${
                    currentStatus === preset
                      ? 'bg-accent-emerald/20 text-accent-emerald border-accent-emerald/40'
                      : 'bg-surface text-text-muted border-border hover:border-border-focus'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Bio Field */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary block mb-2">
              Bio / Music Tastes
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Share the genres you enjoy, your setup, or what inspires your music journey..."
              maxLength={200}
              className="w-full bg-surface-elevated/70 border border-border/80 rounded-xl p-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cream resize-none"
            />
            <div className="text-[10px] text-text-muted text-right mt-1">
              {bio.length}/200 characters
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSaving || !name.trim()}
              className="gap-2"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Profile</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
