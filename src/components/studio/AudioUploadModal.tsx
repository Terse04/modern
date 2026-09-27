import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  Play,
  Pause,
  Image as ImageIcon,
  Sparkles,
  X,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Track } from '../../types';
import { storageService } from '../../services/storageService';
import { extractAudioMetadata, formatSeconds, AudioMetadataError, ExtractedAudioMetadata } from '../../utils/audioMetadata';
import { useToastStore } from '../ui/Toast';

interface AudioUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploaded: (track: Track) => void;
}

const GENRE_OPTIONS = [
  'Lo-Fi / Ambient',
  'Synthwave / Cyberpunk',
  'Deep House / Melodic',
  'Chillhop / Beats',
  'Electronic / Downtempo',
  'Indie / Dream Pop',
  'Acoustic / Neo-Classical',
  'Future Bass',
];

const PRESET_ARTWORKS = [
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=400&q=80',
];

export const AudioUploadModal: React.FC<AudioUploadModalProps> = ({
  isOpen,
  onClose,
  onUploaded,
}) => {
  const addToast = useToastStore((s) => s.addToast);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [artworkPreview, setArtworkPreview] = useState<string>(PRESET_ARTWORKS[0]);
  const [meta, setMeta] = useState<ExtractedAudioMetadata | null>(null);

  // Editable fields
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('Studio Session');
  const [genre, setGenre] = useState(GENRE_OPTIONS[0]);

  // Upload status
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // In-modal preview playback
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const artInputRef = useRef<HTMLInputElement>(null);

  // Clean up audio on unmount / close
  useEffect(() => {
    return () => {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current.src = '';
      }
    };
  }, []);

  const handleFileSelect = async (file: File) => {
    // Stop previous preview
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      setIsPlayingPreview(false);
    }

    setSelectedFile(file);
    setIsAnalyzing(true);

    try {
      // extractAudioMetadata enforces the 50 MB limit and the audio MIME /
      // extension check, and throws AudioMetadataError with a message worth
      // showing. The old inline guard here only checked the extension, so a
      // multi-gigabyte file got a full file.arrayBuffer() read into memory.
      const extracted = await extractAudioMetadata(file);
      setMeta(extracted);
      setTitle(extracted.title);
      setArtist(extracted.artist);

      // Create preview object URL
      if (!audioPreviewRef.current) {
        audioPreviewRef.current = new Audio();
      }
      audioPreviewRef.current.src = URL.createObjectURL(file);
      audioPreviewRef.current.onended = () => setIsPlayingPreview(false);
    } catch (err) {
      console.error('[AudioUploadModal] Extraction error:', err);
      setSelectedFile(null);
      setMeta(null);
      addToast(
        err instanceof AudioMetadataError ? err.message : 'Could not read that audio file.',
        'error'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const togglePreviewPlay = () => {
    if (!audioPreviewRef.current) return;
    if (isPlayingPreview) {
      audioPreviewRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      audioPreviewRef.current
        .play()
        .then(() => setIsPlayingPreview(true))
        .catch((e) => console.warn('Preview play error:', e));
    }
  };

  const handleArtworkFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      addToast('Please select an image file for artwork', 'error');
      return;
    }
    setArtworkFile(file);
    setArtworkPreview(URL.createObjectURL(file));
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) {
      addToast('Please choose an audio file first', 'error');
      return;
    }

    if (!title.trim()) {
      addToast('Please provide a track title', 'error');
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      const newTrack = await storageService.uploadTrack({
        file: selectedFile,
        title: title.trim(),
        artist: artist.trim() || 'Unknown Artist',
        album: album.trim() || 'Single',
        genre,
        customArtworkUrl: !artworkFile ? artworkPreview : undefined,
        artworkFile: artworkFile || undefined,
        // Already decoded during handleFileSelect - don't decode it again.
        precomputedMeta: meta ?? undefined,
        onProgress: (p) => setUploadProgress(p),
      });

      addToast(`"${newTrack.title}" added to library!`, 'success');
      onUploaded(newTrack);
      handleClose();
    } catch (err: any) {
      console.error('[AudioUploadModal] Upload error:', err);
      addToast(err.message || 'Upload failed', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current.src = '';
    }
    setIsPlayingPreview(false);
    setSelectedFile(null);
    setMeta(null);
    setIsUploading(false);
    setUploadProgress(0);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Audio Studio — Upload Track" maxWidth="lg">
      <div className="space-y-6">
        {/* Dropzone */}
        {!selectedFile ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="group relative cursor-pointer rounded-2xl border-2 border-dashed border-zinc-700 hover:border-violet-500 bg-zinc-900/60 hover:bg-violet-950/20 p-8 sm:p-12 text-center transition-all duration-300 flex flex-col items-center justify-center space-y-4 shadow-inner"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac"
              className="hidden"
            />
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600/30 to-fuchsia-600/30 border border-violet-500/40 flex items-center justify-center text-violet-400 group-hover:scale-110 group-hover:text-white transition-all shadow-lg shadow-violet-500/10">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-100">
                Drag and drop your audio track here
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Supports MP3, WAV, FLAC, OGG, M4A up to 50MB
              </p>
            </div>
            <Button variant="secondary" size="sm" type="button" className="pointer-events-none mt-2">
              Browse Files
            </Button>
          </div>
        ) : (
          /* File Selected & Analyzer Preview Card */
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <div className="relative group w-16 h-16 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0 shadow-md">
                  <img
                    src={artworkPreview}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={togglePreviewPlay}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                  >
                    {isPlayingPreview ? (
                      <Pause className="w-6 h-6 fill-current text-violet-400" />
                    ) : (
                      <Play className="w-6 h-6 fill-current text-white ml-0.5" />
                    )}
                  </button>
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="font-semibold text-zinc-100 text-sm sm:text-base line-clamp-1">
                      {selectedFile.name}
                    </h4>
                  </div>
                  <div className="flex items-center space-x-3 text-xs text-zinc-400 mt-1">
                    <span>{meta?.formattedSize || 'Analyzing...'}</span>
                    <span>•</span>
                    <span>{meta ? formatSeconds(meta.duration) : '--:--'}</span>
                    <span>•</span>
                    <span className="text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setMeta(null);
                  if (audioPreviewRef.current) audioPreviewRef.current.pause();
                }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
                title="Change File"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Simulated / Decoded Waveform Preview */}
            {meta?.waveform && (
              <div className="bg-zinc-950/60 rounded-xl p-3 border border-zinc-800/80">
                <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-2">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-violet-400" /> Audio Waveform Spectrum
                  </span>
                  <button
                    type="button"
                    onClick={togglePreviewPlay}
                    className="text-xs text-violet-400 hover:text-violet-300 font-medium flex items-center gap-1"
                  >
                    {isPlayingPreview ? (
                      <>
                        <Pause className="w-3 h-3 fill-current" /> Pause Preview
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" /> Listen Preview
                      </>
                    )}
                  </button>
                </div>
                <div className="h-10 flex items-end gap-[2px] justify-between px-1">
                  {meta.waveform.map((bar, idx) => (
                    <div
                      key={idx}
                      className={`flex-1 rounded-full transition-all duration-300 ${
                        isPlayingPreview
                          ? 'bg-gradient-to-t from-violet-500 to-fuchsia-400 animate-pulse'
                          : 'bg-zinc-700 hover:bg-violet-400'
                      }`}
                      style={{
                        height: `${Math.max(12, Math.round(bar * 100))}%`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Metadata Edit Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Track Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Midnight Reverie"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Artist / Producer
                </label>
                <input
                  type="text"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="e.g. Echo Pulse"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Genre / Mood
                </label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 transition"
                >
                  {GENRE_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Album / Release
                </label>
                <input
                  type="text"
                  value={album}
                  onChange={(e) => setAlbum(e.target.value)}
                  placeholder="e.g. Neon Horizon"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition"
                />
              </div>
            </div>

            {/* Artwork selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Cover Artwork
                </label>
                <button
                  type="button"
                  onClick={() => artInputRef.current?.click()}
                  className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 font-medium"
                >
                  <ImageIcon className="w-3.5 h-3.5" /> Upload Custom Image
                </button>
                <input
                  type="file"
                  ref={artInputRef}
                  onChange={(e) => e.target.files?.[0] && handleArtworkFileSelect(e.target.files[0])}
                  accept="image/*"
                  className="hidden"
                />
              </div>

              <div className="grid grid-cols-6 gap-2">
                {PRESET_ARTWORKS.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setArtworkFile(null);
                      setArtworkPreview(url);
                    }}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                      artworkPreview === url && !artworkFile
                        ? 'border-violet-500 ring-2 ring-violet-500/40 scale-105'
                        : 'border-zinc-800 opacity-60 hover:opacity-100 hover:border-zinc-600'
                    }`}
                  >
                    <img src={url} alt={`Preset ${i}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Upload Progress Bar */}
        {isUploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-300 font-medium">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-violet-400 animate-ping" />
                Uploading track and syncing audio storage...
              </span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 transition-all duration-300 rounded-full"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <Button variant="ghost" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleUploadSubmit}
            isLoading={isUploading || isAnalyzing}
            disabled={!selectedFile || !title.trim()}
            className="px-6"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Publish Track
          </Button>
        </div>
      </div>
    </Modal>
  );
};
