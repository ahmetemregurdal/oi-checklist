document.addEventListener('DOMContentLoaded', async () => {
  const sessionToken = localStorage.getItem('sessionToken');

  // Get contest slug from URL query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const slug = urlParams.get('contest');

  if (!slug) {
    showError();
    return;
  }

  // If we're not logged in, redirect to the home page
  check_session();
  const username = localStorage.getItem('username');

  // Show the welcome message
  document.getElementById('welcome-message').innerHTML = `Welcome, ${username}`;

  // Load contest details
  await loadContestDetails(slug);
});

async function loadContestDetails(slug) {
  const sessionToken = localStorage.getItem('sessionToken');

  try {
    // Fetch contest details using slug
    const response =
      await fetch(`${apiUrl}/data/virtual/detail`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: sessionToken, slug })
      });

    if (!response.ok) {
      showError();
      return;
    }

    const contestData = await response.json();

    // Fetch additional data for proper display
    await fetchAdditionalData(contestData);

  } catch (error) {
    console.error('Error loading contest details:', error);
    showError();
  }
}

async function fetchAdditionalData(contest) {
  const sessionToken = localStorage.getItem('sessionToken');
  try {
    // Fetch contest metadata and problems data
    const vcResponse = await fetch(`${apiUrl}/data/virtual/summary`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: sessionToken })
    });

    let contestMetadata = {};
    let problemsData = {};

    if (vcResponse.ok) {
      const vcData = await vcResponse.json();
      const contestDataAll = vcData.contests;
      // add those additional fields
      const fullContest = contestDataAll.find(j => j.id == contest.contestId);
      contest = {
        contest: fullContest,
        contestName: fullContest.name,
        contestStage: fullContest.stage,
        ...contest
      };

      // Fetch problems data
      const problemsResponse = await fetch(`${apiUrl}/data/problems`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: sessionToken,
          sources: [contest.contest.source]
        })
      });

      if (problemsResponse.ok) {
        problemsData = await problemsResponse.json();
      }

      // Find contest metadata
      contestMetadata = contest.contest;
    }

    // Fetch contest scores for medal/rank data
    const scoresResponse =
      await fetch(`${apiUrl}/data/virtual/scores`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contests: [contest.contestId] })
      });

    let contestScores = {};
    if (scoresResponse.ok) {
      contestScores = await scoresResponse.json();
      contestScores = contestScores.map(i => i.scores);
      contestScores = Object.fromEntries(contestScores.map(i => [i.contestId, i]));
    }
    displayContestDetails(contest, contestMetadata, problemsData, contestScores[contest.contestId]);
  } catch (error) {
    console.error('Error fetching additional data:', error);
    displayContestDetails(contest, {}, {}, {});
  }
}

