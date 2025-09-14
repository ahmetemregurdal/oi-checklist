// Virtual Contest History JavaScript
document.addEventListener('DOMContentLoaded', async () => {
  const sessionToken = localStorage.getItem('sessionToken');

  // If we're not logged in, redirect to the home page
  check_session();
  const username = localStorage.getItem('username');

  // Show the welcome message
  document.getElementById('welcome-message').innerHTML = `Welcome, ${username}`;

  // Show loading skeleton initially
  document.getElementById('vc-history-loading').style.display = 'block';
  document.getElementById('vc-history-list').style.display = 'none';
  document.getElementById('vc-history-empty').style.display = 'none';
  document.getElementById('stats-skeleton').style.display = 'flex';
  document.getElementById('vc-history-stats').style.display = 'none';

  // Fetch contest data and problems data (like virtual.js)
  let contestData = {};
  let problemsData = {};

  try {
    // Fetch virtual contest data to get contest metadata
    const vcResponse = await fetch(`${apiUrl}/api/virtual-contests`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });

    if (vcResponse.ok) {
      const vcData = await vcResponse.json();
      contestData = vcData.contests;

      // Fetch problems data for all contest sources
      const contestSources = Object.keys(contestData);
      const problemsResponse = await fetch(`${apiUrl}/api/problems?names=${contestSources.join(',')}`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });

      if (problemsResponse.ok) {
        problemsData = await problemsResponse.json();
      }
    }
  } catch (error) {
    console.error('Error fetching contest/problems data:', error);
  }

  // Fetch virtual contest history
  try {
    const response = await fetch(`${apiUrl}/api/virtual-contests/history`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });

    if (!response.ok) {
      console.error('Failed to fetch virtual contest history');
      document.getElementById('vc-history-loading').style.display = 'none';
      showEmptyState();
      return;
    }

    const data = await response.json();
    const contests = data.contests || [];

    if (contests.length === 0) {
      showEmptyState();
    } else {
      // Fetch contest scores for medal calculation
      const contestKeys = contests.map(c => `${c.contest_name}|${c.contest_stage || ''}`);
      let contestScores = {};

      try {
        const scoresResponse = await fetch(`${apiUrl}/api/contest-scores?contests=${contestKeys.join(',')}`, {
          method: 'GET',
          credentials: 'include',
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        });

        if (scoresResponse.ok) {
          contestScores = await scoresResponse.json();
        }
      } catch (error) {
        console.error('Error fetching contest scores:', error);
      }

      displayContests(contests, contestData, problemsData, contestScores);
      updateStats(contests);
    }

  } catch (error) {
    console.error('Error fetching virtual contest history:', error);
    document.getElementById('vc-history-loading').style.display = 'none';
    showEmptyState();
  }
});

function showEmptyState() {
  document.getElementById('vc-history-loading').style.display = 'none';
  document.getElementById('vc-history-list').style.display = 'none';
  document.getElementById('vc-history-empty').style.display = 'block';
  document.getElementById('stats-skeleton').style.display = 'none';
  document.getElementById('vc-history-stats').style.display = 'none';

  // Reset stats to 0
  document.getElementById('total-contests').textContent = '0';
  document.getElementById('total-time').textContent = '0h';
}

function displayContests(contests, contestData, problemsData, contestScores) {
  const listContainer = document.getElementById('vc-history-list');
  listContainer.innerHTML = '';

  contests.forEach(contest => {
    const item = createContestItem(contest, contestData, problemsData, contestScores);
    listContainer.appendChild(item);
  });

  // Hide loading and show content
  document.getElementById('vc-history-loading').style.display = 'none';
  document.getElementById('vc-history-list').style.display = 'flex';
  document.getElementById('vc-history-empty').style.display = 'none';
  document.getElementById('stats-skeleton').style.display = 'none';
  document.getElementById('vc-history-stats').style.display = 'flex';
}

