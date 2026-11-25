const resumeInput = document.getElementById("resume");
resumeInput.addEventListener("change", () => {
    const fileName = document.getElementById("file-name");
    fileName.textContent = resumeInput.files[0]
        ? resumeInput.files[0].name
        : "No file selected";
});

async function loadData(event) {
    event.preventDefault();
    const resultDiv = document.getElementById("result");
    const status = document.getElementById("status");
    const button = document.getElementById("analyze-button");
    const file = resumeInput.files[0];

    if (!file) {
        setStatus(status, "Choose a PDF resume before analyzing.", "error");
        return;
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
        setStatus(status, "Please choose a PDF file.", "error");
        return;
    }

    button.disabled = true;
    setStatus(status, "Comparing your resume with job descriptions. The first run may take longer while the local model downloads and warms up...", "loading");
    resultDiv.replaceChildren();

    try {
        const response = await fetch("/match", {
            method: "POST",
            headers: { "Content-Type": "application/pdf" },
            body: file
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || "Unable to analyze this resume.");
        }

        renderResults(data, file.name, resultDiv);
        setStatus(status, "Analysis complete. Your matches are ranked below.", "success");
    } catch (error) {
        setStatus(status, error.message || "Unable to analyze this resume.", "error");
    } finally {
        button.disabled = false;
    }
}

function setStatus(status, message, state) {
    status.textContent = message;
    status.className = `status status-${state}`;
}

function renderResults(data, fileName, resultDiv) {
    resultDiv.replaceChildren();

    const resultsHeading = document.createElement("div");
    resultsHeading.className = "results-heading";

    const headingCopy = document.createElement("div");
    const kicker = document.createElement("p");
    kicker.className = "results-kicker";
    kicker.textContent = "YOUR RESULTS";

    const title = document.createElement("h2");
    title.className = "results-title";
    title.textContent = "Roles ranked by semantic similarity";
    const explanation = document.createElement("p");
    explanation.className = "job-description";
    explanation.textContent = "Similarity scores are approximate, not hiring probabilities. Skill labels show exact keyword matches.";
    headingCopy.append(kicker, title, explanation);

    const resultCount = document.createElement("span");
    resultCount.className = "results-count";
    resultCount.textContent = `${data.matchingJobs.length} roles ranked`;
    resultsHeading.append(headingCopy, resultCount);
    resultDiv.appendChild(resultsHeading);

    const summaryCard = document.createElement("article");
    summaryCard.className = "job-card summary-card";

    const summaryHeading = document.createElement("div");
    summaryHeading.className = "summary-heading";

    const summaryTitle = document.createElement("h3");
    summaryTitle.textContent = "Resume overview";

    const uploadedFile = document.createElement("span");
    uploadedFile.className = "summary-file";
    uploadedFile.textContent = fileName;
    summaryHeading.append(summaryTitle, uploadedFile);
    summaryCard.appendChild(summaryHeading);

    const metrics = document.createElement("div");
    metrics.className = "summary-metrics";
    addMetric(metrics, "Salary", data.salary || "Not mentioned");
    addMetric(
        metrics,
        "Experience",
        data.yearOfExperience == null
            ? "Not mentioned"
            : `${data.yearOfExperience} years`
    );

    const skillsMetric = document.createElement("div");
    skillsMetric.className = "summary-metric summary-skills";
    const skillsLabel = document.createElement("span");
    skillsLabel.className = "metric-label";
    skillsLabel.textContent = `Skills identified (${data.resumeSkills.length})`;
    skillsMetric.appendChild(skillsLabel);

    if (data.resumeSkills.length > 0) {
        const skillList = document.createElement("div");
        skillList.className = "skill-list";
        data.resumeSkills.forEach(skill => {
            const chip = document.createElement("span");
            chip.className = "skill-chip";
            chip.textContent = skill;
            skillList.appendChild(chip);
        });
        skillsMetric.appendChild(skillList);
    } else {
        const emptySkills = document.createElement("span");
        emptySkills.className = "metric-value";
        emptySkills.textContent = "No recognized skills found";
        skillsMetric.appendChild(emptySkills);
    }

    metrics.appendChild(skillsMetric);
    summaryCard.appendChild(metrics);
    resultDiv.appendChild(summaryCard);

    data.matchingJobs.forEach((job, index) => {
        resultDiv.appendChild(createJobCard(job, index));
    });
}

function addMetric(container, label, value) {
    const metric = document.createElement("div");
    metric.className = "summary-metric";

    const metricLabel = document.createElement("span");
    metricLabel.className = "metric-label";
    metricLabel.textContent = label;

    const metricValue = document.createElement("span");
    metricValue.className = "metric-value";
    metricValue.textContent = value;

    metric.append(metricLabel, metricValue);
    container.appendChild(metric);
}

function createJobCard(job, index) {
    const card = document.createElement("article");
    card.className = "job-card";

    const heading = document.createElement("div");
    heading.className = "job-card-head";

    const rank = document.createElement("span");
    rank.className = "job-rank";
    rank.textContent = String(index + 1).padStart(2, "0");

    const titleWrap = document.createElement("div");
    titleWrap.className = "job-title-wrap";

    const title = document.createElement("h3");
    title.className = "job-title";
    title.textContent = job.role;
    titleWrap.appendChild(title);

    const jobId = document.createElement("span");
    jobId.className = "job-id";
    jobId.textContent = job.jobId;
    titleWrap.appendChild(jobId);

    const score = Math.max(0, Math.min(100, Number(job.matchingScore) || 0));
    const scoreBadge = document.createElement("span");
    scoreBadge.className = `score ${getScoreClass(score)}`;
    scoreBadge.textContent = `${score}% similar`;

    heading.append(rank, titleWrap, scoreBadge);
    card.appendChild(heading);

    const scoreTrack = document.createElement("div");
    scoreTrack.className = "score-track";
    scoreTrack.setAttribute("role", "progressbar");
    scoreTrack.setAttribute("aria-label", `${job.role} semantic similarity`);
    scoreTrack.setAttribute("aria-valuemin", "0");
    scoreTrack.setAttribute("aria-valuemax", "100");
    scoreTrack.setAttribute("aria-valuenow", String(score));

    const scoreFill = document.createElement("div");
    scoreFill.className = "score-fill";
    scoreFill.style.width = `${score}%`;
    scoreTrack.appendChild(scoreFill);
    card.appendChild(scoreTrack);

    if (job.aboutRole) {
        const description = document.createElement("p");
        description.className = "job-description";
        description.textContent = job.aboutRole;
        card.appendChild(description);
    }

    const skillsHeading = document.createElement("h4");
    skillsHeading.className = "skills-heading";
    skillsHeading.textContent = "Skills comparison";
    card.appendChild(skillsHeading);

    const skills = document.createElement("div");
    skills.className = "job-skills";
    job.skillsAnalysis.forEach(skill => {
        const skillTag = document.createElement("span");
        skillTag.className = `job-skill ${skill.presentInResume ? "skill-true" : "skill-false"}`;
        skillTag.textContent = `${skill.skill} · ${skill.presentInResume ? "Matched" : "Not matched"}`;
        skills.appendChild(skillTag);
    });
    card.appendChild(skills);

    return card;
}

function getScoreClass(score) {
    if (score >= 70) return "score-high";
    if (score >= 40) return "score-medium";
    return "score-low";
}
