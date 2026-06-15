'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { DjCard } from '@/components/DjCard';
import type { AnalyzedArtist, AnalyzeLineupResponse } from '@/lib/types';

const SAVED_KEY = 'lineup-lens-saved-artists';

function readSavedArtists(): AnalyzedArtist[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AnalyzedArtist[];
  } catch {
    return [];
  }
}

function writeSavedArtists(artists: AnalyzedArtist[]) {
  window.localStorage.setItem(SAVED_KEY, JSON.stringify(artists));
}

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [artistNamesText, setArtistNamesText] = useState('');
  const [response, setResponse] = useState<AnalyzeLineupResponse | null>(null);
  const [savedArtists, setSavedArtists] = useState<AnalyzedArtist[]>([]);
  const [activeTab, setActiveTab] = useState<'results' | 'saved'>('results');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSavedArtists(readSavedArtists());
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const savedNames = useMemo(() => new Set(savedArtists.map((artist) => artist.name.toLowerCase())), [savedArtists]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setError(null);
  }

  function toggleSave(artist: AnalyzedArtist) {
    const exists = savedArtists.some((saved) => saved.name.toLowerCase() === artist.name.toLowerCase());
    const next = exists
      ? savedArtists.filter((saved) => saved.name.toLowerCase() !== artist.name.toLowerCase())
      : [...savedArtists, artist];

    setSavedArtists(next);
    writeSavedArtists(next);
  }

  async function analyzeLineup({ demo = false }: { demo?: boolean } = {}) {
    setLoading(true);
    setError(null);
    setActiveTab('results');

    try {
      setLoadingStep('Uploading lineup');

      const formData = new FormData();
      if (selectedFile) formData.append('image', selectedFile);
      if (demo) formData.append('demo', 'true');
      if (artistNamesText.trim()) formData.append('artistNames', artistNamesText.trim());

      setLoadingStep('Reading lineup');
      const res = await fetch('/api/analyze-lineup', {
        method: 'POST',
        body: formData
      });

      setLoadingStep('Finding DJs');
      const data = (await res.json()) as AnalyzeLineupResponse;

      if (!res.ok) {
        throw new Error(data.warnings?.[0] ?? 'Analyze request failed.');
      }

      setLoadingStep('Building cards');
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  }

  const currentArtists = activeTab === 'saved' ? savedArtists : response?.artists ?? [];

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero__badge">Festival discovery web app</div>
        <h1>Lineup Lens</h1>
        <p>
          페스티벌 라인업 스크린샷을 올리고, 모르는 DJ를 빠르게 훑어보세요. 지금은 Vercel 배포용 demo/mock
          버전입니다.
        </p>
      </section>

      <section className="panel upload-panel">
        <label className="upload-box">
          <input type="file" accept="image/*" onChange={handleFileChange} />
          <span className="upload-box__icon">＋</span>
          <strong>{selectedFile ? selectedFile.name : '라인업 스크린샷 선택'}</strong>
          <small>인스타 포스터, 타임테이블 이미지, 캡처 사진</small>
        </label>

        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="preview" src={previewUrl} alt="Selected lineup preview" />
        ) : null}

        <label className="manual-input">
          <span>선택사항: DJ 이름을 직접 붙여넣기</span>
          <textarea
            value={artistNamesText}
            onChange={(event) => setArtistNamesText(event.target.value)}
            placeholder={'예: Peggy Gou\nFred again..\nCharlotte de Witte'}
            rows={4}
          />
          <small>OCR 연결 전에도 여기 이름을 넣으면 그 이름 기준으로 카드가 만들어집니다.</small>
        </label>

        <div className="button-row">
          <button className="primary-button" onClick={() => analyzeLineup()} disabled={loading || (!selectedFile && !artistNamesText.trim())}>
            Analyze lineup
          </button>
          <button className="secondary-button" onClick={() => analyzeLineup({ demo: true })} disabled={loading}>
            Use demo lineup
          </button>
        </div>

        {loading ? <p className="status">{loadingStep}...</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      {response?.warnings?.length ? (
        <section className="warnings">
          {response.warnings.slice(0, 4).map((warning) => (
            <p key={warning}>⚠ {warning}</p>
          ))}
        </section>
      ) : null}

      <section className="tabs">
        <button className={activeTab === 'results' ? 'tab tab--active' : 'tab'} onClick={() => setActiveTab('results')}>
          Results {response?.artists?.length ? `(${response.artists.length})` : ''}
        </button>
        <button className={activeTab === 'saved' ? 'tab tab--active' : 'tab'} onClick={() => setActiveTab('saved')}>
          Saved {savedArtists.length ? `(${savedArtists.length})` : ''}
        </button>
      </section>

      <section className="cards-grid">
        {currentArtists.length > 0 ? (
          currentArtists.map((artist) => (
            <DjCard
              artist={artist}
              isSaved={savedNames.has(artist.name.toLowerCase())}
              onToggleSave={toggleSave}
              key={`${activeTab}-${artist.name}`}
            />
          ))
        ) : (
          <div className="empty-state">
            <h2>{activeTab === 'saved' ? '아직 저장한 DJ가 없어요.' : '아직 분석 결과가 없어요.'}</h2>
            <p>{activeTab === 'saved' ? '마음에 드는 DJ 카드에서 Save를 눌러보세요.' : 'demo lineup을 먼저 실행해보세요.'}</p>
          </div>
        )}
      </section>
    </main>
  );
}