function createContestItem(contest, contestData, problemsData, contestScores) {
  const item = document.createElement('div');
  item.className = 'vc-history-item';

  // Calculate medal type
  // Calculate medal type (supports gold/silver/bronze or gold/prizer)
  const contestKey = `${contest.contest_name}|${contest.contest_stage || ''}`;
  const scoreData = contestScores[contestKey];
  let medalClass = '';
  let medalText = '';

  if (scoreData && Array.isArray(scoreData.medal_cutoffs) && scoreData.medal_cutoffs.length > 0) {
    const totalScore = contest.total_score || 0;
    const cutoffs = scoreData.medal_cutoffs;
    const labels = scoreData.medal_labels || scoreData.medal_types || [];

    const labelAt = (idx, fallback) => (labels[idx] ? String(labels[idx]).toLowerCase() : fallback);

    if (cutoffs.length >= 3) {
      const [goldCutoff, silverCutoff, bronzeCutoff] = cutoffs;
      if (totalScore >= goldCutoff) {
        medalClass = 'medal-gold';
        medalText = 'Gold';
      } else if (totalScore >= silverCutoff) {
        medalClass = 'medal-silver';
        medalText = 'Silver';
      } else if (totalScore >= bronzeCutoff) {
        medalClass = 'medal-bronze';
        medalText = 'Bronze';
      }
    } else if (cutoffs.length === 2) {
      // Two-tier scheme; default to gold/prizer if labels aren’t provided
      const firstLabel = labelAt(0, 'gold');
      const secondLabel = labelAt(1, 'prizer');
      if (totalScore >= cutoffs[0]) {
        medalClass = `medal-${firstLabel}`;
        medalText = firstLabel.charAt(0).toUpperCase() + firstLabel.slice(1);
      } else if (totalScore >= cutoffs[1]) {
        medalClass = `medal-${secondLabel}`;
        medalText = secondLabel.charAt(0).toUpperCase() + secondLabel.slice(1);
      }
    } else if (cutoffs.length === 1) {
      // Single cutoff; honor the provided label or treat as gold
      const onlyLabel = labelAt(0, 'gold');
      if (totalScore >= cutoffs[0]) {
        medalClass = `medal-${onlyLabel}`;
        medalText = onlyLabel.charAt(0).toUpperCase() + onlyLabel.slice(1);
      }
    }
  }

  // Add medal class to item
  if (medalClass) {
    item.classList.add(medalClass);
  }

  // Calculate time used
  const startTime = new Date(contest.started_at);
  const endTime = new Date(contest.ended_at);
  const durationMs = endTime - startTime;
  const durationMinutes = Math.floor(durationMs / (1000 * 60));
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  const timeUsed = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  // Format date
  const date = new Date(contest.started_at);
  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Calculate problem count and max score
  const problemScores = JSON.parse(contest.per_problem_scores || '[]');
  const problemCount = problemScores.length || 3;
  const maxScore = problemCount * 100;
  const scoreRate = Math.round(((contest.total_score || 0) / maxScore) * 100);

  // Calculate score variance (standard deviation)
  let variance = 0;
  if (problemScores.length > 0) {
    const mean = problemScores.reduce((a, b) => a + b, 0) / problemScores.length;
    const squaredDiffs = problemScores.map(score => Math.pow(score - mean, 2));
    variance = Math.round(Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / problemScores.length));
  }

  // Find best problem with actual name
  let bestProblem = 'None';
  if (problemScores.length > 0) {
    const maxScore = Math.max(...problemScores);
    const maxIndex = problemScores.indexOf(maxScore);

    // Try to get actual problem name
    let problemName = `Problem ${maxIndex + 1}`;
    try {
      // Find the contest in contestData to get problems
      for (const [olympiad, years] of Object.entries(contestData)) {
        for (const [year, contests] of Object.entries(years)) {
          const contestInfo = contests.find(c => c.name === contest.contest_name &&
            (contest.contest_stage ? c.stage === contest.contest_stage : c.stage == null));
          if (contestInfo && contestInfo.problems && contestInfo.problems[maxIndex]) {
            const prob = contestInfo.problems[maxIndex];
            // Find the problem in problemsData, considering extra if present
            const olympiadProblems = problemsData[prob.source];
            if (olympiadProblems && olympiadProblems[prob.year]) {
              const hasExtra = prob.extra !== undefined && prob.extra !== null && prob.extra !== '';
              const problem = olympiadProblems[prob.year].find(p =>
                p.source === prob.source &&
                p.year === prob.year &&
                p.number === prob.number &&
                (!hasExtra || p.extra === prob.extra)
              );
              if (problem) {
                problemName = problem.name;
              }
            }
            break;
          }
        }
        if (problemName !== `Problem ${maxIndex + 1}`) break;
      }
    } catch (error) {
      console.error('Error getting problem name:', error);
    }

    bestProblem = `${problemName}: ${maxScore}pts`;
  }

  // Get contest metadata (location/website)
  let contestLocation = '';
  let contestWebsite = '';
  try {
    for (const [olympiad, years] of Object.entries(contestData)) {
      for (const [year, contests] of Object.entries(years)) {
        const contestInfo = contests.find(c => c.name === contest.contest_name &&
          (contest.contest_stage ? c.stage === contest.contest_stage : c.stage == null));
        if (contestInfo) {
          contestLocation = contestInfo.location || '';
          contestWebsite = contestInfo.website || '';
          break;
        }
      }
      if (contestLocation || contestWebsite) break;
    }
  } catch (error) {
    console.error('Error getting contest metadata:', error);
  }

  item.innerHTML = `
    <div class="vc-history-item-header">
      <div>
        <div class="vc-history-title">${contest.contest_source} ${contest.contest_year}${contest.contest_stage ? ` ${contest.contest_stage}` : ''}</div>
        <div class="vc-history-date">${formattedDate} | ${problemCount} problems</div>
        <div class="vc-history-metadata">${contestLocation || contestWebsite ? `${contestLocation}${contestLocation && contestWebsite ? ' | ' : ''}${contestWebsite ? `<a href="${contestWebsite}" target="_blank">${contestWebsite}</a>` : ''}` : ''}</div>
      </div>
      <div class="vc-history-score">${contest.total_score || 0}/${maxScore}</div>
    </div>
    <div class="vc-history-details">
      <div class="vc-history-detail">
        <div class="vc-history-detail-label">Time Used</div>
        <div class="vc-history-detail-value">${timeUsed}</div>
      </div>
      <div class="vc-history-detail">
        <div class="vc-history-detail-label">Score Rate</div>
        <div class="vc-history-detail-value">
          <div class="score-progress-bar">
            <div class="score-progress-fill" style="width: ${scoreRate}%"></div>
          </div>
          <span class="score-percentage">${scoreRate}%</span>
        </div>
      </div>
      <div class="vc-history-detail">
        <div class="vc-history-detail-label">Best Problem</div>
        <div class="vc-history-detail-value">${bestProblem}</div>
      </div>
      <div class="vc-history-detail">
        <div class="vc-history-detail-label">Score Variance</div>
        <div class="vc-history-detail-value">${variance}pts</div>
      </div>
    </div>
  `;

  // Add click handler to navigate to detail page
  item.addEventListener('click', (e) => {
    // Don't navigate if clicking on a link
    if (e.target.tagName === 'A' || e.target.closest('a')) {
      return;
    }
    // Use query parameters with clean slug
    const slug = (contest.contest_name + (contest.contest_stage || '')).toLowerCase().replace(/\s+/g, '');
    window.location.href = `virtual-contest-detail?contest=${slug}`;
  });

  return item;
}

function updateStats(contests) {
  if (contests.length === 0) return;

  // Total contests
  document.getElementById('total-contests').textContent = contests.length;

  // Calculate total time
  let totalMinutes = 0;
  contests.forEach(contest => {
    const startTime = new Date(contest.started_at);
    const endTime = new Date(contest.ended_at);
    const durationMs = endTime - startTime;
    const durationMinutes = Math.floor(durationMs / (1000 * 60));
    totalMinutes += durationMinutes;
  });

  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  let totalTimeText;
  if (totalHours > 0) {
    totalTimeText = `${totalHours}h ${remainingMinutes}m`;
  } else {
    totalTimeText = `${remainingMinutes}m`;
  }

  document.getElementById('total-time').textContent = totalTimeText;
}