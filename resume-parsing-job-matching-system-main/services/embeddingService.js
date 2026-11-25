const MODEL_ID = "onnx-community/all-MiniLM-L6-v2-ONNX";
const BATCH_SIZE = 16;
const CACHE_LIMIT = 512;

let extractorPromise;
const embeddingCache = new Map();

async function getExtractor() {
    if (!extractorPromise) {
        extractorPromise = import("@huggingface/transformers")
            .then(({ pipeline }) => pipeline("feature-extraction", MODEL_ID, { dtype: "q4" }));
    }

    try {
        return await extractorPromise;
    } catch (error) {
        extractorPromise = undefined;
        throw new Error(
            `Could not load the local embedding model "${MODEL_ID}". Check network access for its first download, then retry. ${error.message}`
        );
    }
}

function addToCache(text, vector) {
    embeddingCache.set(text, vector);
    while (embeddingCache.size > CACHE_LIMIT) {
        embeddingCache.delete(embeddingCache.keys().next().value);
    }
}

async function embedTexts(texts) {
    const uniqueTexts = [...new Set(texts)];
    const missingTexts = uniqueTexts.filter(text => !embeddingCache.has(text));

    if (missingTexts.length > 0) {
        const extractor = await getExtractor();

        for (let index = 0; index < missingTexts.length; index += BATCH_SIZE) {
            const batch = missingTexts.slice(index, index + BATCH_SIZE);
            const output = await extractor(batch, { pooling: "mean", normalize: true });
            const result = output.tolist();
            const vectors = Array.isArray(result[0]) ? result : [result];

            if (vectors.length !== batch.length || vectors.some(vector =>
                !Array.isArray(vector) || vector.length === 0 || vector.some(value => !Number.isFinite(value))
            )) {
                throw new Error("The local embedding model returned invalid vectors.");
            }

            batch.forEach((text, batchIndex) => addToCache(text, vectors[batchIndex]));
        }
    }

    return texts.map(text => {
        const vector = embeddingCache.get(text);
        if (!vector) {
            throw new Error("A text embedding was not generated.");
        }
        return vector;
    });
}

module.exports = { embedTexts };
