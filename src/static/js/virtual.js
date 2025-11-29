// Virtual Contest JavaScript

let problemsData = {};

// converts the data sent by the backend to the format expected by the frontend
function convertData(newData) {
  if (!newData) return null;

  // convert contests
  const contestsDict = {};
  for (const contest of newData.contests || []) {
    const source = contest.source?.toUpperCase?.() || contest.source || "";
    const year = contest.year;
    if (!contestsDict[source]) contestsDict[source] = {};
    if (!contestsDict[source][year]) contestsDict[source][year] = [];

    // build contest object in old shape
    const c = {
      name: contest.name,
      stage: contest.stage || null,
      source,
      year,
      duration_minutes: contest.duration ?? null,
      location: contest.location ?? "",
      website: contest.website ?? "",
      link: contest.link ?? "",
      date: contest.date ?? "",
      notes: contest.note ?? "",
      problems: (contest.problems || []).map((p) => ({
        source: source,
        year: contest.year,
        problemId: p.problemId,
        index: p.problemIndex + 1,
        ...(p.extra ? { extra: p.extra } : {})
      }))
    };

    contestsDict[source][year].push(c);
  }

  // convert active contest
  let activeContest = null;
  if (newData.activeContest) {
    const ac = newData.activeContest;
    activeContest = {
      id: ac.contestId,
      contest_name: ac.contest.name ?? "",
      contest_stage: ac.contest.stage ?? "",
      start_time: ac.startedAt ?? null,
      end_time: ac.endedAt ?? null,
      autosynced: ac.autosynced ?? false,
      duration_minutes: ac.contest.duration ?? null,
      location: ac.contest.location ?? "",
      website: ac.contest.website ?? "",
      link: ac.contest.link ?? ""
    };
  }

  // convert recent contests 
  const recent = (newData.recent || []).map(v => ({
    contest_name: v.contest?.name ?? v.name ?? "",
    contest_stage: v.contest?.stage ?? v.stage ?? "",
    contest_source: v.contest?.source ?? v.source ?? "",
    contest_year: v.contest?.year ?? v.year ?? "",
    started_at: v.started_at ?? v.startedAt ?? null,
    score: v.total_score ?? v.score ?? null,
    per_problem_scores: v.per_problem_scores ?? v.perProblemScores ?? null,
    platform: v.platform ?? (v.contest?.link?.includes("oj.uz") ? "oj.uz" : "manual")
  }));

  // completed contests
  const completed_contests = newData.completedContests || [];

  // final shape
  const result = {
    contests: contestsDict,
    recent,
    completed_contests
  };

  if (activeContest) {
    activeContest.problems = newData.contests.find(i => i.id == activeContest.id).problems;
    result.active_contest = activeContest;
  }

  return result;
}

