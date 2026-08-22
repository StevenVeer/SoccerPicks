import React, { useEffect, useState } from 'react';
import { buildPickGroups } from '../lib/pickTemplates';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(`${date}T12:00:00Z`));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setSelectedMatch(null);
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
      setError('');
      return;
    }
    setSelectedMatch(match);
    setError('');
  }

  function isOutcomeAdded(option) {
    return picks.some((pick) => (
      pick.match === `${selectedMatch.home} - ${selectedMatch.away}` &&
      pick.pick === option.label
    ));
  }

  function togglePick(option) {
    onAddPick({
      match: `${selectedMatch.home} - ${selectedMatch.away}`,
      pick: option.label,
      odds: 1.01,
    });
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
  const pickGroups = selectedMatch ? buildPickGroups(selectedMatch) : [];

  function chooseDate(nextDate) {
    setDate(nextDate);
    setCalendarMonth(new Date(`${nextDate}T12:00:00Z`));
    setCalendarOpen(false);
  }

  function changeLeague(nextLeague) {
    setLeagueId(nextLeague);
    setSelectedMatch(null);
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
        <span className="data-note">{matches.length} matches</span>
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
              <span className="section-kicker">Picks</span>
              <h3>{selectedMatch.home} vs {selectedMatch.away}</h3>
            </div>
          </div>
          {pickGroups.map((group) => (
            <div className="market" key={group.title}>
              <b>{group.title}</b>
              {group.options && (
                <div className="outcome-list">
                  {group.options.map((option) => {
                    const added = isOutcomeAdded(option);
                    return (
                      <button
                        type="button"
                        className={added ? 'added' : ''}
                        key={option.key}
                        onClick={() => togglePick(option)}
                        disabled={disabled && !added}
                      >
                        <span>{option.short || option.label}</span>
                        {added && <em>Added</em>}
                      </button>
                    );
                  })}
                </div>
              )}
              {group.goalRows && (
                <div className="goal-grid">
                  {group.goalRows.map(({ line, over, under }) => (
                    <div className="goal-row" key={line}>
                      {[over, under].map((option) => {
                        const added = isOutcomeAdded(option);
                        return (
                          <button
                            type="button"
                            className={`goal-option${added ? ' added' : ''}`}
                            key={option.key}
                            onClick={() => togglePick(option)}
                            disabled={disabled && !added}
                          >
                            <span className="goal-option-label">{option.short}</span>
                            {added && <em>Added</em>}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
