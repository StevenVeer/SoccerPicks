import React, { useEffect, useState } from 'react';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const shortDateFormatter = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

function shiftDate(value, days) {
  const next = new Date(`${value}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function monthLabel(value) {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(value);
}

function calendarDays(month) {
  const firstDay = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
  const startOffset = (firstDay.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - startOffset + 1;
    return day > 0 && day <= daysInMonth
      ? new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day))
      : null;
  });
}

export default function MatchPicker({ picks, onAddPick, disabled }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [matches, setMatches] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [leagueId, setLeagueId] = useState('all');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [odds, setOdds] = useState(null);
  const [loading, setLoading] = useState(false);
  const [oddsLoading, setOddsLoading] = useState(false);
  const [error, setError] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(`${date}T12:00:00Z`));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setSelectedMatch(null);
    setOdds(null);
    fetch(`/api/football/matches?date=${date}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Matches could not be loaded.');
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setMatches(data.matches || []);
        setLeagues(data.leagues || []);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  function selectMatch(match) {
    if (selectedMatch?.id === match.id) {
      setSelectedMatch(null);
      setOdds(null);
      setOddsLoading(false);
      setError('');
      return;
    }
    setSelectedMatch(match);
    setOdds(null);
    setOddsLoading(true);
    setError('');
    fetch(`/api/football/odds?fixture=${match.id}&sport=${encodeURIComponent(match.sportKey)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Odds could not be loaded.');
        return data;
      })
      .then(setOdds)
      .catch((fetchError) => setError(fetchError.message))
      .finally(() => setOddsLoading(false));
  }

  function addOutcome(market, outcome) {
    onAddPick({
      match: `${selectedMatch.home} - ${selectedMatch.away}`,
      pick: outcome.label,
      odds: outcome.odds,
      market: market.name,
      bookmaker: outcome.bookmaker || odds.bookmaker,
      oddsUpdatedAt: odds.updatedAt,
    });
  }

  function isOutcomeAdded(market, outcome) {
    return picks.some((pick) => (
      pick.match === `${selectedMatch.home} - ${selectedMatch.away}` &&
      pick.pick === outcome.label &&
      pick.market === market.name
    ));
  }

  const visibleMatches = leagueId === 'all'
    ? matches
    : matches.filter((match) => match.league === leagueId);
  const groupedMatches = leagues
    .map((league) => ({
      ...league,
      matches: visibleMatches.filter((match) => match.league === league.name),
    }))
    .filter((league) => league.matches.length > 0);
  const today = new Date().toISOString().slice(0, 10);
  const quickDates = [today, shiftDate(today, 1)];
  const days = calendarDays(calendarMonth);

  function chooseDate(nextDate) {
    setDate(nextDate);
    setCalendarMonth(new Date(`${nextDate}T12:00:00Z`));
    setCalendarOpen(false);
  }

  function changeLeague(nextLeague) {
    setLeagueId(nextLeague);
    setSelectedMatch(null);
    setOdds(null);
    setOddsLoading(false);
    setError('');
  }

  return (
    <section className="match-picker" aria-label="Current matches">
      <div className="match-picker-heading">
        <div>
          <span className="section-kicker">Live data</span>
          <h2>Choose a match</h2>
        </div>
        <div className="date-picker-control">
          <button type="button" className="date-step" onClick={() => chooseDate(shiftDate(date, -1))} aria-label="Previous day">
            ‹
          </button>
          <button type="button" className="date-display" onClick={() => setCalendarOpen((open) => !open)} aria-expanded={calendarOpen}>
            <span aria-hidden="true">▣</span>
            {shortDateFormatter.format(new Date(`${date}T12:00:00Z`))}
          </button>
          <button type="button" className="date-step" onClick={() => chooseDate(shiftDate(date, 1))} aria-label="Next day">
            ›
          </button>
          {calendarOpen && (
            <div className="calendar-popover">
              <div className="calendar-header">
                <button type="button" onClick={() => setCalendarMonth((month) => new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1)))} aria-label="Previous month">‹</button>
                <strong>{monthLabel(calendarMonth)}</strong>
                <button type="button" onClick={() => setCalendarMonth((month) => new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)))} aria-label="Next month">›</button>
              </div>
              <div className="calendar-weekdays">{['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map((day) => <span key={day}>{day}</span>)}</div>
              <div className="calendar-grid">
                {days.map((day, index) => day ? (
                  <button
                    type="button"
                    className={day.toISOString().slice(0, 10) === date ? 'selected' : ''}
                    key={day.toISOString()}
                    onClick={() => chooseDate(day.toISOString().slice(0, 10))}
                  >
                    {day.getUTCDate()}
                  </button>
                ) : <span className="calendar-empty" key={`empty-${index}`} />)}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="match-picker-controls">
        <div className="quick-dates" aria-label="Quick date selection">
          {quickDates.map((quickDate, index) => (
            <button
              type="button"
              className={date === quickDate ? 'active' : ''}
              key={quickDate}
              onClick={() => chooseDate(quickDate)}
            >
              {index === 0 ? 'Today' : 'Tomorrow'}
            </button>
          ))}
        </div>
        <div className="competition-select">
          <select value={leagueId} onChange={(event) => changeLeague(event.target.value)} aria-label="Competition filter">
            <option value="all">All competitions</option>
            {leagues.map((league) => <option key={league.id} value={league.name}>{league.name}</option>)}
          </select>
        </div>
        <span className="data-note">{matches.length} matches · odds on demand</span>
      </div>

      {loading && <div className="picker-message">Loading matches…</div>}
      {error && <div className="error picker-error">{error}</div>}
      {!loading && !error && visibleMatches.length === 0 && (
        <div className="picker-message">No matches found for this date.</div>
      )}
      <div className="match-groups">
        {groupedMatches.map((league) => (
          <div className="match-group" key={league.id}>
            <div className="match-group-heading">
              <strong>{league.name}</strong>
              <span>{league.matches.length} {league.matches.length === 1 ? 'match' : 'matches'}</span>
            </div>
            <div className="match-list">
              {league.matches.map((match) => (
                <button
                  type="button"
                  className={`match-item${selectedMatch?.id === match.id ? ' selected' : ''}`}
                  key={match.id}
                  onClick={() => selectMatch(match)}
                  disabled={disabled}
                >
                  <span className="match-kickoff">{dateFormatter.format(new Date(match.kickoff))}</span>
                  <strong>{match.home} <span>vs</span> {match.away}</strong>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedMatch && (
        <div className="odds-panel">
          <div className="odds-panel-heading">
            <div>
              <span className="section-kicker">Markets</span>
              <h3>{selectedMatch.home} vs {selectedMatch.away}</h3>
            </div>
            {odds?.bookmaker && <small>{odds.bookmaker}</small>}
          </div>
          {oddsLoading && <div className="picker-message">Loading odds…</div>}
          {!oddsLoading && odds && odds.markets.length === 0 && (
            <div className="picker-message">No odds available for this match.</div>
          )}
          <div className="market-list">
            {odds?.markets.map((market) => (
              <div className="market" key={market.name}>
                <b>{market.name}</b>
                <div className="outcome-list">
                  {market.outcomes.map((outcome) => (
                    <button
                      type="button"
                      className={isOutcomeAdded(market, outcome) ? 'added' : ''}
                      key={`${market.name}-${outcome.label}`}
                      onClick={() => addOutcome(market, outcome)}
                      disabled={disabled && !isOutcomeAdded(market, outcome)}
                    >
                      <span>{outcome.label}</span>
                      {isOutcomeAdded(market, outcome) && <em>Added</em>}
                      <strong>{outcome.odds.toFixed(2)}</strong>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