// Helper to format ordinal suffixes
function formatOrdinal(n) {
  const num = Math.abs(Math.floor(Number(n)));
  const mod100 = num % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${num}th`;
  switch (num % 10) {
    case 1: return `${num}st`;
    case 2: return `${num}nd`;
    case 3: return `${num}rd`;
    default: return `${num}th`;
  }
}

function displayContestDetails(contest, contestMetadata, problemsData, scoreData) {
  const hasSubs = contest.submissions.length > 0;
  document.getElementById('vc-detail-loading').style.display = 'none';
  document.getElementById('vc-detail-content').style.display = 'block';

  // Parse problem scores
  const problemScores = contest.perProblemScores;
  const problemCount = problemScores.length;
  const maxScore = problemCount * 100;
  const totalScore = contest.score;

  // Calculate medal and rank
  let medalClass = '';
  let medalText = 'No Medal';
  let rank = 'N/A';
  let totalParticipants = 'N/A';

  // convert to regular array
  scoreData.problemScores = Object.values(scoreData.problemScores);

  if (scoreData && scoreData.medalCutoffs.length > 0) {
    const cutoffs = scoreData.medalCutoffs.map(Number);
    const labels = scoreData.medalNames;
    const labelAt = (idx, fallback) => (labels[idx] ? String(labels[idx]).toLowerCase() : fallback);

    if (cutoffs.length >= 3) {
      const [goldCutoff, silverCutoff, bronzeCutoff] = cutoffs;
      if (totalScore >= goldCutoff) { medalClass = 'medal-gold'; medalText = 'Gold'; }
      else if (totalScore >= silverCutoff) { medalClass = 'medal-silver'; medalText = 'Silver'; }
      else if (totalScore >= bronzeCutoff) { medalClass = 'medal-bronze'; medalText = 'Bronze'; }
    } else if (cutoffs.length === 2) {
      // Two-tier scheme defaults to gold/prizer unless labels specify otherwise
      const firstLabel = labelAt(0, 'gold');
      const secondLabel = labelAt(1, 'prizer');
      if (totalScore >= cutoffs[0]) { medalClass = `medal-${firstLabel}`; medalText = firstLabel.charAt(0).toUpperCase() + firstLabel.slice(1); }
      else if (totalScore >= cutoffs[1]) { medalClass = `medal-${secondLabel}`; medalText = secondLabel.charAt(0).toUpperCase() + secondLabel.slice(1); }
    } else if (cutoffs.length === 1) {
      const onlyLabel = labelAt(0, 'gold');
      if (totalScore >= cutoffs[0]) { medalClass = `medal-${onlyLabel}`; medalText = onlyLabel.charAt(0).toUpperCase() + onlyLabel.slice(1); }
    }
  }

  // Rank/participants are based on problemScores distribution if available
  if (scoreData && scoreData.problemScores.length > 0) {
    const allTotalScores = [];
    const numParticipants = scoreData.problemScores[0].length;

    for (let i = 0; i < numParticipants; i++) {
      let participantTotal = 0;
      for (let j = 0; j < scoreData.problemScores.length; j++) {
        participantTotal += scoreData.problemScores[j][i];
      }
      allTotalScores.push(participantTotal);
    }

    allTotalScores.sort((a, b) => b - a);

    let currentRank = 1;
    for (let i = 0; i < allTotalScores.length; i++) {
      if (allTotalScores[i] > totalScore) {
        currentRank = i + 1;
      } else {
        break;
      }
    }
    rank = currentRank;
    totalParticipants = allTotalScores.length;
  }

  // Calculate time used
  const startTime = new Date(contest.startedAt);
  const endTime = new Date(contest.endedAt);
  const durationMs = endTime - startTime;
  const durationMinutes = Math.floor(durationMs / (1000 * 60));
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  const timeUsed = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  // Format date
  const date = new Date(contest.startedAt);
  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Calculate stats
  const scoreRate = Math.round((totalScore / maxScore) * 100);
  const variance = calculateVariance(problemScores);
  const bestScore = problemScores.length > 0 ? Math.max(...problemScores) : 0;
  const fullScores = problemScores.filter(score => score === 100).length;

  // Calculate advanced statistics
  let avgProblemScore = 0;
  let medianScore = 0;
  let participantPercentile = 0;
  let solvedCount = problemScores.filter(score => score > 0).length;
  let contestMean = 0;
  let aboveAverage = 0;

  if (problemScores.length > 0) {
    avgProblemScore = Math.round(
      problemScores.reduce((a, b) => a + b, 0) / problemScores.length);

    const sortedMyScores = [...problemScores].sort((a, b) => b - a);
    medianScore = problemScores.length % 2 === 0 ?
      (sortedMyScores[Math.floor(problemScores.length / 2) - 1] +
        sortedMyScores[Math.floor(problemScores.length / 2)]) /
      2 :
      sortedMyScores[Math.floor(problemScores.length / 2)];
    medianScore = Math.round(medianScore);

    // Find perfect problems
    perfectProblems = problemScores.map((score, idx) => ({ score, idx }))
      .filter(p => p.score === 100)
      .map(p => p.idx);
  }

  // Calculate contest-wide statistics
  if (scoreData && scoreData.problemScores) {
    // Calculate percentile
    const allTotalScores = [];
    const numParticipants = scoreData.problemScores[0].length;

    for (let i = 0; i < numParticipants; i++) {
      let participantTotal = 0;
      for (let j = 0; j < scoreData.problemScores.length; j++) {
        participantTotal += scoreData.problemScores[j][i];
      }
      allTotalScores.push(participantTotal);
    }

    const betterThanCount =
      allTotalScores.filter(score => score < totalScore).length;
    participantPercentile =
      Math.round((betterThanCount / allTotalScores.length) * 100);

    // Calculate contest mean
    contestMean = Math.round(allTotalScores.reduce((a, b) => a + b, 0) / allTotalScores.length);
    aboveAverage = totalScore - contestMean;
  }

  // Build the detail page content with proper styling
  const content = `
    <div class="vc-detail-main ${medalClass}">
      <div class="vc-detail-header-section">
        <div>
          <div class="vc-detail-title">${contest.contest.source.toUpperCase()} ${contest.contest.year}${contest.contest.stage ? ` ${contest.contest.stage}` : ''}</div>
          <div class="vc-detail-subtitle">${problemCount} problems</div>
          ${contestMetadata.location || contestMetadata.website ?
      `<div class="vc-detail-location">${contestMetadata.location || ''}${contestMetadata.location && contestMetadata.website ? ' | ' :
        ''}${contestMetadata.website ?
          `<a href="${contestMetadata.website}" target="_blank">${contestMetadata.website}</a>` :
          ''}</div>` :
      ''}
        </div>
        ${medalClass ? `<div class="vc-detail-medal-ribbon ${medalClass}"></div>` :
      ''}
      </div>
      
      <div class="vc-detail-summary">
        <div class="vc-detail-score-display">
          <div class="vc-detail-total-score">${totalScore}/${maxScore}</div>
          <div class="vc-detail-score-rate-container">
            <div class="score-progress-bar">
              <div class="score-progress-fill" style="width: ${scoreRate}%"></div>
            </div>
            <span class="score-percentage">${scoreRate}% score rate</span>
          </div>
        </div>
        <div class="vc-detail-rank">
          <div class="rank-number">#${rank}</div>
          <div class="rank-text">out of ${totalParticipants}</div>
        </div>
      </div>
      
      <div class="vc-detail-metadata">
        <div class="vc-detail-meta-item">
          <div class="vc-detail-meta-label">Date</div>
          <div class="vc-detail-meta-value">${formattedDate}</div>
        </div>
        <div class="vc-detail-meta-item">
          <div class="vc-detail-meta-label">Time Used</div>
          <div class="vc-detail-meta-value">${timeUsed}</div>
        </div>
        <div class="vc-detail-meta-item">
          <div class="vc-detail-meta-label">Medal</div>
          <div class="vc-detail-meta-value">${medalText}</div>
        </div>
        <div class="vc-detail-meta-item">
          <div class="vc-detail-meta-label">Percentile</div>
          <div class="vc-detail-meta-value">${formatOrdinal(participantPercentile)}</div>
        </div>
      </div>
      
      <div class="vc-detail-problems-section">
        <h3>Problems</h3>
        <div class="vc-detail-problems">
          ${generateProblemsHTML(
        problemScores, contest, contestMetadata, problemsData, scoreData)}
        </div>
      </div>
      
      <div class="vc-detail-stats-section">
        <h3>Analysis</h3>
        
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-number ${fullScores >= problemCount / 2 ? 'positive' : ''}">${fullScores}</div>
            <div class="stat-label">Perfect scores</div>
          </div>
          <div class="stat-item">
            <div class="stat-number ${solvedCount === problemCount ?
      'positive' :
      (solvedCount < problemCount / 2 ? 'negative' :
        'warning')}">${solvedCount}</div>
            <div class="stat-label">Attempted</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">${avgProblemScore}</div>
            <div class="stat-label">Average</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">${Math.min(...problemScores)}-${Math.max(...problemScores)}</div>
            <div class="stat-label">Range</div>
          </div>
        </div>

        ${hasSubs ? `
        <div class="analysis-graphs">
          <div class="analysis-graphs-header">
            <span class="analysis-graphs-title">Scores</span>
            <div class="graph-toggles" id="graph-toggles"></div>
          </div>
          <div class="analysis-graphs-canvas-wrap">
            <canvas id="score-timeline-static" height="300"></canvas>
            <canvas id="score-timeline-series" height="300"></canvas>
          </div>
        </div>
        <div class="analysis-timeline">
          <div class="analysis-graphs-header">
            <span class="analysis-graphs-title">Timeline</span>
          </div>
          <div class="timeline-canvas-wrap">
            <canvas id="contest-timeline" height="80"></canvas>
            <div id="timeline-tooltip" class="timeline-tooltip" style="display:none;"></div>
          </div>
          <div class="timeline-heatmap-wrap">
            <canvas id="contest-heatmap" height="18"></canvas>
          </div>
        </div>
        ` :
      ``}

        <div class="contest-comparison">
          <div class="comparison-header">
            <span class="comparison-title">Performance</span>
          </div>
          <div class="comparison-bars">
            <div class="score-bar">
              <div class="score-bar-container">
                ${contestMean <= totalScore ? `
                  <div class="score-bar-fill yours" style="width: ${(totalScore / maxScore) * 100}%"></div>
                  <div class="score-bar-fill average" style="width: ${(contestMean / maxScore) * 100}%"></div>
                ` :
      `
                  <div class="score-bar-fill average" style="width: ${(contestMean / maxScore) * 100}%"></div>
                  <div class="score-bar-fill yours" style="width: ${(totalScore / maxScore) * 100}%"></div>
                `}
                <span class="score-bar-value">${contestMean}/${totalScore}</span>
              </div>
            </div>
          </div>
          <div class="comparison-summary">
            <span class="comparison-delta ${aboveAverage >= 0 ? 'positive' : 'negative'}">
              ${aboveAverage >= 0 ? '+' : ''}${parseFloat(aboveAverage.toFixed(2))} vs average
            </span>
          </div>
        </div>
        ${!hasSubs ? `
        <div class="info-warning" id="completion-warning" style="display: block;">
            <div class="warning-text">No tracked submissions for this virtual contest, so detailed graphs aren’t available.</div>
        </div>
        ` :
      ``}
      </div>
    </div>
  `;

  // make submissions richer by including a problemIndex field
  contest.submissions = contest.submissions.map(i => {
    const problem = contest.contest.problems.find(j => j.id == i.contestProblemId);
    return {
      ...i,
      problemIndex: problem.problemIndex
    };
  });

  document.getElementById('vc-detail-content').innerHTML = content;
  try {
    const hasSubs = contest.submissions.length > 0;
    if (hasSubs) {
      setupScoreTimeline({
        contest,
        contestMetadata,
        problemsData,
        scoreData,
        problemCount,
        maxScore
      });
      setupContestTimeline(
        { contest, contestMetadata, problemsData, problemCount });
    }
  } catch (e) {
    console.error('Timeline init failed:', e);
  }
}

function setupContestTimeline(ctx) {
  const { contest, contestMetadata, problemsData, problemCount } = ctx;
  const canvas = document.getElementById('contest-timeline');
  const tooltip = document.getElementById('timeline-tooltip');
  const heatmap = document.getElementById('contest-heatmap');
  if (!canvas || !tooltip) return;
  // so it won't be clipped by overflow/stacking contexts
  if (tooltip && tooltip.parentElement !== document.body) {
    document.body.appendChild(tooltip);
  }

  const startMs = new Date(contest.startedAt).getTime();
  const plannedMinutes =
    Number(contestMetadata && contestMetadata.duration);
  if (!Number.isFinite(plannedMinutes) || plannedMinutes <= 0) {
    console.error(
      '[vc] contestMetadata.duration missing; contest timeline not rendered');
    return;
  }
  const endPlannedMs = startMs + plannedMinutes * 60000;

  // just minutes / 15
  const binSizeMin =
    plannedMinutes <= 120 ? 8 : (plannedMinutes <= 180 ? 12 : 15);
  const binMs = binSizeMin * 60000;
  const binCount = Math.ceil(plannedMinutes / binSizeMin);
  const bins = new Array(binCount).fill(0);
  const probColors = [
    '#ff7f0e',  // orange
    '#2ca02c',  // greenish teal
    '#9467bd',  // purple
    '#8c564b',  // brown
    '#e377c2'   // pink-magenta
  ];

  // Build events with score deltas
  const subs = (contest.submissions || [])
    .slice()
    .sort(
      (a, b) => new Date(a.time) -
        new Date(b.time));
  const bestByProblem = new Map();
  for (let i = 1; i <= problemCount; i++) bestByProblem.set(i, []);
  const events = [];
  for (const s of subs) {
    const idx = s.problemIndex;
    const prev = bestByProblem.get(idx);
    const arr = Array.isArray(s.subtaskScores) ? s.subtaskScores : [];
    let delta = 0;
    for (let i = 0; i < arr.length; i++) {
      const before = prev[i] || 0;
      const after = Math.max(before, Number(arr[i]) || 0);
      delta += after - before;
      prev[i] = after;
    }
    events.push({
      t: new Date(s.time).getTime(),
      idx,
      delta,
      score: Number(s.score) || 0,
      subtaskScores: arr
    });
    if (s.time) {
      const tBin = new Date(s.time).getTime();
      if (tBin >= startMs && tBin <= endPlannedMs) {
        const bi = Math.min(binCount - 1, Math.floor((tBin - startMs) / binMs));
        bins[bi]++;
      }
    }
  }

  const state = {
    startMs,
    endPlannedMs,
    dpr: window.devicePixelRatio || 1,
    pad: { left: 50, right: 16, top: 14, bottom: 20 },
    heightCss: Number(canvas.getAttribute('height')) || 80,
    events,
    _raf: null
  };

  function setSize() {
    // Refresh DPR in case of zoom/retina change during resize
    const dprNow = window.devicePixelRatio || 1;
    if (state.dpr !== dprNow) state.dpr = dprNow;
    const cssW =
      (canvas.parentElement && canvas.parentElement.clientWidth) || 600;
    canvas.style.width = cssW + 'px';
    canvas.style.height = state.heightCss + 'px';
    canvas.width = Math.max(1, Math.floor(cssW * state.dpr));
    canvas.height = Math.max(1, Math.floor(state.heightCss * state.dpr));
    if (canvas.parentElement) {
      canvas.parentElement.style.height = state.heightCss + 'px';
    }
    if (heatmap) {
      // Let CSS control layout (width:100%; height:18px). Only resize the
      // bitmap.
      const wCss = heatmap.clientWidth ||
        (heatmap.parentElement ? heatmap.parentElement.clientWidth : cssW);
      const hCss = heatmap.clientHeight ||
        18;  // from CSS .timeline-heatmap-wrap canvas{height:18px}
      heatmap.width = Math.max(1, Math.floor(wCss * state.dpr));
      heatmap.height = Math.max(1, Math.floor(hCss * state.dpr));
    }
  }

  function draw() {
    const ctx = canvas.getContext('2d');
    const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
    const { pad } = state;
    const width = cssW - pad.left - pad.right;
    const height = cssH - pad.top - pad.bottom;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    const isDark = document.body.classList.contains('dark-mode');
    const axisColor = isDark ? '#bdbdbd' : '#6c757d';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const labelColor = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.7)';

    const xScale = (t) => pad.left +
      ((t - state.startMs) / (state.endPlannedMs - state.startMs)) * width;

    // baseline
    const yBase = pad.top + Math.floor(height * 0.6);
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, yBase);
    ctx.lineTo(pad.left + width, yBase);
    ctx.stroke();

    // major ticks (reuse cadence)
    const totalMin =
      Math.max(1, Math.round((state.endPlannedMs - state.startMs) / 60000));
    const step = (totalMin <= 120) ? 15 : (totalMin <= 180) ? 30 : 60;
    const totalCeil = Math.ceil(totalMin / step) * step;
    ctx.font = '600 12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
    ctx.fillStyle = labelColor;
    ctx.textAlign = 'center';
    for (let m = 0; m <= totalCeil; m += step) {
      const t = state.startMs + m * 60000;
      const x = xScale(t);
      // Use off-white separator in dark mode, original color otherwise
      ctx.strokeStyle = document.body.classList.contains('dark-mode') ?
        '#d0d0d0' :
        gridColor;  // softer than pure white
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + height);
      ctx.stroke();
      const h = Math.floor(m / 60), mm = m % 60;
      const lbl = h === 0 ? `${mm}m` : (mm === 0 ? `${h}h` : `${h}h${mm}m`);
      ctx.fillText(lbl, x, pad.top + height + 14);
    }

    // submissions as circles
    const dot = (x, y, r, color) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      if (isDark) {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };

    const r = 4.5;
    for (const e of state.events) {
      const x = xScale(e.t);
      const color = probColors[(e.idx - 1) % probColors.length];
      dot(x, yBase, r, color);
      e._x = x;
      e._y = yBase;
      e._size = r;
    }
    drawHeatmap();
  }

  function drawHeatmap() {
    if (!heatmap) return;
    const ctx = heatmap.getContext('2d');
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    // clear
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, heatmap.width, heatmap.height);
    ctx.restore();

    const cssW = heatmap.clientWidth, cssH = heatmap.clientHeight;
    const pad = { left: 50, right: 16 };  // align with timeline
    const width = cssW - pad.left - pad.right;
    const height = cssH;

    const isDark = document.body.classList.contains('dark-mode');

    const maxCount = Math.max(1, ...bins);
    const binPx = width / bins.length;

    // color ramp- neutral grey -> orange -> red
    const colorFor = (v) => {
      if (v <= 0) {
        return isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
      }
      const t = v / maxCount;
      if (t > 0.75)
        return isDark ? 'rgba(255, 82, 82, 0.90)' :
          'rgba(220, 20, 60, 0.85)';  // hot red
      if (t > 0.40)
        return isDark ? 'rgba(255, 145, 64, 0.85)' :
          'rgba(255, 140, 0, 0.72)';  // deep orange
      return isDark ? 'rgba(255, 184, 92, 0.72)' :
        'rgba(255, 179, 71, 0.62)';  // soft orange
    };

    // draw blocks aligned to planned time domain (no borders, no separators)
    for (let i = 0; i < bins.length; i++) {
      // Round positions to avoid hairline gaps due to subpixel widths
      const x1 = Math.round(pad.left + i * binPx);
      const x2 = Math.round(pad.left + (i + 1) * binPx);
      const w = Math.max(1, x2 - x1);
      const col = colorFor(bins[i]);
      ctx.fillStyle =
        col || (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)');
      ctx.fillRect(x1, 0, w, height);
    }
  }

  // rAF-throttled draw
  function scheduleDraw() {
    if (state._raf) return;
    state._raf = requestAnimationFrame(() => {
      state._raf = null;
      draw();
      drawHeatmap();
    });
  }

  function showTip(eObj, clientX, clientY) {
    const whenMin = Math.round((eObj.t - state.startMs) / 60000);
    const h = Math.floor(whenMin / 60), m = whenMin % 60;
    const rel = h === 0 ? `${m}m` : (m === 0 ? `${h}h` : `${h}h${m}m`);
    const pname =
      getProblemNameByIndex(eObj.idx, contest, contestMetadata, problemsData) ||
      `Problem ${eObj.idx}`;
    const deltaNum = Math.round((Number(eObj.delta) || 0) * 10) / 10;
    const deltaStr =
      Number.isInteger(deltaNum) ? String(deltaNum) : deltaNum.toFixed(1);

    const color = probColors[(eObj.idx - 1) % probColors.length];
    tooltip.style.setProperty('--accent', color);

    tooltip.innerHTML = `
      <div class="tip-head"><span class="tip-accent" style="background:${color}"></span><div class="tip-title">${pname}</div></div>
      <div class="tip-grid">
        <span>Time</span><span>${rel}</span>
        <span>Gained</span><span>${deltaStr}</span>
      </div>`;

    tooltip.style.display = 'block';
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;

    const vw = Math.max(
      document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const vh = Math.max(
      document.documentElement.clientHeight || 0, window.innerHeight || 0);

    // Preferred above-cursor
    let x = clientX + 10;
    let y = clientY - (th + 12);
    let posClass = 'top';

    const padding = 10;
    // If not enough space above, put below
    if (y < padding) {
      y = clientX ? clientY + 14 : th + padding;
      posClass = 'bottom';
    }

    // Clamp horizontally
    if (x + tw + padding > vw) x = vw - tw - padding;
    if (x < padding) x = padding;

    // Clamp vertically as last resort
    if (y + th + padding > vh) y = Math.max(padding, vh - th - padding);

    tooltip.style.left = Math.round(x) + 'px';
    tooltip.style.top = Math.round(y) + 'px';
    tooltip.classList.remove('top', 'bottom');
    tooltip.classList.add('visible', posClass);
  }
  function hideTip() {
    tooltip.classList.remove('visible', 'top', 'bottom');
    clearTimeout(tooltip._hideTimer);
    tooltip._hideTimer = setTimeout(() => {
      tooltip.style.display = 'none';
    }, 160);
  }

  function onMove(ev) {
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    let hit = null, best = 9;
    for (const e of state.events) {
      if (!('_x' in e)) continue;
      const dx = Math.abs(x - e._x), dy = Math.abs(y - e._y);
      const d = Math.max(dx, dy);
      if (d < best && d <= 8) {
        best = d;
        hit = e;
      }
    }
    if (hit)
      showTip(hit, ev.clientX, ev.clientY);
    else
      hideTip();
  }
  function onLeave() {
    hideTip();
  }

  const resize = () => {
    setSize();
    scheduleDraw();
  };
  // Prevent duplicate listeners if rerun
  if (canvas._onResizeTimeline)
    window.removeEventListener('resize', canvas._onResizeTimeline);
  canvas._onResizeTimeline = resize;
  window.addEventListener('resize', resize);

  // Theme toggle observer (idempotent)
  if (canvas._themeObserverTimeline) {
    try {
      canvas._themeObserverTimeline.disconnect();
    } catch (_) {
    }
  }
  const mo = new MutationObserver(() => scheduleDraw());
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  canvas._themeObserverTimeline = mo;

  // Layout-driven resize observer (idempotent)
  if (heatmap && !heatmap._ro) {
    const ro = new ResizeObserver(() => {
      setSize();
      scheduleDraw();
    });
    ro.observe(heatmap);
    if (heatmap.parentElement) ro.observe(heatmap.parentElement);
    heatmap._ro = ro;
  }

  setSize();
  scheduleDraw();
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseleave', onLeave);
}


// Resolve a problem's display name by its 1-based index in the contest
function getProblemNameByIndex(index, contest, contestMetadata, problemsData) {
  try {
    if (!contestMetadata || !contestMetadata.problems) return `Problem ${index}`;
    const meta = contestMetadata.problems[index - 1];
    if (!meta) return `Problem ${index}`;
    let id = contest.contest.problems.find(i => i.problemIndex == index - 1).problemId;
    let problemName = problemsData[contest.contest.source.toUpperCase()][contest.contest.year].find(i => i.id == id).name;
    return problemName;
  } catch {
    return `Problem ${index}`;
  }
}

function setupScoreTimeline(ctx) {
  const {
    contest,
    contestMetadata,
    problemsData,
    scoreData,
    problemCount,
    maxScore
  } = ctx;

  const staticCanvas = document.getElementById('score-timeline-static');
  const seriesCanvas = document.getElementById('score-timeline-series');
  const togglesHost = document.getElementById('graph-toggles');
  if (!staticCanvas || !seriesCanvas || !togglesHost) return;

  const state = {
    dpr: window.devicePixelRatio || 1,
    maxScore,
    problemCount,
    medalCutoffs: Array.isArray(scoreData?.medalCutoffs) ?
      scoreData.medalCutoffs.map(Number) :
      null,
    startMs: new Date(contest.startedAt).getTime(),
    endMs: new Date(contest.endedAt).getTime(),
    series: null,
    showTotal: true,
    showProblem: Array.from(
      { length: problemCount + 1 }, (_, i) => i === 0 ? undefined : true),
    pad: { left: 50, right: 16, top: 10, bottom: 28 },
    heightCss: Number(seriesCanvas.getAttribute('height')) || 300,
  };

  // Toggles
  const controls =
    [{ id: 'toggle-total', label: 'Total', type: 'total', checked: true }];
  for (let i = 1; i <= problemCount; i++) {
    const pname = getProblemNameByIndex(i, contest, contestMetadata, problemsData) ||
      `Problem ${i}`;
    controls.push({
      id: `toggle-prob-${i}`,
      label: pname,
      type: 'problem',
      index: i,
      checked: true
    });
  }
  togglesHost.innerHTML = controls
    .map(
      c => `
    <button class="graph-legend" id="${c.id}" data-type="${c.type}" ${c.index ? `data-index="${c.index}"` :
          ''} aria-pressed="${c.checked}">
      <span class="toggle-swatch" data-type="${c.type}" ${c.index ? `data-index="${c.index}"` :
          ''}></span>
      ${c.label}
    </button>`).join('');

  const colorTotal = '#007bff';  // keep total in blue
  const probColors = [
    '#ff7f0e',  // orange
    '#2ca02c',  // greenish teal
    '#9467bd',  // purple
    '#8c564b',  // brown
    '#e377c2'   // pink-magenta
  ];
  togglesHost.querySelectorAll('.toggle-swatch').forEach(sw => {
    const type = sw.getAttribute('data-type');
    const idx = Number(sw.getAttribute('data-index'));
    sw.style.background = (type === 'total') ?
      colorTotal :
      probColors[(idx - 1) % probColors.length];
  });

  const plannedMinutes =
    Number(contestMetadata && contestMetadata.duration);
  if (!Number.isFinite(plannedMinutes) || plannedMinutes <= 0) {
    console.error(
      '[vc] contestMetadata.duration is missing/invalid; timeline will not render.');
    // surface a tiny inline note and bail out
    togglesHost.innerHTML =
      '<span class="graph-legend off" aria-disabled="true">Timeline unavailable (missing duration)</span>';
    return;
  }
  state.displayEndMs = state.startMs + plannedMinutes * 60000;

  // Build series: subtask-based step lines
  state.series =
    buildSeriesData(contest, problemCount, state.startMs, state.endMs);

  const resizeAll = () => {
    setCanvasSize(staticCanvas, state.heightCss);
    setCanvasSize(seriesCanvas, state.heightCss);
    drawStaticLayer(staticCanvas, state);
    drawSeriesLayer(seriesCanvas, state, colorTotal, probColors);
  };

  // Toggle events
  togglesHost.querySelectorAll('.graph-legend').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-type');
      const idx = Number(btn.getAttribute('data-index'));
      if (type === 'total') {
        state.showTotal = !state.showTotal;
        btn.classList.toggle('off', !state.showTotal);
        btn.setAttribute('aria-pressed', String(state.showTotal));
      } else {
        state.showProblem[idx] = !state.showProblem[idx];
        btn.classList.toggle('off', !state.showProblem[idx]);
        btn.setAttribute('aria-pressed', String(state.showProblem[idx]));
      }
      drawSeriesLayer(seriesCanvas, state, colorTotal, probColors);
    });
  });

  // Resize (idempotent)
  const onResize = () => {
    const dprNow = window.devicePixelRatio || 1;
    if (dprNow !== state.dpr) state.dpr = dprNow;
    resizeAll();
  };
  if (seriesCanvas._onResize)
    window.removeEventListener('resize', seriesCanvas._onResize);
  seriesCanvas._onResize = onResize;
  window.addEventListener('resize', onResize);

  // Redraw when theme toggles (body.classList changes) without page refresh
  if (seriesCanvas._themeObserver) {
    try {
      seriesCanvas._themeObserver.disconnect();
    } catch (_) {
    }
  }
  const themeObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'class') {
        // Re-render static (axes/bands) and dynamic series with new colors
        drawStaticLayer(staticCanvas, state);
        drawSeriesLayer(seriesCanvas, state, colorTotal, probColors);
        break;
      }
    }
  });
  themeObserver.observe(
    document.body, { attributes: true, attributeFilter: ['class'] });
  seriesCanvas._themeObserver = themeObserver;

  resizeAll();
}

function setCanvasSize(canvas, heightCss) {
  const dpr = window.devicePixelRatio || 1;
  const cssW =
    (canvas.parentElement && canvas.parentElement.clientWidth) || 600;

  // Ensure the wrapper reserves layout height (important since canvases are
  // absolute)
  const wrap = canvas.parentElement;
  if (wrap) {
    wrap.style.height = `${heightCss}px`;
    wrap.style.overflow = 'hidden';
  }

  // layout style
  canvas.style.width = cssW + 'px';
  canvas.style.height = heightCss + 'px';

  // Bitmap size (sharpness)
  canvas.width = Math.max(1, Math.floor(cssW * dpr));
  canvas.height = Math.max(1, Math.floor(heightCss * dpr));
}

function buildSeriesData(contest, problemCount, startMs, endMs) {
  const subs = (contest.submissions || [])
    .slice()
    .sort((a, b) => new Date(a.time) -new Date(b.time));
  const bestByProblem = new Map();
  const seriesByProblem = new Map();
  for (let i = 1; i <= problemCount; i++) {
    bestByProblem.set(i, []);
    seriesByProblem.set(i, [{ t: startMs, y: 0 }]);
  }
  const total = [{ t: startMs, y: 0 }];
  const totals = Array(problemCount + 1).fill(0);
  const sumTotals = () => totals.reduce((a, b) => a + b, 0);
  for (const s of subs) {
    const idx = s.problemIndex;
    const best = bestByProblem.get(idx);
    const arr = Array.isArray(s.subtaskScores) ? s.subtaskScores : [];
    let changed = false;
    for (let i = 0; i < arr.length; i++) {
      const prev = best[i] || 0;
      const val = Math.max(prev, Number(arr[i]) || 0);
      if (val !== prev) {
        best[i] = val;
        changed = true;
      }
    }
    const tMs = new Date(s.time).getTime();
    if (changed) {
      const pTotal = best.reduce((a, b) => a + (b || 0), 0);
      totals[idx] = pTotal;
      seriesByProblem.get(idx).push({ t: tMs, y: pTotal });
    }
    total.push({ t: tMs, y: sumTotals() });
  }

  for (let i = 1; i <= problemCount; i++) {
    const arr = seriesByProblem.get(i);
    const last = arr[arr.length - 1];
    if (!last || last.t !== endMs) arr.push({ t: endMs, y: last ? last.y : 0 });
  }
  const lastT = total[total.length - 1];
  if (!lastT || lastT.t !== endMs)
    total.push({ t: endMs, y: total[total.length - 1]?.y || 0 });

  return { seriesByProblem, total };
}

function drawStaticLayer(canvas, state) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  const { pad, maxScore, startMs, endMs, displayEndMs, medalCutoffs } = state;
  const width = cssW - pad.left - pad.right;
  const height = cssH - pad.top - pad.bottom;

  // clear
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  const xScale = (t) =>
    pad.left + ((t - startMs) / (displayEndMs - startMs)) * width;
  const yScale = (y) => pad.top + (1 - (y / maxScore)) * height;

  // Theme colors
  const isDark = document.body.classList.contains('dark-mode');
  const axisColor = isDark ? '#aaaaaa' : '#cccccc';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const labelColor = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.6)';

  // Ticks/labels helpers for time axis and label styling
  const totalMin = Math.max(1, Math.round((displayEndMs - startMs) / 60000));
  const tickStepMin = (function (m) {
    if (m <= 120) return 15;  // <=2h → every 15m
    if (m <= 180) return 30;  // <=3h → every 30m
    return 60;                // >3h   → hourly
  })(totalMin);
  const totalMinCeil = Math.ceil(totalMin / tickStepMin) *
    tickStepMin;  // ensure terminal tick (e.g., 5h)

  const formatRel = (mins) => {
    const h = Math.floor(mins / 60), m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h${m}m`;
  };

  const drawAxisLabel = (text, x, y, align = 'left') => {
    ctx.font = '600 12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
    ctx.fillStyle = labelColor;
    ctx.textBaseline = 'alphabetic';
    if (align === 'center')
      ctx.textAlign = 'center';
    else if (align === 'right')
      ctx.textAlign = 'right';
    else
      ctx.textAlign = 'left';
    ctx.fillText(text, x, y);
    // reset for future ops
    ctx.textAlign = 'left';
  };

  // Subtle bands
  if (medalCutoffs && medalCutoffs.length >= 3) {
    const [goldCut, silverCut, bronzeCut] = medalCutoffs;

    const isDark = document.body.classList.contains('dark-mode');
    const rgba = (r, g, b, a) => `rgba(${r},${g},${b},${a})`;

    // medal brand colors (borders): gold, silver, bronze
    const cGold = { r: 255, g: 215, b: 0 };      // #ffd700
    const cSilver = { r: 192, g: 192, b: 192 };  // #c0c0c0
    const cBronze = { r: 205, g: 127, b: 50 };   // #cd7f32

    // Subtle bands
    const alphaFill = isDark ? 0.22 : 0.12;   // softer on dark
    const alphaStroke = isDark ? 0.65 : 0.5;  // lighter separators on dark

    const band =
      (yMin, yMax, col, drawTopBorder = true, drawBottomBorder = true) => {
        const y1 = yScale(Math.min(yMax, maxScore));
        const y2 = yScale(Math.max(0, yMin));
        if (y2 > y1) {
          ctx.save();
          // base fill
          ctx.fillStyle = rgba(col.r, col.g, col.b, alphaFill);
          ctx.fillRect(pad.left, y1, width, y2 - y1);
          // very light dashed separators
          ctx.setLineDash([4, 8]);
          ctx.lineWidth = 1;  // thinner in dark as well
          ctx.strokeStyle = rgba(col.r, col.g, col.b, alphaStroke);
          if (drawTopBorder) {
            ctx.beginPath();
            ctx.moveTo(pad.left, y1);
            ctx.lineTo(pad.left + width, y1);
            ctx.stroke();
          }
          if (drawBottomBorder) {
            ctx.beginPath();
            ctx.moveTo(pad.left, y2);
            ctx.lineTo(pad.left + width, y2);
            ctx.stroke();
          }
          ctx.setLineDash([]);
          ctx.restore();
        }
      };

    // Bronze zone: bronze..silver
    band(bronzeCut, silverCut, cBronze, true, true);
    // Silver zone: silver..gold
    band(silverCut, goldCut, cSilver, true, true);
    // Gold zone: gold..max
    band(goldCut, maxScore, cGold, true, false);
  }


  ctx.strokeStyle = axisColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top + height);
  ctx.lineTo(pad.left + width, pad.top + height);
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, pad.top + height);
  ctx.stroke();

  // y ticks and labels
  const yStep = maxScore <= 300 ? 50 : 100;
  ctx.fillStyle = labelColor;
  ctx.font = '12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
  for (let y = 0; y <= maxScore; y += yStep) {
    const yy = yScale(y);
    ctx.strokeStyle = gridColor;
    ctx.beginPath();
    ctx.moveTo(pad.left, yy);
    ctx.lineTo(pad.left + width, yy);
    ctx.stroke();
    // draw y-label
    drawAxisLabel(String(y), pad.left - 12, yy + 4, 'right');
  }

  // x ticks: standard cadence (15m/30m/60m)
  for (let mins = 0; mins <= totalMinCeil; mins += tickStepMin) {
    const t = startMs + mins * 60000;  // planned domain
    const xx = xScale(t);
    ctx.strokeStyle = gridColor;
    ctx.beginPath();
    ctx.moveTo(xx, pad.top);
    ctx.lineTo(xx, pad.top + height);
    ctx.stroke();
    drawAxisLabel(formatRel(mins), xx, pad.top + height + 16, 'center');
  }
}

