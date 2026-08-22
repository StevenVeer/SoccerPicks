const GOAL_LINES = [1.5, 2.5, 3.5, 4.5];

export function buildPickGroups(match) {
  const { home, away } = match;
  return [
    {
      title: 'Match Result',
      options: [
        { key: 'home_win', label: `${home} to win` },
        { key: 'draw', label: 'Draw' },
        { key: 'away_win', label: `${away} to win` },
      ],
    },
    {
      title: 'Double Chance',
      options: [
        { key: 'double_1x', label: `${home} win or Draw (1X)` },
        { key: 'double_12', label: `${home} or ${away} to win (12)` },
        { key: 'double_x2', label: `${away} win or Draw (X2)` },
      ],
    },
    {
      title: 'Both Teams to Score',
      options: [
        { key: 'btts_yes', label: 'Both teams to score — Yes', short: 'Yes' },
        { key: 'btts_no', label: 'Both teams to score — No', short: 'No' },
      ],
    },
    {
      title: 'Goals — Over/Under',
      goalRows: GOAL_LINES.map((line) => {
        const lineKey = String(line).replace('.', '_');
        return {
          line,
          over: { key: `over_${lineKey}`, label: `Over ${line} goals`, short: `Over ${line}` },
          under: { key: `under_${lineKey}`, label: `Under ${line} goals`, short: `Under ${line}` },
        };
      }),
    },
  ];
}