document.addEventListener('DOMContentLoaded', async () => {
  // --- Platform sync preview state holders ---
  let lastRenderedContest = null;
  let lastRenderedOlympiad = null;
  let lastProblemCount = 0;
  // Set virtual contest mode flag
  window.isVirtualContestMode = true;

  const olympiadSelect = document.getElementById('olympiad-select');
  const contestSelect = document.getElementById('contest-select');
  const daySelect = document.getElementById('day-select');
  const contestDetails = document.getElementById('contest-details');
  const ojuzSection = document.getElementById('ojuz-section');
  const startBtn = document.getElementById('start-contest-btn');
  const vcForm = document.querySelector('.vc-form');
  const activeContest = document.getElementById('active-contest');
  const scoreEntry = document.getElementById('score-entry');
  const pastVcList = document.querySelector('.past-vc-list');
  const sessionToken = localStorage.getItem('sessionToken');

  // Normalize truthy/falsey flags from backend (0/1, "0"/"1", "true"/"false", etc.)
  function asBool(v) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      return s === '1' || s === 'true' || s === 'yes' || s === 'on';
    }
    return false;
  }

  // Show loading skeleton initially
  document.getElementById('past-vc-loading').style.display = 'block';
  pastVcList.style.display = 'none';
  document.querySelector('.view-all-link').style.display = 'none';

  // Check if we expect an active contest from localStorage
  const contestOngoing = localStorage.getItem('contest_ongoing') === 'true';

  // Show appropriate skeleton based on expected state
  if (contestOngoing) {
    // Show active contest skeleton
    document.getElementById('vc-main-loading').style.display = 'block';
    document.getElementById('vc-main-loading').className = 'vc-main-loading active-contest-skeleton';
  } else {
    // Show form skeleton
    document.getElementById('vc-main-loading').style.display = 'block';
    document.getElementById('vc-main-loading').className = 'vc-main-loading form-skeleton';
  }

  vcForm.style.display = 'none';
  activeContest.style.display = 'none';
  scoreEntry.style.display = 'none';

  // If we're not logged in, redirect to the home page
  check_session();
  const username = localStorage.getItem('username');
  // Also show the welcome message
  document.getElementById('welcome-message').innerHTML = `Welcome, ${username}`;
  const currentUserName = username;

  // Fetch contest data from API
  const response = await fetch(`${apiUrl}/data/virtual/summary`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token: sessionToken })
  });

  if (!response.ok) {
    console.error('Failed to fetch virtual contests data');
    // Hide skeleton on error
    document.getElementById('past-vc-loading').style.display = 'none';
    return;
  }

  const data = convertData(await response.json());
  let contestData = data.contests;

  // Always fetch problems data (we need it for contest problem names)
  const problemsResponse = await fetch(`${apiUrl}/data/problems`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sources: Object.keys(contestData).map(i => i.toLowerCase()),
      token: sessionToken,
      allLinks: true
    })
  });

  if (problemsResponse.ok) {
    problemsData = await problemsResponse.json();
  }

  // flatten 
  let flatData = [];
  for (let [source, years] of Object.entries(problemsData)) {
    for (let [year, data] of Object.entries(years)) {
      flatData.push(data);
    }
  }
  flatData = flatData.flat();

  // for each contest problem, give it its id
  for (let [source, years] of Object.entries(data.contests)) {
    for (let [year, data] of Object.entries(years)) {
      for (let contest of data) {
        for (let problem of contest.problems) {
          problem.number = flatData.find(i => i.id == problem.problemId).number;
        }
      }
    }
  }

  contestData = data.contests;

  const completedContestKeys = new Set((data.completed_contests || []).map(String));
  let currentActiveContest = null; // Store active contest data

  // Define functions first so they're available when needed
  function showMessage(text, type = 'error') {
    const messageContainer = document.getElementById('message-container');
    const messageContent = document.getElementById('message-content');
    const messageText = document.getElementById('message-text');

    messageText.textContent = text;
    messageContent.className = `message-content ${type}`;
    messageContainer.style.display = 'flex';

    // Trigger animation after a brief delay to ensure display is set
    setTimeout(() => {
      messageContainer.classList.add('show');
    }, 10);
  }

  function showLinks(links) {
    const messageContainer = document.getElementById('message-container');
    const messageContent = document.getElementById('message-content');
    const messageText = document.getElementById('message-text');

    messageText.innerHTML = `<div style="font-weight:600;margin-bottom:0.5em">
    Open the contest problems below:
  </div>`;

    const table = document.createElement('table');
    table.className = 'problems-table links-table'; // same class as your main checklist table
    const row = document.createElement('tr');

    links.forEach(problem => {
      const cell = document.createElement('td');
      cell.className = 'problem-cell';
      const content = document.createElement('div');
      content.className = 'problem-cell-content';

      const link = document.createElement('a');
      link.href = problem.link;
      link.target = '_blank';
      link.textContent = problem.name;

      content.appendChild(link);
      cell.appendChild(content);
      row.appendChild(cell);
    });

    table.appendChild(row);
    messageText.appendChild(table);

    messageContent.className = 'message-content info';
    messageContainer.style.display = 'flex';
    setTimeout(() => messageContainer.classList.add('show'), 10);
  }

  function hideMessage() {
    const messageContainer = document.getElementById('message-container');
    messageContainer.classList.remove('show');

    // Hide the element after animation completes
    setTimeout(() => {
      messageContainer.style.display = 'none';
    }, 300);
  }

  // Handle message close button
  document.getElementById('message-close').addEventListener('click', hideMessage);

  // Close message when clicking outside
  document.getElementById('message-container').addEventListener('click', (e) => {
    if (e.target.id === 'message-container') {
      hideMessage();
    }
  });

  // ---- Prefer platform link helper (uses localStorage platformPref) ----
  function getPlatformPrefList() {
    try {
      const s = localStorage.getItem('platformPref');
      if (!s) return null;
      const arr = JSON.parse(s);
      return Array.isArray(arr) ? arr : null;
    } catch {
      return null;
    }
  }

  function chooseUrlFromLinksDict(linksDict) {
    if (!linksDict || typeof linksDict !== 'object') return null;
    const pref = getPlatformPrefList();
    if (pref && pref.length) {
      for (const plat of pref) {
        if (linksDict[plat]) return linksDict[plat];
      }
    }
    const first = Object.values(linksDict)[0];
    return first || null;
  }

  function chooseProblemUrl(problem) {
    if (!problem) return null;
    if (problem.links) return chooseUrlFromLinksDict(problem.links);
    return problem.link || null; // backward-compat
  }

  function showScoreEntry(isReadOnly = false) {
    if (!currentActiveContest) {
      showMessage('No active contest data available.');
      return;
    }

    // Get contest info from the active contest data
    const contestTitle = currentActiveContest.contest_stage ?
      `${currentActiveContest.contest_name} ${currentActiveContest.contest_stage}` :
      currentActiveContest.contest_name;

    document.getElementById('score-contest-title').textContent = contestTitle;

    // Calculate time used based on stored start and end times, capped at contest duration
    const startTime = new Date(currentActiveContest.start_time);
    let endTime;

    if (currentActiveContest.end_time) {
      // Use the stored end time from the API
      endTime = new Date(currentActiveContest.end_time);
    } else {
      // Fallback to current time if no end_time (shouldn't happen in score entry)
      endTime = new Date();
    }

    // Cap the end time at contest duration
    const contestDurationMs = currentActiveContest.duration_minutes * 60 * 1000;
    const maxEndTime = new Date(startTime.getTime() + contestDurationMs);
    const cappedEndTime = new Date(Math.min(endTime.getTime(), maxEndTime.getTime()));

    const elapsedMilliseconds = cappedEndTime - startTime;
    const elapsedMinutes = Math.floor(elapsedMilliseconds / (1000 * 60));
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    const remainingMinutes = elapsedMinutes % 60;

    const timeUsed = elapsedHours > 0 ? `${elapsedHours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
    document.getElementById('completion-time').textContent = timeUsed;

    // Update header and description based on mode
    const scoreSection = document.querySelector('.score-section');
    const scoreSectionH3 = scoreSection.querySelector('h3');
    const scoreSubtitle = document.querySelector('.score-subtitle');

    if (isReadOnly) {
      scoreSectionH3.textContent = 'View Your Scores';
      scoreSubtitle.textContent = 'Click on each problem to view detailed scoring information.';
    } else {
      scoreSectionH3.textContent = 'Enter Your Scores';
      scoreSubtitle.textContent = 'Click on each problem to set your score.';
    }

    // Get the contest data to find problems
    const contestName = currentActiveContest.contest_name;
    const contestStage = currentActiveContest.contest_stage;

    // Find the contest in contestData to get problems
    let contestProblems = [];
    let problemCount = 3; // fallback

    // Search through all olympiads and years to find this contest
    for (const [olympiad, years] of Object.entries(contestData)) {
      for (const [year, contests] of Object.entries(years)) {
        const contest = contests.find(c => c.name === contestName &&
          (contestStage ? c.stage === contestStage : c.stage == null));
        if (contest && contest.problems) {
          contestProblems = contest.problems;
          problemCount = contest.problems.length;
          break;
        }
      }
      if (contestProblems.length > 0) break;
    }

    function calculateScore(data, n) {
      let arr = [];
      for (let i = 0; i < n; ++i) {
        arr.push([]);
      }
      if (!data) {
        return arr;
      }
      const uniqueIds = [...new Set(data.map(d => d.contestProblemId))].sort((a, b) => a - b);
      const idMap = Object.fromEntries(uniqueIds.map((id, idx) => [id, idx]));
      data = data.map(entry => ({
        ...entry,
        problemIndex: idMap[entry.contestProblemId]
      }));
      for (let submission of data) {
        let cur = arr[submission.problemIndex] ?? [];
        for (let i = 0; i < submission.subtaskScores.length; ++i) {
          cur[i] = Math.max(cur[i] ?? 0, submission.subtaskScores[i]);
        }
        arr[submission.problemIndex] = cur;
      }
      return arr;
    }

    function calculateTotalScore(data) {
      return data.reduce((sum, a) => sum + a.reduce((a, b) => a + b, 0), 0);
    }

    // Calculate total score for oj.uz mode and update completion stats
    if (isReadOnly && currentActiveContest.autosynced) {
      const scoreData = calculateScore(currentActiveContest.ojuz_data, currentActiveContest.problems.length);
      const totalScore = calculateTotalScore(scoreData);

      // Add total score stat item
      const completionStats = document.querySelector('.completion-stats');

      // Check if total score stat already exists
      let totalScoreStat = document.getElementById('total-score-stat');
      if (!totalScoreStat) {
        totalScoreStat = document.createElement('div');
        totalScoreStat.id = 'total-score-stat';
        totalScoreStat.className = 'stat-item';
        totalScoreStat.innerHTML = `
          <span class="stat-label">Total Score:</span>
          <span class="stat-value" id="total-score-value">${totalScore}/${problemCount * 100}</span>
        `;
        completionStats.appendChild(totalScoreStat);
      } else {
        // Update existing stat
        document.getElementById('total-score-value').textContent = `${totalScore}/${problemCount * 100}`;
      }
    }

    // Generate score table with actual problem names using main page cell system
    const scoreTbody = document.getElementById('score-problems-tbody');
    scoreTbody.innerHTML = '';

    // Get actual problem names and links
    const problemData = [];
    if (contestProblems.length > 0 && problemsData) {
      contestProblems.forEach((prob, index) => {
        // Find the problem in problemsData
        const olympiadProblems = problemsData[prob.source];
        if (olympiadProblems && olympiadProblems[prob.year]) {
          const problem = olympiadProblems[prob.year].find(p =>
            p.year === prob.year &&
            p.number === prob.number
          );
          if (problem) {
            problemData.push({
              id: problem.id,
              name: problem.name,
              link: chooseProblemUrl(problem) || '#',
              source: prob.source,
              year: prob.year,
              score: 0,
              status: 0,
              index: prob.index
            });
          } else {
            problemData.push({
              id: problem.id,
              name: `Problem ${index + 1}`,
              link: '#',
              source: prob.source,
              year: prob.year,
              score: 0,
              status: 0,
              index: prob.index
            });
          }
        } else {
          problemData.push({
            id: problem.id,
            name: `Problem ${index + 1}`,
            link: '#',
            source: prob.source,
            year: prob.year,
            score: 0,
            status: 0,
            index: prob.index
          });
        }
      });
    } else {
      // Fallback to generic names
      for (let i = 1; i <= problemCount; i++) {
        problemData.push({
          id: -1,
          name: `Problem ${i}`,
          link: '#',
          source: 'Unknown',
          year: new Date().getFullYear(),
          score: 0,
          status: 0,
          index: i
        });
      }
    }

    // populate currentActiveContest.ojuz_data[i].problemIndex
    if (currentActiveContest.ojuz_data) {
      currentActiveContest.ojuz_data = currentActiveContest.ojuz_data.map(i => {
        const problem = currentActiveContest.problems.find(j => j.id == i.contestProblemId);
        i.problemIndex = problem.problemIndex;
        return i;
      });
    }

    // If we have oj.uz data, populate scores
    if (isReadOnly && currentActiveContest.autosynced) {
      const scoreData = calculateScore(currentActiveContest.ojuz_data, currentActiveContest.problems.length);
      for (let problemIndex = 0; problemIndex < scoreData.length; ++problemIndex) {
        problemData[problemIndex].score = scoreData[problemIndex].reduce((a, b) => a + b, 0);
        problemData[problemIndex].subtaskScores = scoreData[problemIndex];
        if (problemData[problemIndex].score == 100) {
          problemData[problemIndex].status = 2; // solved
        } else if (problemData[problemIndex].score > 0) {
          problemData[problemIndex].status = 1; // partial
        } else {
          problemData[problemIndex].status = 0; // failed
        }
      }
    }

    // Create table row with problem cells (same as main page)
    const row = document.createElement('tr');

    problemData.forEach((problem, index) => {
      const cell = document.createElement('td');
      cell.className = `problem-cell ${getStatusColor(problem.status)}`;
      cell.dataset.id = problem.id.toString();
      cell.dataset.status = problem.status.toString();
      cell.dataset.problemId = problem.name;
      cell.dataset.source = problem.source;
      cell.dataset.year = problem.year;
      cell.dataset.score = problem.score.toString();
      cell.dataset.readOnly = isReadOnly.toString();

      // Store additional data for read-only mode
      if (isReadOnly) {
        cell.dataset.subtaskScores = JSON.stringify(problem.subtaskScores || []);
        cell.dataset.submissionTime = problem.time || '';
      }

      const cellContent = document.createElement('div');
      cellContent.className = 'problem-cell-content';

      const link = document.createElement('a');
      link.href = problem.link || '#';
      link.target = '_blank';
      link.textContent = problem.name;
      cellContent.appendChild(link);

      cell.appendChild(cellContent);

      // Add click handler using the appropriate system
      if (isReadOnly) {
        cell.addEventListener('click', (e) => handleReadOnlyCellClick(cell, problem, e));
      } else {
        cell.addEventListener('click', (e) => handleCellClick(cell, problem.name, problem.source, problem.year, e));
      }

      row.appendChild(cell);
    });

    scoreTbody.appendChild(row);

    // Hide active contest UI elements
    activeContest.style.display = 'none';
    scoreEntry.style.display = 'block';
  }

  function showForm() {
    // Clear contest ongoing flag
    localStorage.setItem('contest_ongoing', 'false');

    // Hide skeleton and show form
    document.getElementById('vc-main-loading').style.display = 'none';

    // Reset form
    olympiadSelect.value = '';
    contestSelect.innerHTML = '<option value="">Select Contest</option>';
    daySelect.innerHTML = '<option value="">Select Day</option>';
    contestSelect.disabled = true;
    daySelect.disabled = true;
    contestDetails.style.display = 'none';
    ojuzSection.style.display = 'none';
    startBtn.disabled = true;

    // Show form, hide others
    vcForm.style.display = 'block';
    activeContest.style.display = 'none';
    scoreEntry.style.display = 'none';
  }

  // Fetch problems data for all contest sources to avoid lag
  const contestSources = Object.keys(contestData);

  // Check if user has an active contest
  if (data.active_contest) {
    // User has an ongoing contest
    currentActiveContest = data.active_contest;
    // Coerce autosynced to a proper boolean (backend may return 0/1)
    currentActiveContest.autosynced = asBool(currentActiveContest.autosynced);

    // Set localStorage flag for future loads
    localStorage.setItem('contest_ongoing', 'true');

    // Hide main skeleton
    document.getElementById('vc-main-loading').style.display = 'none';

    // Check if contest is ended (has end_time)
    if (currentActiveContest.end_time) {
      // Contest is finished, show score entry screen
      localStorage.setItem('contest_ongoing', 'false');
      vcForm.style.display = 'none';
      document.getElementById('active-contest').style.display = 'none';

      // Check if we have oj.uz data OR if this was previously synced
      const wasSynced = localStorage.getItem('is_synced') === 'true';
      const hasOjuzData = currentActiveContest.ojuz_data && currentActiveContest.ojuz_data.length > 0;

      // If we were synced but don't have ojuz_data, restore from localStorage
      if (wasSynced && !hasOjuzData) {
        const storedOjuzData = localStorage.getItem('ojuz_data');
        if (storedOjuzData) {
          try {
            currentActiveContest.ojuz_data = JSON.parse(storedOjuzData);
          } catch (e) {
            console.error('Failed to parse stored oj.uz data:', e);
          }
        }
      }
      showScoreEntry(currentActiveContest.autosynced);
    } else {
      // Contest is still running, show timer
      vcForm.style.display = 'none';
      document.getElementById('active-contest').style.display = 'block';

      // Set contest title and metadata
      const titleText = currentActiveContest.contest_stage ?
        `${currentActiveContest.contest_name} <svg width="12" height="3" viewBox="0 0 12 3" style="vertical-align: middle; margin: 0 4px;"><rect width="12" height="2" fill="currentColor"/></svg> ${currentActiveContest.contest_stage}` :
        currentActiveContest.contest_name;
      document.getElementById('active-contest-title').innerHTML = titleText;

      // Set location and website in one line
      const locationElement = document.getElementById('active-contest-location');
      const websiteElement = document.getElementById('active-contest-website');

      if (currentActiveContest.location || currentActiveContest.website) {
        let metadataHTML = '';
        if (currentActiveContest.location) {
          metadataHTML += currentActiveContest.location;
        }
        if (currentActiveContest.website) {
          if (metadataHTML) metadataHTML += ' | ';
          metadataHTML += `<a href="${currentActiveContest.website}" target="_blank">${currentActiveContest.website}</a>`;
        }
        locationElement.innerHTML = metadataHTML;
        locationElement.style.display = 'block';
        websiteElement.style.display = 'none';
      } else {
        locationElement.style.display = 'none';
        websiteElement.style.display = 'none';
      }

      // Calculate remaining time, capped at contest duration
      const startTime = new Date(currentActiveContest.start_time);
      const now = new Date();
      const elapsedMilliseconds = now - startTime;
      const elapsedSeconds = Math.floor(elapsedMilliseconds / 1000);
      const elapsedMinutes = Math.floor(elapsedSeconds / 60);

      // Cap elapsed time at contest duration
      const maxElapsedSeconds = currentActiveContest.duration_minutes * 60;
      const cappedElapsedSeconds = Math.min(elapsedSeconds, maxElapsedSeconds);

      const remainingSeconds = Math.max(0, maxElapsedSeconds - cappedElapsedSeconds);
      const remainingMinutes = Math.floor(remainingSeconds / 60);

      // Start timer with remaining time and capped elapsed time (in seconds precision)
      startTimerWithSeconds(remainingSeconds, cappedElapsedSeconds);
    }

    // Don't return here - we still need to set up event listeners
  }

  // Populate olympiad select (only if not in active contest)
  if (!currentActiveContest) {
    // No active contest, clear localStorage flag
    localStorage.setItem('contest_ongoing', 'false');

    // Hide main skeleton and show form
    document.getElementById('vc-main-loading').style.display = 'none';
    vcForm.style.display = 'block';

    olympiadSelect.innerHTML = '<option value="">Select Olympiad</option>';
    Object.keys(contestData).forEach(source => {
      const option = document.createElement('option');
      option.value = source;
      option.textContent = getFullOlympiadName(source);
      olympiadSelect.appendChild(option);
    });
  }

  // Update recent virtual contests
  // Hide skeleton and show actual content
  document.getElementById('past-vc-loading').style.display = 'none';
  pastVcList.style.display = 'block';
  document.querySelector('.view-all-link').style.display = 'block';

  pastVcList.innerHTML = '';
  const viewAllLink = document.querySelector('.view-all-link');

  if (data.recent.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'past-vc-empty';
    emptyMessage.innerHTML = `
      <div class="empty-text">No virtual contests yet.</div>
      <div class="empty-subtext">Start your first one here.</div>
    `;
    pastVcList.appendChild(emptyMessage);
    viewAllLink.style.display = 'none';
  } else {
    data.recent.forEach(contest => {
      const item = document.createElement('div');
      item.className = 'past-vc-item';
      const date = new Date(contest.started_at);
      const numProblems = contest.per_problem_scores.length;
      const formattedDate = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      item.innerHTML = `
              <div class="past-vc-title">${contest.contest_source.toUpperCase()} ${contest.contest_year}${contest.contest_stage ? ` ${contest.contest_stage}` : ''}</div>
              <div class="past-vc-score">${contest.score}/${numProblems * 100}</div>
              <div class="past-vc-date">${formattedDate}</div>
          `;
      item.addEventListener('click', (e) => {
        if (e.target.tagName === 'A' || e.target.closest('a')) {
          return;
        }
        const slug = (contest.contest_name + (contest.contest_stage || '')).toLowerCase().replace(/\s+/g, '');
        window.location.href = `virtual-contest-detail?contest=${slug}`;
      });
      pastVcList.appendChild(item);
    });
    viewAllLink.style.display = 'block';
  }

  // --- Platform sync preview helpers ---
  function buildPlatformIndexMap(contest, selectedOlympiad) {
    // Returns: { platform: Set(problemIndexNumber) }
    const map = {};
    if (!contest || !contest.problems || !problemsData[selectedOlympiad]) return map;
    contest.problems.forEach((prob) => {
      const yearProblems = problemsData[selectedOlympiad][prob.year] || [];
      const problem = yearProblems.find(p => p.year === prob.year && p.number === prob.number);
      if (problem) {
        if (problem && problem.links && typeof problem.links === 'object') {
          Object.keys(problem.links).forEach(plat => {
            if (!map[plat]) map[plat] = new Set();
            const idx = (typeof prob.index === 'number' && prob.index > 0) ? prob.index : (map[plat].size + 1);
            map[plat].add(idx);
          });
        } else if (problem) {
          // fallback to single link
          const url = problem.link || chooseProblemUrl(problem);
          if (url) {
            const platform = getPlatformFromLink(url);
            if (!map[platform]) map[platform] = new Set();
            const idx = (typeof prob.index === 'number' && prob.index > 0) ? prob.index : (map[platform].size + 1);
            map[platform].add(idx);
          }
        }
      }
    });
    return map;
  }

  async function fetchActiveUsernamesForSync(token) {
    try {
      const settingsRes = await fetch(`${apiUrl}/user/settings`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });
      if (!settingsRes.ok) return {};
      const settings = await settingsRes.json();
      return (settings && typeof settings.platformUsernames === 'object') ? settings.platformUsernames : {};
    } catch (e) {
      console.error('Failed to fetch active platform usernames', e);
      return {};
    }
  }

  // Pre-check coverage (used on contest/day selection and when toggling auto-track)
  async function precheckCoverageAfterSelection(contest, selectedOlympiad) {
    const completionWarning = document.getElementById('completion-warning');
    const autoTrackEl = document.getElementById('ojuz-autotrack');
    if (!autoTrackEl || !autoTrackEl.checked) return;

    // Recompute completion state robustly for the given contest
    const contestKey = contest ? `${contest.name}|${contest.stage || ''}` : null;
    const isCompleted = contestKey ? (completedContestKeys.has(contestKey) || (completionWarning?.dataset?.reason === 'completed')) : false;
    if (isCompleted) return;

    const _active = await fetchActiveUsernamesForSync(sessionToken);
    const activeUsernames = (_active && typeof _active === 'object') ? _active : {};
    // If no auto-synced usernames are set, do not show inline warning; popup will be shown on Start
    const hasAnyUsername = Array.isArray(auto_synced_platforms) && auto_synced_platforms.some(p => activeUsernames && activeUsernames[p]);

    let missingCoverage = false;
    if (contest?.problems && problemsData[selectedOlympiad]) {
      for (const prob of contest.problems) {
        const yearProblems = problemsData[selectedOlympiad][prob.year] || [];
        const problem = yearProblems.find(p => p.year === prob.year && p.number === prob.number);
        if (problem) {
          let availablePlats = [];
          if (problem.links && typeof problem.links === 'object') {
            availablePlats = Object.keys(problem.links);
          } else if (problem.link) {
            availablePlats = [getPlatformFromLink(problem.link)];
          }
          const ok = availablePlats.some(plat => auto_synced_platforms.includes(plat) && activeUsernames[plat]);
          if (!ok) { missingCoverage = true; break; }
        }
      }
    }

    // Guard if user unchecked during async
    if (!autoTrackEl.checked) return;

    if (!isCompleted && hasAnyUsername && missingCoverage) {
      completionWarning.textContent = 'At least one problem has no coverage for your connected usernames.';
      completionWarning.dataset.reason = 'coverage';
      completionWarning.style.display = 'block';
      startBtn.disabled = true;
    } else if (completionWarning.dataset.reason === 'coverage') {
      // Only clear our own coverage warning; keep completed warning if present
      completionWarning.dataset.reason = '';
      completionWarning.style.display = 'none';
      startBtn.disabled = false;
    }
  }

  function renderPlatformSyncCard(problemCount, platformIndexMap, activeUsernames) {
    const card = document.getElementById('platform-sync-card');
    const rows = document.getElementById('platform-sync-rows');
    if (!card || !rows) return;

    // Platforms to show: those for which a username exists AND at least one problem is mapped
    const platforms = Object.keys(activeUsernames || {}).filter(p => platformIndexMap[p] && platformIndexMap[p].size > 0);

    rows.innerHTML = '';

    if (platforms.length === 0) {
      // Nothing to show
      card.style.display = 'none';
      return;
    }

    platforms.forEach((platform) => {
      const uname = activeUsernames[platform];
      const set = platformIndexMap[platform] || new Set();

      const row = document.createElement('div');
      row.className = 'platform-row';

      const left = document.createElement('div');
      left.className = 'platform-left';

      const badge = document.createElement('div');
      badge.className = 'platform-badge';
      badge.textContent = platform;

      const usernameSpan = document.createElement('div');
      usernameSpan.className = 'platform-username';
      usernameSpan.textContent = `@${uname}`;

      left.appendChild(badge);
      left.appendChild(usernameSpan);

      const segs = document.createElement('div');
      segs.className = 'segments';
      for (let i = 1; i <= problemCount; i++) {
        const seg = document.createElement('div');
        seg.className = 'segment' + (set.has(i) ? ' active' : '');
        segs.appendChild(seg);
      }

      row.appendChild(left);
      row.appendChild(segs);
      rows.appendChild(row);
    });

    card.style.display = 'block';
  }

  // --- Platform sync preview: update logic ---
  async function updatePlatformSyncPreview() {
    const card = document.getElementById('platform-sync-card');
    const autoTrackEl = document.getElementById('ojuz-autotrack');
    if (!card || !autoTrackEl) return;

    if (!autoTrackEl.checked || !lastRenderedContest || !lastRenderedOlympiad) {
      card.style.display = 'none';
      return;
    }

    const platformIndexMap = buildPlatformIndexMap(lastRenderedContest, lastRenderedOlympiad);
    const activeUsernames = await fetchActiveUsernamesForSync(sessionToken);
    renderPlatformSyncCard(lastProblemCount, platformIndexMap, activeUsernames);
  }

  // Add change listener for ojuz-autotrack checkbox (after DOM elements exist)
  const autoTrackToggle = document.getElementById('ojuz-autotrack');
  autoTrackToggle?.addEventListener('change', () => {
    updatePlatformSyncPreview();

    const completionWarning = document.getElementById('completion-warning');
    let isCompleted = false;
    if (lastRenderedContest) {
      const key = `${lastRenderedContest.name}|${lastRenderedContest.stage || ''}`;
      isCompleted = completedContestKeys.has(key) || (completionWarning?.dataset?.reason === 'completed');
    }

    if (autoTrackToggle.checked) {
      // Run coverage pre-check immediately if a contest is currently rendered and not completed
      if (lastRenderedContest && lastRenderedOlympiad && !isCompleted) {
        precheckCoverageAfterSelection(lastRenderedContest, lastRenderedOlympiad);
      }
    } else {
      // If user turned OFF auto-track, hide any coverage-only warning and re-enable Start
      if (completionWarning && completionWarning.dataset && completionWarning.dataset.reason === 'coverage') {
        completionWarning.style.display = 'none';
        completionWarning.dataset.reason = '';
        startBtn.disabled = false;
      }
    }
  });

  // Handle olympiad selection
  olympiadSelect.addEventListener('change', (e) => {
    const selectedOlympiad = e.target.value;
    const contestRow = document.getElementById('contest-row');
    const dayRow = document.getElementById('day-row');

    contestSelect.innerHTML = '<option value="">Select Contest</option>';
    daySelect.innerHTML = '<option value="">Select Day</option>';
    contestSelect.disabled = !selectedOlympiad;
    daySelect.disabled = true;
    contestDetails.style.display = 'none';
    ojuzSection.style.display = 'none';
    startBtn.disabled = true;
    document.getElementById('platform-sync-card').style.display = 'none';

    // Hide completion warning when olympiad changes
    const completionWarning = document.getElementById('completion-warning');
    completionWarning.style.display = 'none';

    // Show/hide entire form rows
    contestRow.style.display = selectedOlympiad ? 'block' : 'none';
    dayRow.style.display = 'none';

    if (selectedOlympiad && contestData[selectedOlympiad]) {
      Object.keys(contestData[selectedOlympiad]).forEach(year => {
        const contests = contestData[selectedOlympiad][year];
        // Group contests by name and show location
        const contestMap = {};
        contests.forEach(contest => {
          if (!contestMap[contest.name]) {
            contestMap[contest.name] = contest;
          }
        });

        Object.values(contestMap).forEach(contest => {
          const option = document.createElement('option');
          option.value = `${contest.name}|${year}`;
          option.textContent = contest.name;
          contestSelect.appendChild(option);
        });
      });
      contestSelect.disabled = false;
    }
  });

  // Handle contest selection
  contestSelect.addEventListener('change', (e) => {
    const selectedContest = e.target.value;
    const selectedOlympiad = olympiadSelect.value;
    const dayRow = document.getElementById('day-row');
    const dayLabel = dayRow.querySelector('label');

    daySelect.innerHTML = '<option value="">Select Stage</option>';
    daySelect.disabled = true;
    contestDetails.style.display = 'none';
    ojuzSection.style.display = 'none';
    startBtn.disabled = true;
    document.getElementById('platform-sync-card').style.display = 'none';

    // Hide completion warning when contest changes
    const completionWarning = document.getElementById('completion-warning');
    completionWarning.style.display = 'none';

    // Hide day row initially
    dayRow.style.display = 'none';

    if (selectedContest && contestData[selectedOlympiad]) {
      const [contestName, year] = selectedContest.split('|');
      const contests = contestData[selectedOlympiad][year] || [];
      const matchingContests = contests.filter(c => c.name === contestName);

      // Get unique stages and filter out null/undefined stages
      const stages = [...new Set(matchingContests.map(c => c.stage).filter(stage => stage != null))].sort();

      // Check if there's only one contest and it has no stage
      if (matchingContests.length === 1 && (matchingContests[0].stage == null || matchingContests[0].stage === '')) {
        // Skip stage selection entirely - directly show contest details
        const contest = matchingContests[0];

        // Check if this contest has been completed
        const contestKey = `${contestName}|${contest.stage || ''}`;
        const isCompleted = data.completed_contests && data.completed_contests.includes(contestKey);

        // Calculate problem count from contest.problems array
        const problemCount = contest.problems ? contest.problems.length : 3;

        // Get platforms from the problems data we already fetched
        let platforms = ['Unknown'];
        if (contest.problems && problemsData[selectedOlympiad]) {
          const platformSet = new Set();
          contest.problems.forEach(prob => {
            const yearProblems = problemsData[selectedOlympiad][prob.year] || [];
            const problem = yearProblems.find(p => p.year === prob.year && p.number === prob.number);
            if (problem) {
              if (problem.links && typeof problem.links === 'object') {
                Object.keys(problem.links).forEach(plat => platformSet.add(plat));
              } else {
                const url = problem.link || chooseProblemUrl(problem);
                if (url) platformSet.add(getPlatformFromLink(url));
              }
            }
          });
          platforms = Array.from(platformSet).filter(p => p && p !== 'Unknown');
          if (platforms.length === 0) platforms = ['Unknown'];
        }

        // Show contest details with accurate info
        document.getElementById('contest-duration').textContent = formatDuration(contest.duration_minutes);
        document.getElementById('contest-problems').textContent = problemCount;
        document.getElementById('contest-platform').textContent = platforms.join('/');

        contestDetails.style.display = 'block';

        // Set state for platform sync preview and update
        lastRenderedContest = contest;
        lastRenderedOlympiad = selectedOlympiad;
        lastProblemCount = problemCount;
        updatePlatformSyncPreview();

        // Show/hide completion warning
        const completionWarning = document.getElementById('completion-warning');
        if (isCompleted) {
          completionWarning.dataset.reason = 'completed';
          completionWarning.style.display = 'block';
          startBtn.disabled = true;
        } else {
          completionWarning.dataset.reason = '';
          completionWarning.style.display = 'none';
          startBtn.disabled = false;
        }

        // If auto-track is enabled and not completed, pre-check coverage and disable start if missing
        precheckCoverageAfterSelection(contest, selectedOlympiad);

        // Show/hide ojuzSection if at least one platform is in auto_synced_platforms
        const hasAutoSynced = platforms && platforms.some(p => auto_synced_platforms.includes(p));
        if (hasAutoSynced) {
          ojuzSection.style.display = 'block';
        } else {
          ojuzSection.style.display = 'none';
        }

        // Don't show the day row at all
        dayRow.style.display = 'none';
      } else if (stages.length > 0) {
        // Normal behavior - show stage selection
        // Check if all stages follow "Day X" pattern
        const allDayPattern = stages.every(stage => /^Day \d+$/.test(stage));

        if (allDayPattern) {
          dayLabel.textContent = 'Day';
          daySelect.innerHTML = '<option value="">Select Day</option>';
        } else {
          dayLabel.textContent = 'Stage';
          daySelect.innerHTML = '<option value="">Select Stage</option>';
        }

        stages.forEach(stage => {
          const option = document.createElement('option');
          option.value = stage;
          option.textContent = stage;
          daySelect.appendChild(option);
        });
        daySelect.disabled = false;
        dayRow.style.display = 'block';
      }
    }
  });

  // Handle day selection
  daySelect.addEventListener('change', (e) => {
    document.getElementById('platform-sync-card').style.display = 'none';
    const selectedStage = e.target.value;
    const selectedOlympiad = olympiadSelect.value;
    const selectedContest = contestSelect.value;

    if (selectedStage && selectedContest && contestData[selectedOlympiad]) {
      const [contestName, year] = selectedContest.split('|');
      const contests = contestData[selectedOlympiad][year] || [];
      const contest = contests.find(c => c.name === contestName && c.stage === selectedStage);

      if (!contest) return;

      // Check if this contest has been completed
      const contestKey = `${contestName}|${selectedStage}`;
      const isCompleted = data.completed_contests && data.completed_contests.includes(contestKey);

      // Calculate problem count from contest.problems array
      const problemCount = contest.problems ? contest.problems.length : 3;

      // Get platforms from the problems data we already fetched
      let platforms = ['Unknown'];
      if (contest.problems && problemsData[selectedOlympiad]) {
        const platformSet = new Set();
        contest.problems.forEach(prob => {
          const yearProblems = problemsData[selectedOlympiad][prob.year] || [];
          const problem = yearProblems.find(p => p.year === prob.year && p.number === prob.number);
          if (problem) {
            if (problem.links && typeof problem.links === 'object') {
              Object.keys(problem.links).forEach(plat => platformSet.add(plat));
            } else {
              const url = problem.link || chooseProblemUrl(problem);
              if (url) platformSet.add(getPlatformFromLink(url));
            }
          }
        });
        platforms = Array.from(platformSet).filter(p => p && p !== 'Unknown');
        if (platforms.length === 0) platforms = ['Unknown'];
      }

      // Show contest details with accurate info
      document.getElementById('contest-duration').textContent = formatDuration(contest.duration_minutes);
      document.getElementById('contest-problems').textContent = problemCount;
      document.getElementById('contest-platform').textContent = platforms.join('/');

      contestDetails.style.display = 'block';

      // Set state for platform sync preview and update
      lastRenderedContest = contest;
      lastRenderedOlympiad = selectedOlympiad;
      lastProblemCount = problemCount;
      updatePlatformSyncPreview();

      // Show/hide completion warning
      const completionWarning = document.getElementById('completion-warning');
      if (isCompleted) {
        completionWarning.dataset.reason = 'completed';
        completionWarning.style.display = 'block';
        startBtn.disabled = true;
      } else {
        completionWarning.dataset.reason = '';
        completionWarning.style.display = 'none';
        startBtn.disabled = false;
      }

      // If auto-track is enabled and not completed, pre-check coverage and disable start if missing
      precheckCoverageAfterSelection(contest, selectedOlympiad);

      // Show/hide ojuzSection if at least one platform is in auto_synced_platforms
      const hasAutoSynced = platforms && platforms.some(p => auto_synced_platforms.includes(p));
      if (hasAutoSynced) {
        ojuzSection.style.display = 'block';
      } else {
        ojuzSection.style.display = 'none';
      }
    }
  });

  // Handle start contest button
  startBtn.addEventListener('click', async () => {
    // Double-check if button should be disabled
    if (startBtn.disabled) {
      return;
    }

    const selectedOlympiad = olympiadSelect.value;
    const selectedContest = contestSelect.value;
    const selectedStage = daySelect.value;

    const [contestName, year] = selectedContest.split('|');
    const contests = contestData[selectedOlympiad][year] || [];

    // Handle both cases: with stage selection and without
    let contest;
    let finalStage;

    if (daySelect.style.display === 'none' || !selectedStage) {
      // No stage selection was shown - find the single contest
      const matchingContests = contests.filter(c => c.name === contestName);
      if (matchingContests.length === 1) {
        contest = matchingContests[0];
        finalStage = contest.stage || null; // Use the contest's stage (which might be null)
      } else {
        showMessage('Error: Multiple contests found but no stage selected.', 'error');
        return;
      }
    } else {
      // Normal stage selection
      contest = contests.find(c => c.name === contestName && c.stage === selectedStage);
      finalStage = selectedStage;
    }

    if (!contest) {
      showMessage('Error: Contest not found.', 'error');
      return;
    }

    // Determine if user wants auto-tracking via checkbox
    const wantsAutoTrack = document.getElementById('ojuz-autotrack')?.checked || false;

    // If auto-track is requested, ensure a username exists in user settings
    let platformUsernames = {};
    if (wantsAutoTrack) {
      try {
        const settingsRes = await fetch(`${apiUrl}/user/settings`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ token: sessionToken })
        });
        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          platformUsernames = settings && settings.platformUsernames ? settings.platformUsernames : {};
        }
      } catch (e) {
        console.error('Failed to fetch user settings for platform usernames', e);
      }

      // Check if at least one auto_synced_platforms username exists
      const hasAnyUsername = auto_synced_platforms.some(p => platformUsernames[p]);
      if (!hasAnyUsername) {
        // Popup error if no usernames at all
        showMessage('To auto track submissions, set your username in Settings → Connections.', 'warning');
        return;
      }

      // Now verify that every problem has at least one platform with a username
      let missingCoverage = false;
      if (contest.problems && problemsData[selectedOlympiad]) {
        for (const prob of contest.problems) {
          const yearProblems = problemsData[selectedOlympiad][prob.year] || [];
          const problem = yearProblems.find(p => p.year === prob.year && p.number === prob.number);
          if (problem) {
            // Collect platforms available for this problem
            let availablePlats = [];
            if (problem.links && typeof problem.links === 'object') {
              availablePlats = Object.keys(problem.links);
            } else if (problem.link) {
              availablePlats = [getPlatformFromLink(problem.link)];
            }

            // See if any of the available platforms is in auto_synced_platforms and has a username
            const ok = availablePlats.some(plat => auto_synced_platforms.includes(plat) && platformUsernames[plat]);
            if (!ok) {
              missingCoverage = true;
              break;
            }
          }
        }
      }
    }

    // Start the virtual contest in the database
    try {
      const startResponse = await fetch(`${apiUrl}/user/virtual/start`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: sessionToken,
          name: contestName,
          stage: finalStage,
          autosynced: !!wantsAutoTrack
        })
      });

      if (!startResponse.ok) {
        const error = await startResponse.json();
        if (error.error === 'Contest already completed') {
          showMessage('You have already completed this virtual contest.', 'warning');
        } else {
          showMessage('Failed to start contest: ' + error.error);
        }
        return;
      }

      // Set localStorage flag for active contest
      localStorage.setItem('contest_ongoing', 'true');
      localStorage.removeItem('is_synced'); // Clear any previous sync flag
      // Remove any previous ojuz_username storage
      localStorage.removeItem('ojuz_username');
    } catch (error) {
      showMessage('Failed to start contest: ' + error.message);
      return;
    }

    // Update currentActiveContest with the contest data we just started FIRST
    currentActiveContest = {
      contest_name: contestName,
      contest_stage: finalStage,
      start_time: new Date().toISOString(),
      duration_minutes: contest.duration_minutes,
      location: contest.location || '',
      website: contest.website || '',
      link: contest.link || '',
      autosynced: !!wantsAutoTrack
    };

    // Hide form and show active contest
    vcForm.style.display = 'none';
    activeContest.style.display = 'block';

    // Set contest title and metadata
    const titleText = finalStage ? `${contestName} <svg width="12" height="3" viewBox="0 0 12 3" style="vertical-align: middle; margin: 0 4px;"><rect width="12" height="2" fill="currentColor"/></svg> ${finalStage}` : contestName;
    document.getElementById('active-contest-title').innerHTML = titleText;

    // Set location and website in one line
    const locationElement = document.getElementById('active-contest-location');
    const websiteElement = document.getElementById('active-contest-website');

    if (contest.location || contest.website) {
      let metadataHTML = '';
      if (contest.location) {
        metadataHTML += contest.location;
      }
      if (contest.website) {
        if (metadataHTML) metadataHTML += ' | ';
        metadataHTML += `<a href="${contest.website}" target="_blank">${contest.website}</a>`;
      }
      locationElement.innerHTML = metadataHTML;
      locationElement.style.display = 'block';
      websiteElement.style.display = 'none';
    } else {
      locationElement.style.display = 'none';
      websiteElement.style.display = 'none';
    }

    // Start timer with actual contest duration (after currentActiveContest is set)
    startTimer(contest.duration_minutes);
  });

  // Handle end contest button
  document.getElementById('end-contest-btn').addEventListener('click', async () => {
    // Use autosynced flag for determining sync mode
    const isAutosynced = asBool(currentActiveContest?.autosynced);

    try {
      // Hide entire UI and show loading spinner if autosynced
      if (isAutosynced) {
        activeContest.style.display = 'none';
        document.getElementById('ojuz-sync-loading').style.display = 'flex';
      }

      const response = await fetch(`${apiUrl}/user/virtual/end`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: sessionToken })
      });

      // Hide loading spinner and restore UI
      if (isAutosynced) {
        document.getElementById('ojuz-sync-loading').style.display = 'none';
      }

      if (response.ok) {
        const result = await response.json();

        if (isAutosynced && result.submissions) {
          // Show score entry with oj.uz data in read-only mode
          localStorage.setItem('contest_ongoing', 'false');
          localStorage.setItem('is_synced', 'true');

          // we need to populate result.submissions with problemIndex ourselves
          // result.submissions = result.submissions.map(i => {
          //   i.problemIndex = currentActiveContest
          // });

          // Store oj.uz data in localStorage for persistence across refreshes
          localStorage.setItem('ojuz_data', JSON.stringify(result.submissions));

          // Update currentActiveContest to mark it as ended with capped end time
          const contestDurationMs = currentActiveContest.duration_minutes * 60 * 1000;
          const startTime = new Date(currentActiveContest.start_time);
          const maxEndTime = new Date(startTime.getTime() + contestDurationMs);
          const actualEndTime = new Date();
          const cappedEndTime = new Date(Math.min(actualEndTime.getTime(), maxEndTime.getTime()));

          currentActiveContest.end_time = cappedEndTime.toISOString();
          currentActiveContest.ojuz_data = result.submissions; // Store detailed submission data

          showScoreEntry(true); // Pass true to indicate read-only mode with oj.uz data
        } else {
          // Hide active contest and show manual score entry
          localStorage.setItem('contest_ongoing', 'false');
          localStorage.removeItem('is_synced');
          localStorage.removeItem('ojuz_username'); // Clear stored username

          // Update currentActiveContest to mark it as ended with capped end time
          const contestDurationMs = currentActiveContest.duration_minutes * 60 * 1000;
          const startTime = new Date(currentActiveContest.start_time);
          const maxEndTime = new Date(startTime.getTime() + contestDurationMs);
          const actualEndTime = new Date();
          const cappedEndTime = new Date(Math.min(actualEndTime.getTime(), maxEndTime.getTime()));

          currentActiveContest.end_time = cappedEndTime.toISOString();

          showScoreEntry(false); // Pass false for manual entry mode
        }
      } else {
        throw new Error('Failed to end contest');
      }
    }
    catch (error) {
      // Hide loading spinner and restore UI on error
      if (isAutosynced) {
        document.getElementById('ojuz-sync-loading').style.display = 'none';
        activeContest.style.display = 'block';
      }
      console.error('Error ending contest:', error);
      showMessage('Failed to end contest. Please try again.', 'error');
    }
  });

  // Handle open contest button
  document.getElementById('open-contest-btn').addEventListener('click', () => {
    // For active contests, use the stored active contest data
    const activeContestElement = document.getElementById('active-contest');
    if (activeContestElement.style.display !== 'none' && currentActiveContest) {
      // We're in an active contest, use the contest link
      if (currentActiveContest.link) {
        window.open(currentActiveContest.link, '_blank');
      } else {
        let links = [];
        for (let prob of currentActiveContest.problems) {
          for (let [stage, years] of Object.entries(problemsData)) {
            for (let [year, data] of Object.entries(years)) {
              let relevant = data.find(i => i.id == prob.problemId);
              if (relevant) {
                links.push({ name: relevant.name, link: chooseProblemUrl(relevant) });
              }
            }
          }
        }
        showLinks(links);
      }
      return;
    }

    // For contest selection (not active), use the old logic
    const selectedOlympiad = olympiadSelect.value;
    const selectedContest = contestSelect.value;

    if (!selectedOlympiad || !selectedContest || !contestData[selectedOlympiad]) {
      showMessage('No contest selected.', 'warning');
      return;
    }

    const [contestName, year] = selectedContest.split('|');
    const contests = contestData[selectedOlympiad][year] || [];

    // Handle both cases: with stage selection and without
    let contest;
    let selectedStage;

    if (daySelect.style.display === 'none') {
      // No stage selection was shown - find the single contest
      const matchingContests = contests.filter(c => c.name === contestName);
      if (matchingContests.length === 1) {
        contest = matchingContests[0];
        selectedStage = contest.stage;
      }
    } else {
      // Normal stage selection
      selectedStage = daySelect.value;
      contest = contests.find(c => c.name === contestName && c.stage === selectedStage);
    }

    if (contest && contest.link) {
      window.open(contest.link, '_blank');
    } else {
      showMessage('No contest link available for this contest.', 'warning');
    }
  });

  // Helper function to get status color
  function getStatusColor(status) {
    switch (status) {
      case 2: return 'green';
      case 1: return 'yellow';
      case 0: return 'red';
      default: return 'white';
    }
  }

  // Handle read-only cell clicks for oj.uz mode
  function handleReadOnlyCellClick(cell, problem, event) {
    event.preventDefault();

    const subtaskScores = JSON.parse(cell.dataset.subtaskScores || '[]');
    const totalScore = parseFloat(cell.dataset.score) || 0;

    showReadOnlyPopup(cell, {
      problemName: problem.name,
      totalScore: totalScore,
      subtaskScores: subtaskScores
    }, event);
  }

  // Show read-only popup for oj.uz scores
  function showReadOnlyPopup(cell, data, event) {
    let readonlyPopup = document.getElementById('readonly-popup');
    if (!readonlyPopup) {
      // Create the popup if it doesn't exist
      const popupDiv = document.createElement('div');
      popupDiv.id = 'readonly-popup';
      popupDiv.className = 'readonly-popup hidden';
      popupDiv.innerHTML = `
        <div class="readonly-popup-content">
          <div class="readonly-popup-header">
            <div id="readonly-popup-problem"></div>
            <div id="readonly-popup-total-score"></div>
          </div>
          <div class="readonly-popup-subtasks" id="readonly-popup-subtasks"></div>
        </div>
      `;
      document.body.appendChild(popupDiv);

      // Close popup when clicking outside
      popupDiv.addEventListener('click', (e) => {
        if (e.target === popupDiv) {
          hideReadOnlyPopup();
        }
      });

      // Close popup on escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          hideReadOnlyPopup();
        }
      });

      readonlyPopup = popupDiv;
    }

    // Populate popup content
    document.getElementById('readonly-popup-problem').textContent = data.problemName;
    document.getElementById('readonly-popup-total-score').textContent = `Total Score: ${data.totalScore}/100`;

    // Create subtasks list
    const subtasksDiv = document.getElementById('readonly-popup-subtasks');
    if (data.subtaskScores && data.subtaskScores.length > 0) {
      subtasksDiv.innerHTML = '<div class="subtasks-header">Subtask Scores:</div>';
      const subtasksList = document.createElement('div');
      subtasksList.className = 'subtasks-list';

      data.subtaskScores.forEach((score, index) => {
        const subtaskDiv = document.createElement('div');
        subtaskDiv.className = 'subtask-item';
        subtaskDiv.innerHTML = `
          <span class="subtask-label">Subtask ${index + 1}:</span>
          <span class="subtask-score">${score}</span>
        `;
        subtasksList.appendChild(subtaskDiv);
      });

      subtasksDiv.appendChild(subtasksList);
    } else {
      subtasksDiv.innerHTML = '<div class="no-subtasks">No subtask information available</div>';
    }

    // Show popup
    readonlyPopup.style.display = 'flex';
    readonlyPopup.classList.remove('hidden');

    // Trigger animation after a brief delay to ensure display is set
    setTimeout(() => {
      readonlyPopup.classList.add('show');
    }, 10);
  }

  function hideReadOnlyPopup() {
    const popup = document.getElementById('readonly-popup');
    if (popup) {
      popup.classList.remove('show');
      popup.classList.add('hidden');

      // Hide the element after animation completes
      setTimeout(() => {
        popup.style.display = 'none';
      }, 300);
    }
  }
  document.getElementById('submit-scores-btn').addEventListener('click', async () => {
    if (!currentActiveContest) {
      showMessage('No active contest data available.');
      return;
    }

    // Check if we're in autosynced mode (with oj.uz data)
    const isAutosynced = !!currentActiveContest.autosynced;

    if (isAutosynced) {
      // autosynced mode - just confirm the contest completion
      try {
        const confirmResponse = await fetch(`${apiUrl}/user/virtual/confirm`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: sessionToken })
        });

        if (!confirmResponse.ok) {
          const error = await confirmResponse.json();
          showMessage('Failed to confirm virtual contest: ' + error.error);
          return;
        }

        // Redirect to virtual history page
        window.location.href = '/virtual-history';

        // Clear stored data since contest is now completed
        localStorage.removeItem('is_synced');
        localStorage.removeItem('ojuz_data');
        localStorage.removeItem('ojuz_username');

      } catch (error) {
        showMessage('Failed to confirm contest: ' + error.message);
      }

      return; // Exit early for autosynced mode
    }

    // Manual entry mode - collect and validate scores
    let scores = [];
    let totalScore = 0;

    const problemCells = document.querySelectorAll('#score-problems-tbody .problem-cell');

    // Validate scores first
    for (let i = 0; i < problemCells.length; i++) {
      const score = parseFloat(problemCells[i].dataset.score) || 0;
      if (score < 0 || score > 100) {
        showMessage(`${problemCells[i].dataset.problemId} score must be between 0 and 100.`, 'warning');
        return;
      }
      scores.push(score);
      totalScore += score;
    }

    try {
      // Update individual problem statuses and scores
      for (let i = 0; i < problemCells.length; i++) {
        const cell = problemCells[i];
        const id = parseInt(cell.dataset.id);
        const problemName = cell.dataset.problemId;
        const score = parseFloat(cell.dataset.score) || 0;
        const status = parseInt(cell.dataset.status) || 0;

        // Update problem score
        const updateResponse = await fetch(`${apiUrl}/user/problems`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: sessionToken, id, status, score })
        });

        if (!updateResponse.ok) {
          const error = await updateResponse.json();
          showMessage(`Failed to update score for ${problemName}: ${error.error}`);
          return;
        }
      }

      // Submit the virtual contest scores
      const submitResponse = await fetch(`${apiUrl}/user/virtual/submit`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: sessionToken, scores: scores })
      });

      if (!submitResponse.ok) {
        const error = await submitResponse.json();
        showMessage('Failed to submit virtual contest: ' + error.error);
        return;
      }

      // Redirect to virtual history page
      window.location.href = '/virtual-history';

      // Clear stored data since contest is now completed
      localStorage.removeItem('is_synced');
      localStorage.removeItem('ojuz_data');
      localStorage.removeItem('ojuz_username');

    } catch (error) {
      showMessage('Failed to submit scores: ' + error.message);
    }
  });

  function startTimerWithSeconds(remainingSeconds, alreadyElapsedSeconds = 0) {
    // Store the start timestamp for accurate time tracking
    const timerStartTime = Date.now();
    const initialTimeRemaining = remainingSeconds;
    
    const timer = document.getElementById('contest-timer');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    // Update display function
    const updateDisplay = () => {
      // Calculate actual elapsed time since timer started
      const actualElapsedMs = Date.now() - timerStartTime;
      const actualElapsedSeconds = Math.floor(actualElapsedMs / 1000);
      
      // Calculate remaining time based on actual elapsed time
      const timeRemaining = Math.max(0, initialTimeRemaining - actualElapsedSeconds);

      const hours = Math.floor(timeRemaining / 3600);
      const minutes = Math.floor((timeRemaining % 3600) / 60);
      const seconds = timeRemaining % 60;

      timer.textContent = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

      // Only update progress if we have contest data
      if (currentActiveContest && currentActiveContest.duration_minutes) {
        // Total elapsed time = already elapsed + actual elapsed from timer
        const totalElapsedSeconds = alreadyElapsedSeconds + actualElapsedSeconds;
        const totalContestSeconds = currentActiveContest.duration_minutes * 60;

        // Cap elapsed time at contest duration
        const cappedElapsedSeconds = Math.min(totalElapsedSeconds, totalContestSeconds);

        const progressPercent = (cappedElapsedSeconds / totalContestSeconds) * 100;
        progressFill.style.width = `${Math.min(100, progressPercent)}%`;

        const elapsedHours = Math.floor(cappedElapsedSeconds / 3600);
        const elapsedMins = Math.floor((cappedElapsedSeconds % 3600) / 60);
        progressText.textContent = `${elapsedHours}h ${elapsedMins}m elapsed`;
      }

      const interval = setInterval(updateDisplay, 1000);

      // Check if time is up
      if (timeRemaining <= 0) {
        clearInterval(interval);
        timer.textContent = '0:00:00';
        progressFill.style.width = '100%';

        // Only show message if page is visible to avoid popup-like behavior
        if (!document.hidden) {
          // Small delay to ensure consistent behavior
          setTimeout(() => {
            showMessage('Time is up! Please end your contest and submit your scores.', 'warning');
          }, 100);
        }
      }
    };

    // Set initial display
    updateDisplay();
  }

  function startTimer(remainingMinutes, alreadyElapsedMinutes = 0) {
    // Convert to seconds and use the seconds-based function
    startTimerWithSeconds(remainingMinutes * 60, alreadyElapsedMinutes * 60);
  }
});