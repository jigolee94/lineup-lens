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

async function runFreeOcrInBrowser(
  file: File,
  onProgress: (message: string) => void
): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  onProgress('Loading free OCR engine');
  const worker = await createWorker('eng', 1, {
    logger: (message) => {
      const percent = typeof message.progress === 'number' ? ` ${Math.round(message.progress * 100)}%` : '';
      if (message.status) onProgress(`OCR: ${message.status}${percent}`);
    }
  });

  const result = await worker.recognize(file);
  await worker.terminate();
  return result.data.text ?? '';
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
  const [ocrPreview, setOcrPreview] = useState('');
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

  const savedNames = useMemo(
    () => new Set(savedArtists.map((artist) => artist.name.toLowerCase())),
    [savedArtists]
  );

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setError(null);
    setOcrPreview('');
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
      let freeOcrText = '';
      if (!demo && selectedFile) {
        setLoadingStep('Running free OCR in your browser');
        freeOcrText = await runFreeOcrInBrowser(selectedFile, setLoadingStep);
        setOcrPreview(freeOcrText);
      }

      const formData = new FormData();
      if (demo) formData.append('demo', 'true');
      if (artistNamesText.trim()) formData.append('artistNames', artistNamesText.trim());
      if (freeOcrText.trim()) formData.append('ocrText', freeOcrText.trim());

      setLoadingStep('Finding DJs');
      const res = await fetch('/api/analyze-lineup', {
        method: 'POST',
        body: formData
      });

      setLoadingStep('Fetching music recommendations');
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
        <div className="hero__badge">Free browser OCR + DJ discovery</div>
        <h1>Lineup Lens</h1>
        <p>
          페스티벌 라인업 스크린샷을 올리면 <strong>무료 OCR</strong>이 브라우저 안에서 돌아가고, DJ 이름 후보를 뽑아서
          유튜브 추천 링크와 장르 태그를 빠르게 정리합니다.
        </p>
      </section>

      <section className="panel upload-panel">
        <label className="upload-box">
          <input type="file" accept="image/*" onChange={handleFileChange} />
          <span className="upload-box__icon">＋</span>
          <strong>{selectedFile ? selectedFile.name : '라인업 스크린샷 선택'}</strong>
          <small>무료 OCR은 브라우저에서 실행됩니다. 작은 글씨 이미지는 정확도가 떨어질 수 있어요.</small>
        </label>

        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="preview" src={previewUrl} alt="Selected lineup preview" />
        ) : null}

        <label className="manual-input">
          <span>선택사항: DJ 이름 직접 붙여넣기</span>
          <textarea
            value={artistNamesText}
            onChange={(event) => setArtistNamesText(event.target.value)}
            placeholder={`예: Peggy Gou\nFred again..\nCharlotte de Witte`}
            rows={4}
          />
          <small>OCR이 잘 안 읽으면 여기에 DJ 이름을 붙여넣어서 보완할 수 있습니다.</small>
        </label>

        <div className="button-row">
          <button
            className="primary-button"
            onClick={() => analyzeLineup()}
            disabled={loading || (!selectedFile && !artistNamesText.trim())}
          >
            Analyze lineup
          </button>
          <button className="secondary-button" onClick={() => analyzeLineup({ demo: true })} disabled={loading}>
            Use demo lineup
          </button>
        </div>

        {loading ? <p className="status">{loadingStep}...</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      {ocrPreview ? (
        <section className="ocr-preview panel">
          <div className="ocr-preview__top">
            <h2>OCR raw text</h2>
            <span>검토용</span>
          </div>
          <pre>{ocrPreview}</pre>
        </section>
      ) : null}

      {response?.warnings?.length ? (
        <section className="warnings">
          {response.warnings.slice(0, 6).map((warning) => (
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
            <p>
              {activeTab === 'saved'
                ? '마음에 드는 DJ 카드에서 Save를 눌러보세요.'
                : '스크린샷을 올리거나 demo lineup을 먼저 실행해보세요.'}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