function drawSeriesLayer(canvas, state, colorTotal, probColors) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Ensure normal paint mode
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';

  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  const { pad, maxScore, startMs, displayEndMs, series, showTotal, showProblem } =
    state;
  const width = cssW - pad.left - pad.right;
  const height = cssH - pad.top - pad.bottom;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  const xScale = (t) =>
    pad.left + ((t - startMs) / (displayEndMs - startMs)) * width;
  const yScale = (y) => pad.top + (1 - (y / maxScore)) * height;

  const draw = (pts, color) => {
    if (!pts || pts.length === 0) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let xPrev = xScale(pts[0].t), yPrev = yScale(pts[0].y);
    ctx.moveTo(xPrev, yPrev);
    for (let i = 1; i < pts.length; i++) {
      const x = xScale(pts[i].t), y = yScale(pts[i].y);
      ctx.lineTo(x, yPrev);
      ctx.lineTo(x, y);
      xPrev = x;
      yPrev = y;
    }
    ctx.stroke();
  };

  for (let i = 1; i <= state.problemCount; i++)
    if (showProblem[i])
      draw(
        series.seriesByProblem.get(i),
        probColors[(i - 1) % probColors.length]);
  if (showTotal) draw(series.total, colorTotal);
}

function generateProblemsHTML(problemScores, contest, contestMetadata, problemsData, scoreData) {
  if (problemScores.length === 0) {
    return '<div class="vc-detail-problem-empty">No problem data available</div>';
  }

  return problemScores.map((score, index) => {
    // Try to get actual problem name
    let problemName = getProblemNameByIndex(index + 1, contest, contestMetadata, problemsData);

    // Calculate rank for this problem
    let problemRank = 'N/A';
    let problemTotal = 'N/A';
    if (scoreData && scoreData.problemScores &&
      scoreData.problemScores.length > index) {
      const problemScoresList = scoreData.problemScores[index] || [];
      if (problemScoresList.length > 0) {
        const sortedScores = [...problemScoresList].sort((a, b) => b - a);

        // Find rank (handle ties by using the highest possible rank)
        let currentRank = 1;
        for (let i = 0; i < sortedScores.length; i++) {
          if (sortedScores[i] > score) {
            currentRank = i + 1;
          } else {
            break;
          }
        }
        problemRank = currentRank;
        problemTotal = sortedScores.length;
      }
    }

    // Determine score color class
    let scoreClass = '';
    if (score === 100) {
      scoreClass = 'score-perfect';  // Green
    } else if (score > 0) {
      scoreClass = 'score-partial';  // Yellow
    } else {
      scoreClass = 'score-zero';  // Red
    }

    return `
      <div class="vc-detail-problem">
        <div class="vc-detail-problem-header">
          <div class="vc-detail-problem-info">
            <div class="vc-detail-problem-name">${problemName}</div>
            <div class="vc-detail-problem-rank">#${problemRank} of ${problemTotal}</div>
          </div>
          <div class="vc-detail-problem-score ${scoreClass}">${score}/100</div>
        </div>
      </div>
    `;
  })
    .join('');
}

function calculateVariance(scores) {
  if (scores.length === 0) return 0;

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const squaredDiffs = scores.map(score => Math.pow(score - mean, 2));
  return Math.round(
    Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / scores.length));
}

function showError() {
  document.getElementById('vc-detail-loading').style.display = 'none';
  document.getElementById('vc-detail-error').style.display = 'block';
}