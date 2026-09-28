import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  Play,
  Pause,
  Image as ImageIcon,
  X,
  Search,
  Globe,
  Plus,
  Loader2,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Track } from '../../types';
import { storageService } from '../../services/storageService';
import { openMusicService, CURATED_OPEN_TRACKS } from '../../services/openMusicService';
import {
  extractAudioMetadata,
  formatSeconds,
  ExtractedAudioMetadata,
} from '../../utils/audioMetadata';
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

const OPEN_GENRES = [
  { label: 'All Open Tracks', value: 'all' },
  { label: 'Lo-Fi / Chill', value: 'Lo-Fi' },
  { label: 'Electronic', value: 'Electronic' },
  { label: 'Ambient', value: 'Ambient' },
  { label: 'Chillhop', value: 'Chillhop' },
  { label: 'Synthwave', value: 'Synthwave' },
  { label: 'Acoustic', value: 'Acoustic' },
];

export const AudioUploadModal: React.FC<AudioUploadModalProps> = ({
  isOpen,
  onClose,
  onUploaded,
}) => {
  const addToast = useToastStore((s) => s.addToast);

  // Tab State: 'open' | 'upload'
  const [activeTab, setActiveTab] = useState<'open' | 'upload'>('open');

  // --- OPEN MUSIC STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [openTracks, setOpenTracks] = useState<Track[]>(CURATED_OPEN_TRACKS);
  const [isLoadingOpen, setIsLoadingOpen] = useState(false);
  const [playingOpenTrackId, setPlayingOpenTrackId] = useState<string | null>(null);

  // --- UPLOAD STATE ---
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [artworkPreview, setArtworkPreview] = useState<string>(PRESET_ARTWORKS[0]);
  const [meta, setMeta] = useState<ExtractedAudioMetadata | null>(null);

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album] = useState('Studio Session');
  const [genre, setGenre] = useState(GENRE_OPTIONS[0]);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Audio preview refs
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

  // Fetch open tracks on tab select or genre change
  useEffect(() => {
    if (!isOpen || activeTab !== 'open') return;

    let isCancelled = false;
    const fetchOpen = async () => {
      setIsLoadingOpen(true);
      try {
        const tracks = searchQuery.trim()
          ? await openMusicService.searchTracks(searchQuery.trim(), 20)
          : await openMusicService.getTrendingTracks(selectedGenre, 20);
        if (!isCancelled) {
          setOpenTracks(tracks);
        }
      } catch {
        if (!isCancelled) setOpenTracks(CURATED_OPEN_TRACKS);
      } finally {
        if (!isCancelled) setIsLoadingOpen(false);
      }
    };

    const timer = setTimeout(fetchOpen, searchQuery ? 350 : 0);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, activeTab, selectedGenre, searchQuery]);

  const handleSelectOpenTrack = (track: Track) => {
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current.src = '';
    }
    setPlayingOpenTrackId(null);
    onUploaded(track);
    addToast(`Added "${track.title}" to room queue!`, 'success');
    handleClose();
  };

  const toggleOpenTrackPreview = (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioPreviewRef.current) {
      audioPreviewRef.current = new Audio();
    }

    if (playingOpenTrackId === track.id) {
      audioPreviewRef.current.pause();
      setPlayingOpenTrackId(null);
    } else {
      audioPreviewRef.current.src = track.audioUrl;
      audioPreviewRef.current
        .play()
        .then(() => {
          setPlayingOpenTrackId(track.id);
        })
        .catch(() => {
          addToast('Could not play preview', 'error');
          setPlayingOpenTrackId(null);
        });

      audioPreviewRef.current.onended = () => {
        setPlayingOpenTrackId(null);
      };
    }
  };

  // --- UPLOAD HANDLERS ---
  const handleFileSelect = async (file: File) => {
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      setPlayingOpenTrackId(null);
    }

    setSelectedFile(file);
    setIsAnalyzing(true);

    try {
      const extracted = await extractAudioMetadata(file);
      setMeta(extracted);
      setTitle(extracted.title);
      setArtist(extracted.artist);
      if (extracted.duration > 0) {
        addToast(`Parsed audio: ${extracted.title} (${formatSeconds(extracted.duration)})`, 'info');
      }
    } catch (err: unknown) {
      console.warn('[AudioUploadModal] Extraction error:', err);
      setTitle(file.name.replace(/\.[^/.]+$/, ''));
      setArtist('Local Artist');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleArtworkSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      addToast('Please upload an image file (PNG/JPG)', 'error');
      return;
    }
    setArtworkFile(file);
    const url = URL.createObjectURL(file);
    setArtworkPreview(url);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files?.[0]) {
      handleFileSelect(files[0]);
    }
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
        precomputedMeta: meta ?? undefined,
        onProgress: (p) => setUploadProgress(p),
      });

      addToast(`"${newTrack.title}" uploaded & added to room!`, 'success');
      onUploaded(newTrack);
      handleClose();
    } catch (err: unknown) {
      console.error('[AudioUploadModal] Upload error:', err);
      addToast((err instanceof Error ? err.message : null) || 'Upload failed', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current.src = '';
    }
    setPlayingOpenTrackId(null);
    setSelectedFile(null);
    setMeta(null);
    setIsUploading(false);
    setUploadProgress(0);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Music to Room" maxWidth="xl">
      <div className="space-y-5">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 p-1 bg-surface-elevated rounded-xl border border-border/60">
          <button
            type="button"
            onClick={() => setActiveTab('open')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'open'
                ? 'bg-accent-cream text-bg shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Open Music Library (Free)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'upload'
                ? 'bg-accent-cream text-bg shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload Your Audio</span>
          </button>
        </div>

        {/* TAB 1: OPEN MUSIC LIBRARY */}
        {activeTab === 'open' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search open music by title, artist, or style..."
                className="w-full bg-surface-elevated border border-border/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Genre Quick Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {OPEN_GENRES.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => {
                    setSelectedGenre(g.value);
                    setSearchQuery('');
                  }}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all border ${
                    selectedGenre === g.value && !searchQuery
                      ? 'bg-accent-cream text-bg border-accent-cream font-semibold'
                      : 'bg-surface border-border/60 text-text-secondary hover:border-border-focus'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            {/* Track Results List */}
            <div className="space-y-2 max-h-[48vh] overflow-y-auto pr-1">
              {isLoadingOpen ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-text-muted">
                  <Loader2 className="w-6 h-6 animate-spin text-accent-cream" />
                  <span className="text-xs">Finding open tracks...</span>
                </div>
              ) : openTracks.length === 0 ? (
                <div className="py-12 text-center text-text-muted text-xs">
                  No open tracks found matching &ldquo;{searchQuery}&rdquo;. Try another keyword!
                </div>
              ) : (
                openTracks.map((track) => {
                  const isPreviewing = playingOpenTrackId === track.id;
                  return (
                    <div
                      key={track.id}
                      onClick={() => handleSelectOpenTrack(track)}
                      className="group flex items-center justify-between p-2.5 rounded-xl border border-border/50 bg-surface hover:bg-surface-elevated hover:border-accent-cream/40 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Artwork & Play preview overlay */}
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-surface-elevated">
                          <img
                            src={track.artwork}
                            alt={track.title}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={(e) => toggleOpenTrackPreview(track, e)}
                            title={isPreviewing ? 'Pause preview' : 'Listen to preview'}
                            className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity ${
                              isPreviewing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}
                          >
                            {isPreviewing ? (
                              <Pause className="w-4 h-4 text-accent-cream fill-current" />
                            ) : (
                              <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                            )}
                          </button>
                        </div>

                        {/* Title & Artist */}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-text-primary group-hover:text-accent-cream transition-colors truncate">
                            {track.title}
                          </p>
                          <p className="text-[11px] text-text-muted truncate mt-0.5">
                            {track.artist}
                            {track.genre && ` • ${track.genre}`}
                          </p>
                        </div>
                      </div>

                      {/* Right: Duration & Add Button */}
                      <div className="flex items-center gap-2.5 flex-shrink-0 pl-2">
                        <span className="text-[11px] text-text-muted font-mono">
                          {formatSeconds(track.duration)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectOpenTrack(track);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-accent-cream/15 hover:bg-accent-cream text-accent-cream hover:text-bg font-semibold text-[11px] transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 2: UPLOAD LOCAL AUDIO */}
        {activeTab === 'upload' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {!selectedFile ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="group relative cursor-pointer rounded-2xl border-2 border-dashed border-border/80 hover:border-accent-cream bg-surface-elevated/40 hover:bg-surface-elevated/70 p-8 sm:p-10 text-center transition-all duration-300 flex flex-col items-center justify-center space-y-3 shadow-inner"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac"
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-accent-cream/10 border border-accent-cream/25 flex items-center justify-center text-accent-cream group-hover:scale-105 transition-all">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    Drag and drop your audio track here
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    Supports MP3, WAV, FLAC, M4A up to 50MB
                  </p>
                </div>
                <Button variant="secondary" size="sm" type="button" className="pointer-events-none mt-1">
                  Browse Audio File
                </Button>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-surface-elevated p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3.5">
                    <div className="relative group w-14 h-14 rounded-xl overflow-hidden bg-surface flex-shrink-0 shadow-md">
                      <img
                        src={artworkPreview}
                        alt="Cover preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-accent-emerald flex-shrink-0" />
                        <h4 className="text-xs font-semibold text-text-primary truncate max-w-[200px] sm:max-w-xs">
                          {selectedFile.name}
                        </h4>
                      </div>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB •{' '}
                        {meta ? formatSeconds(meta.duration) : 'Ready'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setMeta(null);
                    }}
                    className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Metadata Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-[11px] font-medium text-text-secondary block mb-1">
                      Track Title
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Midnight Waves"
                      className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-text-secondary block mb-1">
                      Artist Name
                    </label>
                    <input
                      type="text"
                      value={artist}
                      onChange={(e) => setArtist(e.target.value)}
                      placeholder="e.g. Sonic Drift"
                      className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-text-secondary block mb-1">
                      Genre
                    </label>
                    <select
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                      className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-border-focus"
                    >
                      {GENRE_OPTIONS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-text-secondary block mb-1">
                      Cover Artwork
                    </label>
                    <button
                      type="button"
                      onClick={() => artInputRef.current?.click()}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-surface border border-border text-xs text-text-secondary hover:text-text-primary hover:border-border-focus transition"
                    >
                      <span className="truncate">{artworkFile ? artworkFile.name : 'Upload custom cover'}</span>
                      <ImageIcon className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                    </button>
                    <input
                      type="file"
                      ref={artInputRef}
                      onChange={(e) => e.target.files?.[0] && handleArtworkSelect(e.target.files[0])}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Upload Action */}
                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <Button variant="ghost" size="sm" type="button" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    type="button"
                    onClick={handleUploadSubmit}
                    disabled={isUploading || isAnalyzing || !title.trim()}
                    className="min-w-[120px]"
                  >
                    {isUploading ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Uploading {uploadProgress}%
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <UploadCloud className="w-3.5 h-3.5" />
                        Upload & Add
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
