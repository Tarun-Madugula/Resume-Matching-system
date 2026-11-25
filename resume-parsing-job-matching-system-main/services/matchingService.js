const { embedTexts } = require("./embeddingService");

const MAX_WORDS_PER_CHUNK = 100;

function chunkText(text) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    const chunks = [];

    for (let index = 0; index < words.length; index += MAX_WORDS_PER_CHUNK) {
        chunks.push(words.slice(index, index + MAX_WORDS_PER_CHUNK).join(" "));
    }

    return chunks;
}

function cosineSimilarity(left, right) {
    if (left.length !== right.length || left.length === 0) {
        throw new Error("Embedding vectors must have the same non-zero length.");
    }

    let dotProduct = 0;
    let leftMagnitude = 0;
    let rightMagnitude = 0;

    for (let index = 0; index < left.length; index++) {
        dotProduct += left[index] * right[index];
        leftMagnitude += left[index] ** 2;
        rightMagnitude += right[index] ** 2;
    }

    if (leftMagnitude === 0 || rightMagnitude === 0) {
        return 0;
    }

    return dotProduct / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function calculateSemanticScore(resumeVectors, jdVectors) {
    if (resumeVectors.length === 0 || jdVectors.length === 0) {
        return 0;
    }

    const bestMatches = jdVectors.map(jdVector => {
        let bestMatch = -1;
        resumeVectors.forEach(resumeVector => {
            bestMatch = Math.max(bestMatch, cosineSimilarity(resumeVector, jdVector));
        });
        return bestMatch;
    });
    const averageSimilarity = bestMatches.reduce((sum, score) => sum + score, 0) / bestMatches.length;

    return Math.round(Math.max(0, Math.min(1, averageSimilarity)) * 100);
}

function getJobChunks(jdData) {
    const jdText = [
        jdData.role,
        jdData.aboutRole,
        ...jdData.requiredSkills,
        ...jdData.optionalSkills
    ].filter(Boolean).join(". ");

    return chunkText(jdText);
}

async function warmupMatching(jdDataList, embed = embedTexts) {
    const jdChunks = jdDataList.flatMap(getJobChunks);
    if (jdChunks.length > 0) {
        await embed(jdChunks);
    }
}

async function calculateMatchings(resumeText, resumeSkills, jdDataList, embed = embedTexts) {
    const resumeChunks = chunkText(resumeText);
    const jobs = jdDataList.map(jdData => {
        return { jdData, jdChunks: getJobChunks(jdData) };
    });
    const allChunks = [...resumeChunks, ...jobs.flatMap(job => job.jdChunks)];
    const vectors = allChunks.length > 0 ? await embed(allChunks) : [];
    const resumeVectors = vectors.slice(0, resumeChunks.length);
    let vectorIndex = resumeChunks.length;

    return jobs.map(({ jdData, jdChunks }) => {
        const jdVectors = vectors.slice(vectorIndex, vectorIndex + jdChunks.length);
        vectorIndex += jdChunks.length;
        const allSkills = [
            ...jdData.requiredSkills,
            ...jdData.optionalSkills
        ];

        const skillsAnalysis = allSkills.map(skill => ({
            skill,
            presentInResume: resumeSkills.includes(skill)
        }));

        return {
            jobId: jdData.jobId,
            role: jdData.role,
            aboutRole: jdData.aboutRole,
            skillsAnalysis,
            matchingScore: calculateSemanticScore(resumeVectors, jdVectors)
        };
    });
}

async function calculateMatching(resumeText, resumeSkills, jdData, embed = embedTexts) {
    const [matchResult] = await calculateMatchings(
        resumeText,
        resumeSkills,
        [jdData],
        embed
    );
    return matchResult;
}

module.exports = {
    calculateMatching,
    calculateMatchings,
    calculateSemanticScore,
    chunkText,
    cosineSimilarity,
    warmupMatching
};