import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useCityStore } from '../../store/cityStore';

function getFileRooms(building) {
  if (Array.isArray(building?.file_rooms)) return building.file_rooms;
  if (Array.isArray(building?.file_names)) {
    return building.file_names.map((name, index) => ({
      id: `${name}-${index}`,
      name,
      type: 'file',
      url: null,
      content: '',
    }));
  }
  return [];
}

function roomKind(room) {
  const type = String(room?.type || '').toLowerCase();
  if (type.includes('folder')) return 'folder';
  if (type.includes('document')) return 'doc';
  if (type.includes('spreadsheet')) return 'sheet';
  if (type.includes('presentation')) return 'slides';
  if (type.includes('pdf')) return 'pdf';
  return 'file';
}

function compactText(value, maxLength = 240) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function matchesQuery(text, terms) {
  const haystack = String(text || '').toLowerCase();
  return terms.every(term => haystack.includes(term));
}

function buildSearchResults(buildings, query) {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map(term => term.trim())
    .filter(Boolean);

  if (terms.length === 0) return [];

  const results = [];

  buildings.forEach((building, plotIndex) => {
    if (!building) return;

    if (matchesQuery(building.name, terms)) {
      results.push({
        id: `${building.id}-folder`,
        buildingId: building.id,
        plotIndex,
        buildingName: building.name,
        name: building.name,
        kind: 'folder',
        score: String(building.name || '').toLowerCase().startsWith(terms[0]) ? 3 : 2,
      });
    }

    getFileRooms(building).forEach((room, roomIndex) => {
      if (!room?.name || !matchesQuery(room.name, terms)) return;
      results.push({
        id: room.id || `${building.id}-${roomIndex}`,
        buildingId: building.id,
        plotIndex,
        buildingName: building.name,
        name: room.name,
        kind: roomKind(room),
        url: room.url || null,
        score: String(room.name).toLowerCase().startsWith(terms[0]) ? 4 : 1,
      });
    });
  });

  return results
    .sort((a, b) => b.score - a.score || a.buildingName.localeCompare(b.buildingName))
    .slice(0, 12);
}

function buildAiContext(buildings) {
  return buildings
    .map((building, plotIndex) => ({ building, plotIndex }))
    .filter(({ building }) => building)
    .slice(0, 29)
    .map(({ building, plotIndex }) => ({
      id: building.id,
      name: compactText(building.name, 120),
      type: compactText(building.type, 80),
      plot: plotIndex + 1,
      file_count: building.file_count || getFileRooms(building).length,
      files: getFileRooms(building).slice(0, 30).map(room => ({
        name: compactText(room.name, 180),
        type: compactText(room.type || roomKind(room), 80),
        url: room.url || null,
        content: compactText(room.content, 500),
      })),
    }));
}

export function CityAssistantPanel() {
  const buildings = useCityStore(s => s.buildings);
  const setSearchResults = useCityStore(s => s.setSearchResults);
  const setSelectedPlotIndex = useCityStore(s => s.setSelectedPlotIndex);
  const setSelectedBuilding = useCityStore(s => s.setSelectedBuilding);
  const [query, setQuery] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');

  const results = useMemo(() => buildSearchResults(buildings, query), [buildings, query]);

  useEffect(() => {
    const buildingIds = [...new Set(results.map(result => result.buildingId))].slice(0, 6);
    setSearchResults(buildingIds);

    return () => {
      setSearchResults([]);
    };
  }, [results, setSearchResults]);

  const selectResult = (result) => {
    setSelectedPlotIndex(result.plotIndex);
    setSelectedBuilding(result.buildingId);
    setSearchResults([result.buildingId]);
  };

  const askAi = async (event) => {
    event.preventDefault();
    const cleanQuestion = question.trim();
    if (!cleanQuestion || asking) return;

    setAsking(true);
    setAnswer('');
    setError('');

    try {
      const response = await api.askFiles(cleanQuestion, buildAiContext(buildings));
      setAnswer(response.answer || 'I could not find enough file context to answer that yet.');
    } catch (err) {
      console.error('File AI question failed:', err);
      setError(err.message || 'The AI could not answer right now. Check that the backend and Gemini key are working.');
    } finally {
      setAsking(false);
    }
  };

  return (
    <section className="city-assistant glass-panel">
      <div className="city-assistant__header">
        <div>
          <p>Drive Tools</p>
          <h2>Find files and ask AI</h2>
        </div>
      </div>

      <div className="city-assistant__section">
        <label htmlFor="city-file-search">Search Drive files</label>
        <input
          id="city-file-search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Find a file, folder, or building"
        />
        {query.trim() && (
          <div className="city-assistant__results">
            {results.length === 0 && (
              <p className="city-assistant__empty">No loaded files or folders match.</p>
            )}
            {results.map(result => (
              <button
                key={result.id}
                type="button"
                className="city-assistant__result"
                onClick={() => selectResult(result)}
              >
                <span>{result.kind}</span>
                <strong>{result.name}</strong>
                <small>{result.buildingName}</small>
              </button>
            ))}
          </div>
        )}
      </div>

      <form className="city-assistant__section" onSubmit={askAi}>
        <label htmlFor="city-ai-question">Ask AI about the files</label>
        <div className="city-assistant__ask">
          <input
            id="city-ai-question"
            value={question}
            onChange={event => setQuestion(event.target.value)}
            placeholder="What is in my Drive city?"
          />
          <button type="submit" disabled={asking || !question.trim()}>
            {asking ? 'Thinking...' : 'Ask AI'}
          </button>
        </div>
        {error && <p className="city-assistant__error">{error}</p>}
        {answer && <p className="city-assistant__answer">{answer}</p>}
      </form>
    </section>
  );
}
