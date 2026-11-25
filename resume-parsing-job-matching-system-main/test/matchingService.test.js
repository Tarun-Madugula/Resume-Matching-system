const assert = require("node:assert/strict");
const test = require("node:test");

const {
    calculateMatching,
    calculateMatchings,
    calculateSemanticScore,
    chunkText,
    cosineSimilarity,
    warmupMatching
} = require("../services/matchingService");

test("chunks text without dropping words", () => {
    const words = Array.from({ length: 205 }, (_, index) => `word${index}`);
    const chunks = chunkText(words.join(" "));

    assert.deepEqual(chunks.map(chunk => chunk.split(" ").length), [100, 100, 5]);
    assert.equal(chunks.join(" ").split(" ").join(","), words.join(","));
});

test("calculates cosine similarity and semantic percentage across JD chunks", () => {
    assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
    assert.equal(calculateSemanticScore(
        [[1, 0], [0, 1]],
        [[0.8, 0.6], [0, 1]]
    ), 90);
});

test("returns zero when either side has no embeddings", () => {
    assert.equal(calculateSemanticScore([], [[1, 0]]), 0);
    assert.equal(calculateSemanticScore([[1, 0]], []), 0);
});

test("returns semantic scores while retaining skill-by-skill details", async () => {
    const result = await calculateMatching(
        "resume text",
        ["Python"],
        {
            jobId: "JD001",
            role: "Developer",
            aboutRole: "Build software",
            requiredSkills: ["Python"],
            optionalSkills: ["Java"]
        },
        async texts => texts.map(() => [1, 0])
    );

    assert.equal(result.matchingScore, 100);
    assert.deepEqual(result.skillsAnalysis, [
        { skill: "Python", presentInResume: true },
        { skill: "Java", presentInResume: false }
    ]);
});

test("embeds shared resume and all job chunks in a single call", async () => {
    const jobs = ["JD001", "JD002", "JD003"].map(jobId => ({
        jobId,
        role: "Developer",
        aboutRole: "Build software",
        requiredSkills: ["Python"],
        optionalSkills: []
    }));
    let calls = 0;

    const results = await calculateMatchings(
        "resume text",
        ["Python"],
        jobs,
        async texts => {
            calls++;
            return texts.map(() => [1, 0]);
        }
    );

    assert.equal(calls, 1);
    assert.equal(results.length, jobs.length);
    assert.ok(results.every(result => result.matchingScore === 100));
});

test("warms job-description embeddings before a resume is uploaded", async () => {
    let embeddedTexts;
    await warmupMatching([{
        jobId: "JD001",
        role: "Developer",
        aboutRole: "Build software",
        requiredSkills: ["Python"],
        optionalSkills: []
    }], async texts => {
        embeddedTexts = texts;
        return texts.map(() => [1, 0]);
    });

    assert.equal(embeddedTexts.length, 1);
    assert.match(embeddedTexts[0], /Developer.*Build software.*Python/);
});
